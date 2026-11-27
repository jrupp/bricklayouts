/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

/**
 * Storage keys for preserved layouts, and the startup check that decides which
 * of them, if any, this page load should restore.
 *
 * Kept apart from layoutPreservation.js so that index.js can run the check
 * without statically importing the LayoutPreservation class, which pulls in
 * LayoutController and the cloud restore path. A visitor with nothing to
 * restore should not download either.
 * Follows AirBNB JavaScript style guide.
 */

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
 * A preserved layout this page load should restore.
 * @typedef {Object} PendingPreservation
 * @property {Storage} storage The area it is in
 * @property {string} key Its key
 * @property {('editor'|'checkout')} kind Which flow left it behind
 */

/**
 * Reads a preserved payload, discarding it if it is corrupt or stale.
 * @param {Storage} storage
 * @param {string} key
 * @param {number} now
 * @returns {?Object} The payload, or null if there is no usable one
 */
function readFresh(storage, key, now) {
  const raw = storage?.getItem(key);
  if (!raw) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    payload = null;
  }
  if (!payload?.timestamp || now - payload.timestamp > DEFAULT_MAX_AGE_MS) {
    storage.removeItem(key);
    return null;
  }
  return payload;
}

/**
 * Works out which preserved layout, if any, this page load should restore, and
 * discards the ones nothing will ever read back.
 *
 * - Editor (sessionStorage, so it belongs to this tab alone): present at load
 *   only if the page was reloaded or left while the editor was open, which also
 *   cleared the workspace. A local layout is restored. A cloud layout is only a
 *   reference, so it is dropped: reopening it from the cloud loses nothing.
 * - Checkout (localStorage, shared by every tab): restored when this load is a
 *   return from Stripe Checkout. Otherwise it may belong to another tab that is
 *   still at Stripe, so it is left alone unless it has gone stale.
 * - Both: the editor's scratch workspace is never what the user expects back,
 *   so a fresh editor payload always means any checkout one is dropped, even
 *   when the editor payload is a cloud reference that is itself not restored.
 *   The return flow then finds nothing to restore over the top.
 *
 * Storage access itself throws in some privacy modes, which counts as nothing to
 * restore. Reading the `sessionStorage` and `localStorage` globals to pass them
 * in can throw too, before this runs, so the caller must guard that.
 * @param {string} search The page's query string (window.location.search)
 * @param {Object} areas
 * @param {Storage} areas.session Where the editor key lives
 * @param {Storage} areas.local Where the checkout key lives
 * @param {number} [now] The current time, in ms
 * @returns {?PendingPreservation} What to restore, or null for nothing
 */
export function takePendingPreservation(search, areas, now = Date.now()) {
  try {
    return findPending(search, areas, now);
  } catch (error) {
    // Web Storage access itself throws in some privacy modes; nothing to restore.
    return null;
  }
}

/**
 * The body of takePendingPreservation(), which guards it.
 * @param {string} search
 * @param {{session: Storage, local: Storage}} areas
 * @param {number} now
 * @returns {?PendingPreservation}
 */
function findPending(search, { session, local }, now) {
  const params = new URLSearchParams(search || '');
  // The portal redirect does not preserve a layout, so a portal return is not
  // one of these: a payload found then would be from some earlier checkout.
  const returningFromCheckout = params.has('session_id')
    || params.get('checkout') === 'cancelled';

  let pending = null;
  const editor = readFresh(session, EDITOR_LAYOUT_KEY, now);
  if (editor?.type === 'local' && editor.layoutData) {
    pending = { storage: session, key: EDITOR_LAYOUT_KEY, kind: 'editor' };
  } else if (editor) {
    session.removeItem(EDITOR_LAYOUT_KEY);
  }

  // Read even when it will not be restored, so that a stale one is swept.
  const checkout = readFresh(local, CHECKOUT_LAYOUT_KEY, now);
  if (!checkout || !returningFromCheckout) {
    return pending;
  }
  if (editor) {
    local.removeItem(CHECKOUT_LAYOUT_KEY);
    return pending;
  }
  return { storage: local, key: CHECKOUT_LAYOUT_KEY, kind: 'checkout' };
}
