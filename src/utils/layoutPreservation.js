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
  clearOrphanedPreservation,
} from './preservationKeys.js';

// Re-exported so importers that already treat this module as the entry point for
// preservation keep working. index.js deliberately imports
// clearOrphanedPreservation from preservationKeys.js instead, so that a startup
// sweep does not drag this module, LayoutController and the cloud restore path
// onto a signed-out visitor's critical path.
export { CHECKOUT_LAYOUT_KEY, EDITOR_LAYOUT_KEY, clearOrphanedPreservation };

/**
 * Default maximum age (in ms) for preserved layout data before it's stale.
 * Set to 24 hours.
 * @type {number}
 */
export const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
   *   through as well. Only the checkout instance needs this: the editor is
   *   blocked from deleting MOCs, so its payload's aliases cannot go stale.
   */
  constructor({ storage, key, maxAgeMs = DEFAULT_MAX_AGE_MS, preserveMocs = false }) {
    this.storage = storage;
    this.key = key;
    this.maxAgeMs = maxAgeMs;
    this.preserveMocs = preserveMocs;
  }

  /**
   * Saves the current layout.
   * Cloud layouts are saved to the cloud and stored by reference (cloudId).
   * Local layouts are serialized and stored in full.
   * Handles storage unavailability gracefully by skipping preservation.
   * @returns {Promise<void>}
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
      this._reportSaveResult(this._trySetItem({
        type: 'cloud',
        cloudId: layoutController.layoutMetadata.cloudId,
        timestamp: Date.now(),
      }));
      return;
    }

    await this._saveLocalLayout(layoutController);
  }

  /**
   * Serializes and stores a local layout, falling back through the MOC tiers
   * when the payload will not fit.
   * @param {LayoutController} layoutController
   * @returns {Promise<void>}
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
      this._reportSaveResult(this._trySetItem(wrap()));
      return;
    }

    // Only the MOCs this layout actually places, not everything in the browser.
    // Cloud MOCs contribute nothing: loadCloudMocs() re-registers them on
    // return, and their `src` is a presigned URL that a 24h-old payload would
    // find expired anyway.
    let localAliases = this._takeLocalMocAliases(layoutController, layoutData);
    if (localAliases.length === 0) {
      this._reportSaveResult(this._trySetItem(wrap()));
      return;
    }

    // Tier 1: embed the textures. No network, and the payload becomes fully
    // self-contained, which also makes it immune to a later MOC deletion.
    layoutData.mocs = await layoutController._serializeMocs(localAliases);
    let result = this._trySetItem(wrap());
    if (result.status !== 'quota') {
      this._reportSaveResult(result);
      return;
    }

    // Tier 2: put the MOCs in the cloud instead of in the payload.
    const outcome = await layoutController._ensureMocsInCloud();
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
        this._reportSaveResult(result);
        return;
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
      return;
    }

    // Nothing fits. An empty restore is at least honest; a half-written one is not.
    this.clear();
    showSnackbar('Your layout could not be saved and will not be restored.', 'error');
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
   * @param {{status: ('ok'|'quota'|'unavailable')}} result
   * @private
   */
  _reportSaveResult(result) {
    if (result.status === 'ok') {
      return;
    }
    showSnackbar(
      result.status === 'quota'
        ? 'Your layout is too large to save and will not be restored.'
        : 'Your layout could not be saved and will not be restored.',
      'error'
    );
  }

  /**
   * Restores a previously preserved layout. Validates the timestamp and ignores
   * data older than maxAgeMs. Cloud references are reloaded from cloud storage
   * (only if the user is still authenticated with cloud access). The storage
   * entry is always removed after a restore attempt with valid, fresh data.
   * @returns {Promise<boolean>} True if a layout was restored, false otherwise.
   */
  async restore() {
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
      return this._restoreCloudLayout(layoutController, payload);
    }

    if (!payload.layoutData) {
      this.clear();
      return false;
    }

    await layoutController._importLayout(payload.layoutData);
    this.clear();
    return true;
  }

  /**
   * Reloads a cloud layout referenced by its cloudId.
   * @param {LayoutController} layoutController
   * @param {{ cloudId: string }} payload
   * @returns {Promise<boolean>}
   * @private
   */
  async _restoreCloudLayout(layoutController, payload) {
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

    await layoutController._importLayout(loaded.layoutData, {
      cloudId: loaded.layoutId,
      s3Key: loaded.s3Key,
      lastSaved: loaded.updatedAt || loaded.createdAt,
      version: loaded.layoutData.version,
      isPublic: loaded.isPublic || false,
      shareCode: loaded.shareCode || null,
    });
    if (loaded.layoutName) {
      layoutController.setLayoutName(loaded.layoutName);
    }

    this.clear();
    return true;
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
