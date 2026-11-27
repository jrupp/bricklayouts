/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

/**
 * LayoutPreservation - Temporarily saves and restores the current layout.
 * Used to preserve a user's work while they are redirected away (Stripe
 * checkout) or while they are in the component editor. Backed by either
 * localStorage or sessionStorage depending on how long the data must survive.
 * Follows AirBNB JavaScript style guide.
 */

import { LayoutController, CurrentFormatVersion } from '../controller/layoutController.js';
import { showSnackbar } from './snackbar.js';
import {
  CHECKOUT_LAYOUT_KEY,
  EDITOR_LAYOUT_KEY,
  DEFAULT_MAX_AGE_MS,
} from './preservationKeys.js';

// Re-exported so importers that already treat this module as the entry point for
// preservation keep working. index.js deliberately imports takePendingPreservation
// from preservationKeys.js instead, so that the startup check does not drag this
// module, LayoutController and the cloud restore path onto the critical path of
// a visitor with nothing to restore.
export { CHECKOUT_LAYOUT_KEY, EDITOR_LAYOUT_KEY, DEFAULT_MAX_AGE_MS };

/**
 * Budget for a single preserved payload, in bytes. Web Storage gives an origin
 * roughly 5MB per area; the remainder is headroom for the other keys on the
 * origin, since filling the area would break them instead.
 * @type {number}
 */
export const STORAGE_BUDGET_BYTES = 4 * 1024 * 1024;

/**
 * Estimates what a key/value pair costs in a Web Storage area. Browsers charge
 * storage in UTF-16 code units, so a character costs two bytes. This is an
 * estimate used to avoid an attempt that is obviously too large, never a
 * guarantee that a smaller write will succeed.
 * @param {string} key
 * @param {string} value
 * @returns {number} Estimated bytes
 */
export function estimateStorageBytes(key, value) {
  return (key.length + value.length) * 2;
}

/**
 * Identifies a Web Storage quota failure across browsers. Deliberately false
 * for SecurityError, which means storage is switched off entirely and no
 * amount of shrinking the payload will help.
 * @param {Error} error
 * @returns {boolean} True if the write failed because the area is full
 */
export function isQuotaError(error) {
  if (!error) {
    return false;
  }
  // Chrome/Edge/Safari use QuotaExceededError (legacy code 22); Firefox uses
  // NS_ERROR_DOM_QUOTA_REACHED (legacy code 1014).
  return error.name === 'QuotaExceededError'
    || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || error.code === 22
    || error.code === 1014;
}

/**
 * Preserves and restores a layout through a Web Storage area. Cloud layouts are
 * stored by reference (cloudId) and reloaded from cloud storage on restore;
 * local layouts are serialized in full.
 */
export class LayoutPreservation {
  /**
   * @param {Object} options
   * @param {Storage} options.storage The storage area (localStorage or sessionStorage).
   * @param {string} options.key The storage key to read/write.
   * @param {number} [options.maxAgeMs] Maximum age of preserved data before it's stale.
   * @param {boolean} [options.preserveMocs] Carry the layout's local-only MOCs
   *   through as well. Only the checkout instance needs this. The editor stores
   *   aliases alone: on a normal exit its MOCs are still registered, and MOCs
   *   that only ever existed in this page's memory are deliberately not carried
   *   through a reload. Session storage is too small to hold their textures, and
   *   the cloud is the supported way to keep a MOC.
   */
  constructor({ storage, key, maxAgeMs = DEFAULT_MAX_AGE_MS, preserveMocs = false }) {
    this.storage = storage;
    this.key = key;
    this.maxAgeMs = maxAgeMs;
    this.preserveMocs = preserveMocs;
    /**
     * How many distinct MOCs the last restore had to leave out.
     * @type {number}
     */
    this.droppedMocCount = 0;
  }

  /**
   * Saves the current layout.
   * Cloud layouts are saved to the cloud and stored by reference (cloudId).
   * Local layouts are serialized and stored in full.
   * Handles storage unavailability gracefully by skipping preservation.
   * @returns {Promise<boolean>} True when the layout as it stands, unsaved edits
   *   included, can be brought back by restore(). A caller about to clear the
   *   workspace must not do so on false.
   */
  async save() {
    const layoutController = LayoutController.getInstance();

    if (layoutController.isCloudLayout()) {
      // Persist any edits, then store only a reference to the cloud layout.
      // A cloud save can fail for many reasons (offline, declining the
      // local-MOC upload prompt, a rejected request). The reference is still
      // stored so the restore brings the layout back, but it will be the last
      // successfully saved copy — warn that newer edits are gone rather than
      // letting them disappear silently.
      const saved = await layoutController._saveToCloud(layoutController.getLayoutName());
      if (!saved) {
        showSnackbar(
          'Could not save your layout to the cloud. Recent changes may be lost.',
          'error'
        );
      }
      const stored = this._reportSaveResult(this._trySetItem({
        type: 'cloud',
        cloudId: layoutController.layoutMetadata.cloudId,
        timestamp: Date.now(),
      }));
      // The reference brings back the last saved copy, which only includes the
      // current edits if the save above went through.
      return stored && Boolean(saved);
    }

    return this._saveLocalLayout(layoutController);
  }

  /**
   * Serializes and stores a local layout, falling back through the MOC tiers
   * when the payload will not fit.
   * @param {LayoutController} layoutController
   * @returns {Promise<boolean>} True if a payload was stored. Tier 3 counts: what
   *   it dropped has been reported, and the rest of the layout is safe.
   * @private
   */
  async _saveLocalLayout(layoutController) {
    const layoutData = {
      version: CurrentFormatVersion,
      date: Date.now(),
      x: layoutController.workspace.x,
      y: layoutController.workspace.y,
      zoom: layoutController.workspace.scale.x,
      layers: layoutController.layers.map((layer) => layer.serialize()),
      config: layoutController.config.serializeWorkspaceSettings(),
    };

    if (layoutController.getLayoutName()) {
      layoutData.metadata = { name: layoutController.getLayoutName() };
    }

    const wrap = () => ({ type: 'local', layoutData, timestamp: Date.now() });

    if (!this.preserveMocs) {
      return this._reportSaveResult(this._trySetItem(wrap()));
    }

    // Only the MOCs this layout actually places, not everything in the browser.
    // Cloud MOCs contribute nothing: loadCloudMocs() re-registers them on
    // return, and their `src` is a presigned URL that a 24h-old payload would
    // find expired anyway.
    let localAliases = this._takeLocalMocAliases(layoutController, layoutData);
    if (localAliases.length === 0) {
      return this._reportSaveResult(this._trySetItem(wrap()));
    }

    // Tier 1: embed the textures. No network, and the payload becomes fully
    // self-contained, which also makes it immune to a later MOC deletion.
    layoutData.mocs = await layoutController._serializeMocs(localAliases);
    // A MOC whose texture is missing or cannot be extracted is left out of the
    // list. Storing the payload anyway would leave its components naming an
    // alias nothing can resolve, so that is handled like a payload too big to
    // store: the tiers below either move it to the cloud or drop it, and say so.
    const serialized = new Set(layoutData.mocs.map((moc) => moc.alias));
    let result = localAliases.every((alias) => serialized.has(alias))
      ? this._trySetItem(wrap())
      : { status: 'quota' };
    if (result.status !== 'quota') {
      return this._reportSaveResult(result);
    }

    // Tier 2: put the MOCs in the cloud instead of in the payload.
    // No upsell: preserveMocs is only set for checkout, so the user is already
    // on their way to subscribing. Tier 3 below still reports the limit.
    const outcome = await layoutController._ensureMocsInCloud({ upsell: false });
    // A successful upload re-keys each track's alias in place, so the layers
    // serialized above now name aliases that no longer resolve. This re-read is
    // mandatory, and it is just as mandatory on the failure path below: the
    // upload may have got part way through the batch before giving up.
    layoutData.layers = layoutController.layers.map((layer) => layer.serialize());
    localAliases = this._takeLocalMocAliases(layoutController, layoutData);
    delete layoutData.mocs;

    if (outcome.ok) {
      result = this._trySetItem(wrap());
      if (result.status !== 'quota') {
        return this._reportSaveResult(result);
      }
    }

    // Tier 3: drop the components that still name a local-only MOC. Removing
    // only their textures would leave them naming a missing alias, which throws
    // on import. Group entries are left alone: cleanupGroupDeserialization
    // discards any that end up with no members.
    const stripped = this._stripLocalMocComponents(layoutData, new Set(localAliases));
    result = this._trySetItem(wrap());
    if (result.status === 'ok') {
      showSnackbar(
        outcome.reason === 'mocLimitReached'
          ? `Your account's MOC limit was reached. ${stripped} custom MOC(s) will not be `
            + 'restored after checkout.'
          : `${stripped} custom MOC(s) could not be saved and will not be restored after `
            + 'checkout.',
        'error'
      );
      return true;
    }

    // Nothing fits. An empty restore is at least honest; a half-written one is not.
    this.clear();
    showSnackbar('Your layout could not be saved and will not be restored.', 'error');
    return false;
  }

  /**
   * Collects the aliases of the local-only MOCs a serialized layout places, and
   * strips the per-layer `mocs` lists, which the import side ignores in favour
   * of the top-level array.
   * @param {LayoutController} layoutController
   * @param {Object} layoutData The serialized layout, modified in place
   * @returns {Array<string>} Aliases of MOCs that are not in the cloud
   * @private
   */
  _takeLocalMocAliases(layoutController, layoutData) {
    const aliases = new Set();
    layoutData.layers.forEach((layer) => {
      if (Array.isArray(layer.mocs)) {
        layer.mocs.forEach((alias) => aliases.add(alias));
        delete layer.mocs;
      }
    });

    const assets = layoutController.trackData.bundles[0].assets;
    // A track that has gone missing entirely is certainly not in the cloud.
    return Array.from(aliases).filter(
      (alias) => !assets.find((track) => track.alias === alias)?.mocId
    );
  }

  /**
   * Removes every component built from one of the given MOC aliases.
   * @param {Object} layoutData The serialized layout, modified in place
   * @param {Set<string>} aliases
   * @returns {number} How many distinct MOCs were actually dropped
   * @private
   */
  _stripLocalMocComponents(layoutData, aliases) {
    const dropped = new Set();
    layoutData.layers.forEach((layer) => {
      layer.components = (layer.components || []).filter((component) => {
        if (!aliases.has(component.type)) {
          return true;
        }
        dropped.add(component.type);
        return false;
      });
    });
    return dropped.size;
  }

  /**
   * Sums what the storage area already holds, excluding this instance's own key
   * since setItem replaces rather than appends to it.
   * @returns {number} Estimated bytes in use
   * @private
   */
  _storageUsageBytes() {
    let total = 0;
    try {
      for (let i = 0; i < this.storage.length; i += 1) {
        const key = this.storage.key(i);
        if (key === this.key) {
          continue;
        }
        total += estimateStorageBytes(key, this.storage.getItem(key) || '');
      }
    } catch (error) {
      // Cannot measure it; let the write itself be the judge.
      return 0;
    }
    return total;
  }

  /**
   * Attempts to store a payload, telling a full storage area apart from one
   * that is switched off. setItem is atomic, so a failure leaves the area and
   * any existing value at the key untouched and the next tier can try again.
   * @param {Object} payload
   * @returns {{status: ('ok'|'quota'|'unavailable')}}
   * @private
   */
  _trySetItem(payload) {
    let serialized;
    try {
      serialized = JSON.stringify(payload);
    } catch (error) {
      console.warn('Unable to serialize layout for preservation:', error.message);
      return { status: 'unavailable' };
    }

    if (estimateStorageBytes(this.key, serialized) + this._storageUsageBytes()
      > STORAGE_BUDGET_BYTES) {
      return { status: 'quota' };
    }

    try {
      this.storage.setItem(this.key, serialized);
    } catch (error) {
      console.warn('Unable to preserve layout to storage:', error.message);
      return { status: isQuotaError(error) ? 'quota' : 'unavailable' };
    }
    return { status: 'ok' };
  }

  /**
   * Tells the user when preservation failed outright. Silent on success.
   * A failed write leaves whatever was already at the key in place, and that
   * could be an earlier, still-fresh save; it is cleared so the restore cannot
   * bring back an older layout than the one the message is about.
   * @param {{status: ('ok'|'quota'|'unavailable')}} result
   * @returns {boolean} True if the payload was stored
   * @private
   */
  _reportSaveResult(result) {
    if (result.status === 'ok') {
      return true;
    }
    this.clear();
    showSnackbar(
      result.status === 'quota'
        ? 'Your layout is too large to save and will not be restored.'
        : 'Your layout could not be saved and will not be restored.',
      'error'
    );
    return false;
  }

  /**
   * Restores a previously preserved layout. Validates the timestamp and ignores
   * data older than maxAgeMs. Cloud references are reloaded from cloud storage
   * (only if the user is still authenticated with cloud access). The storage
   * entry is always removed after a restore attempt with valid, fresh data.
   *
   * A component naming a MOC that nothing has registered is dropped, with a
   * message, rather than failing the whole import. When the caller can say when
   * the user's cloud MOCs will have been registered, the restore waits for that
   * first, but only if the layout actually names a MOC it cannot yet resolve.
   * @param {Object} [options]
   * @param {?Promise<void>} [options.cloudMocsReady] Settles once the signed-in
   *   user's cloud MOCs are registered
   * @returns {Promise<boolean>} True if a layout was restored, false otherwise.
   */
  async restore({ cloudMocsReady = null } = {}) {
    let raw;
    try {
      raw = this.storage.getItem(this.key);
    } catch (error) {
      // Storage unavailable — nothing to restore.
      return false;
    }

    if (!raw) {
      return false;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      // Corrupted data — clean up and return.
      this.clear();
      return false;
    }

    if (!payload.timestamp || (Date.now() - payload.timestamp) > this.maxAgeMs) {
      this.clear();
      return false;
    }

    const layoutController = LayoutController.getInstance();

    if (payload.type === 'cloud') {
      return this._restoreCloudLayout(layoutController, payload, cloudMocsReady);
    }

    if (!payload.layoutData) {
      this.clear();
      return false;
    }

    return this._importPreserved(layoutController, payload.layoutData, null, cloudMocsReady);
  }

  /**
   * Imports a preserved layout. Whatever happens, the entry is cleared: a payload
   * that failed once will fail the same way next time.
   * @param {LayoutController} layoutController
   * @param {SerializedLayout} layoutData
   * @param {?LayoutMetadata} cloudInfo
   * @param {?Promise<void>} cloudMocsReady
   * @returns {Promise<boolean>} True if the layout was imported
   * @private
   */
  async _importPreserved(layoutController, layoutData, cloudInfo, cloudMocsReady) {
    this.droppedMocCount = 0;
    try {
      // Optional so that a stand-in controller without it still restores.
      const unresolved = () => layoutController._unresolvedAliases?.(layoutData) ?? [];
      let missing = unresolved();
      if (missing.length > 0 && cloudMocsReady) {
        // A failed listing only leaves those aliases unresolved, so the strip
        // below handles them; it must not discard the whole layout.
        await Promise.resolve(cloudMocsReady).catch((error) => {
          console.warn('Cloud MOCs could not be loaded before the restore:', error);
        });
        missing = unresolved();
      }
      if (missing.length > 0) {
        // Most likely a MOC that only ever existed in the page that was left.
        this.droppedMocCount = this._stripLocalMocComponents(layoutData, new Set(missing));
        showSnackbar(`${this.droppedMocCount} custom MOC(s) could not be restored.`, 'error');
      }
      if (cloudInfo) {
        await layoutController._importLayout(layoutData, cloudInfo);
      } else {
        await layoutController._importLayout(layoutData);
      }
      return true;
    } catch (error) {
      console.error('Unable to restore the preserved layout:', error);
      // An import that threw part way through can leave some of the layout
      // behind; a clean workspace is easier to trust than a partial one.
      layoutController.reset();
      showSnackbar('Your previous layout could not be restored.', 'error');
      return false;
    } finally {
      this.clear();
    }
  }

  /**
   * Reloads a cloud layout referenced by its cloudId.
   * @param {LayoutController} layoutController
   * @param {{ cloudId: string }} payload
   * @param {?Promise<void>} cloudMocsReady
   * @returns {Promise<boolean>}
   * @private
   */
  async _restoreCloudLayout(layoutController, payload, cloudMocsReady) {
    if (!payload.cloudId) {
      this.clear();
      return false;
    }

    const authManager = await layoutController._getAuthManager();
    const cloudStorage = authManager
      && authManager.isAuthenticated
      && authManager.getCloudFeatures?.()?.cloudStorage;
    if (!cloudStorage) {
      // User is no longer signed in with cloud access — cannot reload.
      this.clear();
      return false;
    }

    let loaded;
    try {
      loaded = await cloudStorage.loadLayout(payload.cloudId);
    } catch (error) {
      console.warn('Unable to reload cloud layout on restore:', error.message);
      this.clear();
      return false;
    }

    if (!loaded || !loaded.layoutData) {
      this.clear();
      return false;
    }

    const imported = await this._importPreserved(layoutController, loaded.layoutData, {
      cloudId: loaded.layoutId,
      s3Key: loaded.s3Key,
      lastSaved: loaded.updatedAt || loaded.createdAt,
      version: loaded.layoutData.version,
      isPublic: loaded.isPublic || false,
      shareCode: loaded.shareCode || null,
    }, cloudMocsReady);
    if (imported && loaded.layoutName) {
      layoutController.setLayoutName(loaded.layoutName);
    }
    return imported;
  }

  /**
   * Removes the preserved layout data from storage.
   * Handles storage unavailability gracefully.
   */
  clear() {
    try {
      this.storage.removeItem(this.key);
    } catch (error) {
      // Storage unavailable — nothing to clean up.
    }
  }
}

/**
 * Restores the layout a previous page load left behind, as found by
 * takePendingPreservation(). Called during startup, before the loading overlay
 * comes off, so the user never sees an empty workspace that then fills in.
 * @param {import('./preservationKeys.js').PendingPreservation} pending
 * @param {Object} [options]
 * @param {?Promise<void>} [options.cloudMocsReady] See {@link LayoutPreservation#restore}
 * @returns {Promise<boolean>} True if a layout was restored
 */
export async function restorePendingLayout({ storage, key, kind }, { cloudMocsReady = null } = {}) {
  const preservation = new LayoutPreservation({ storage, key });
  const restored = await preservation.restore({ cloudMocsReady });
  // The checkout return flow reports on its own; a reload out of the editor
  // would otherwise leave the user wondering where the editor went. This
  // replaces the restore's own note about dropped MOCs, so it carries it.
  if (restored && kind === 'editor') {
    const dropped = preservation.droppedMocCount;
    showSnackbar(
      'The page reloaded while the component editor was open. Your layout has been restored'
        + (dropped > 0 ? `, except for ${dropped} custom MOC(s) that no longer exist.` : '.'),
      dropped > 0 ? 'error' : 'info'
    );
  }
  return restored;
}
