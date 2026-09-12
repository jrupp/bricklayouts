/**
 * Storage keys for preserved layouts, and the startup sweep that discards
 * payloads nothing is going to read back.
 *
 * Kept apart from layoutPreservation.js so that index.js can run the sweep
 * without statically importing the LayoutPreservation class, which pulls in
 * LayoutController and the cloud restore path. A visitor who never signs in
 * should not download either.
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
 * Discards preserved payloads that nothing is going to consume.
 *
 * A payload is only ever read back by the flow that wrote it: the editor key by
 * exitEditorMode, the checkout key by the Stripe return handlers. Any other page
 * load leaves it sitting in storage, where a MOC deleted in the meantime turns it
 * into a payload that throws on restore.
 *
 * Note that opening the app in a second tab while a checkout is pending in the
 * first will clear that pending payload, because localStorage is shared across
 * tabs. Stripe redirects the tab it was started from, so this takes a deliberate
 * second tab, and the alternative is stale payloads that live forever.
 * @param {string} search The page's query string (window.location.search)
 * @param {Object} areas
 * @param {Storage} areas.session Where the editor key lives
 * @param {Storage} areas.local Where the checkout key lives
 */
export function clearOrphanedPreservation(search, { session, local }) {
  const params = new URLSearchParams(search || '');
  // A page load is never mid-editor-session: editorMode is a runtime flag that
  // starts out false, so any editor payload present at load is orphaned.
  const returningFromStripe = params.has('session_id')
    || params.get('checkout') === 'cancelled'
    || params.get('portal_return') === 'true';

  try {
    session?.removeItem(EDITOR_LAYOUT_KEY);
    if (!returningFromStripe) {
      local?.removeItem(CHECKOUT_LAYOUT_KEY);
    }
  } catch (error) {
    // Web Storage access itself throws in some privacy modes; nothing to clean.
  }
}
