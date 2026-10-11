import {
  EDITOR_LAYOUT_KEY,
  CHECKOUT_LAYOUT_KEY,
  clearOrphanedPreservation,
} from '../../src/utils/preservationKeys.js';

/**
 * These live apart from layoutPreservation.spec.mjs for the same reason the code
 * does: the startup sweep and the storage keys must be reachable without the
 * LayoutPreservation class, which pulls in LayoutController and the cloud restore
 * path. Importing them here from preservationKeys.js keeps that guarantee under
 * test rather than only asserted in a comment.
 */
describe('Feature: preservation-keys', () => {
  describe('clearOrphanedPreservation', () => {
    let session;
    let local;

    beforeEach(() => {
      session = { removeItem: jasmine.createSpy('removeItem') };
      local = { removeItem: jasmine.createSpy('removeItem') };
    });

    it('clears both keys on an ordinary page load', () => {
      clearOrphanedPreservation('', { session, local });

      expect(session.removeItem).toHaveBeenCalledWith(EDITOR_LAYOUT_KEY);
      expect(local.removeItem).toHaveBeenCalledWith(CHECKOUT_LAYOUT_KEY);
    });

    it('keeps the checkout payload when returning from a completed checkout', () => {
      clearOrphanedPreservation('?session_id=cs_test_1', { session, local });

      expect(session.removeItem).toHaveBeenCalledWith(EDITOR_LAYOUT_KEY);
      expect(local.removeItem).not.toHaveBeenCalled();
    });

    it('keeps the checkout payload when returning from a cancelled checkout', () => {
      clearOrphanedPreservation('?checkout=cancelled', { session, local });

      expect(local.removeItem).not.toHaveBeenCalled();
    });

    it('keeps the checkout payload when returning from the billing portal', () => {
      clearOrphanedPreservation('?portal_return=true', { session, local });

      expect(local.removeItem).not.toHaveBeenCalled();
    });

    it('clears both keys for an unrelated query string', () => {
      clearOrphanedPreservation('?subscribe=true', { session, local });

      expect(session.removeItem).toHaveBeenCalledWith(EDITOR_LAYOUT_KEY);
      expect(local.removeItem).toHaveBeenCalledWith(CHECKOUT_LAYOUT_KEY);
    });

    it('always clears the editor key, which a page load can never be using', () => {
      clearOrphanedPreservation('?session_id=cs_test_1&checkout=cancelled', { session, local });

      expect(session.removeItem).toHaveBeenCalledWith(EDITOR_LAYOUT_KEY);
    });

    it('does not propagate a storage area that refuses access', () => {
      const throwing = { removeItem: () => { throw new Error('unavailable'); } };

      expect(() => clearOrphanedPreservation('', { session: throwing, local: throwing }))
        .not.toThrow();
    });
  });

  describe('exported constants', () => {
    it('exposes distinct keys for checkout and editor preservation', () => {
      expect(CHECKOUT_LAYOUT_KEY).toBe('bricklayouts_checkout_layout');
      expect(EDITOR_LAYOUT_KEY).toBe('bricklayouts_editor_layout');
      expect(CHECKOUT_LAYOUT_KEY).not.toBe(EDITOR_LAYOUT_KEY);
    });
  });
});
