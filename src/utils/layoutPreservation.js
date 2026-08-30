/**
 * LayoutPreservation - Temporarily saves and restores the current layout.
 * Used to preserve a user's work while they are redirected away (Stripe
 * checkout) or while they are in the component editor. Backed by either
 * localStorage or sessionStorage depending on how long the data must survive.
 * Follows AirBNB JavaScript style guide.
 */

import { LayoutController, CurrentFormatVersion } from '../controller/layoutController.js';

/**
 * localStorage key for preserving layout data during Stripe checkout redirects.
 * @type {string}
 */
export const CHECKOUT_LAYOUT_KEY = 'bricklayouts_checkout_layout';

/**
 * sessionStorage key for preserving layout data while in the component editor.
 * @type {string}
 */
export const EDITOR_LAYOUT_KEY = 'bricklayouts_editor_layout';

/**
 * Default maximum age (in ms) for preserved layout data before it's stale.
 * Set to 24 hours.
 * @type {number}
 */
export const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
   */
  constructor({ storage, key, maxAgeMs = DEFAULT_MAX_AGE_MS }) {
    this.storage = storage;
    this.key = key;
    this.maxAgeMs = maxAgeMs;
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
    let payload;

    if (layoutController.isCloudLayout()) {
      // Persist any edits, then store only a reference to the cloud layout.
      await layoutController._saveToCloud(layoutController.getLayoutName());
      payload = {
        type: 'cloud',
        cloudId: layoutController.layoutMetadata.cloudId,
        timestamp: Date.now(),
      };
    } else {
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

      payload = {
        type: 'local',
        layoutData,
        timestamp: Date.now(),
      };
    }

    try {
      this.storage.setItem(this.key, JSON.stringify(payload));
    } catch (error) {
      // Storage unavailable or full — skip preservation.
      console.warn('Unable to preserve layout to storage:', error.message);
    }
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
