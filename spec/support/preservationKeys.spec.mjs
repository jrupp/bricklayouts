/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import {
  EDITOR_LAYOUT_KEY,
  CHECKOUT_LAYOUT_KEY,
  DEFAULT_MAX_AGE_MS,
  takePendingPreservation,
} from '../../src/utils/preservationKeys.js';

/**
 * These live apart from layoutPreservation.spec.mjs for the same reason the code
 * does: the startup check and the storage keys must be reachable without the
 * LayoutPreservation class, which pulls in LayoutController and the cloud restore
 * path. Importing them here from preservationKeys.js keeps that guarantee under
 * test rather than only asserted in a comment.
 */
describe('Feature: preservation-keys', () => {
  describe('takePendingPreservation', () => {
    const NOW = 1_800_000_000_000;
    let session;
    let local;

    /** A minimal in-memory Storage. */
    const makeStorage = () => {
      const data = new Map();
      return {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => { data.set(key, String(value)); },
        removeItem: (key) => { data.delete(key); },
      };
    };

    const localPayload = (age = 0) => JSON.stringify({
      type: 'local', layoutData: { layers: [] }, timestamp: NOW - age,
    });
    const cloudPayload = (age = 0) => JSON.stringify({
      type: 'cloud', cloudId: 'cloud-1', timestamp: NOW - age,
    });
    const take = (search) => takePendingPreservation(search, { session, local }, NOW);

    beforeEach(() => {
      session = makeStorage();
      local = makeStorage();
    });

    it('finds nothing on an ordinary page load with nothing stored', () => {
      expect(take('')).toBeNull();
    });

    describe('the editor payload', () => {
      it('restores a local layout left by a reload while the editor was open', () => {
        session.setItem(EDITOR_LAYOUT_KEY, localPayload());

        expect(take('')).toEqual({ storage: session, key: EDITOR_LAYOUT_KEY, kind: 'editor' });
      });

      it('drops a cloud layout reference, which can simply be reopened', () => {
        session.setItem(EDITOR_LAYOUT_KEY, cloudPayload());

        expect(take('')).toBeNull();
        expect(session.getItem(EDITOR_LAYOUT_KEY)).toBeNull();
      });

      it('drops a stale or corrupt payload', () => {
        session.setItem(EDITOR_LAYOUT_KEY, localPayload(DEFAULT_MAX_AGE_MS + 1));
        expect(take('')).toBeNull();
        expect(session.getItem(EDITOR_LAYOUT_KEY)).toBeNull();

        session.setItem(EDITOR_LAYOUT_KEY, '{not json');
        expect(take('')).toBeNull();
        expect(session.getItem(EDITOR_LAYOUT_KEY)).toBeNull();
      });
    });

    describe('the checkout payload', () => {
      it('restores it on the return from a completed checkout', () => {
        local.setItem(CHECKOUT_LAYOUT_KEY, localPayload());

        expect(take('?session_id=cs_test_1'))
          .toEqual({ storage: local, key: CHECKOUT_LAYOUT_KEY, kind: 'checkout' });
      });

      it('restores it on the return from a cancelled checkout, cloud layouts included', () => {
        local.setItem(CHECKOUT_LAYOUT_KEY, cloudPayload());

        expect(take('?checkout=cancelled'))
          .toEqual({ storage: local, key: CHECKOUT_LAYOUT_KEY, kind: 'checkout' });
      });

      it('leaves a fresh one alone on any other load, since another tab may be at Stripe', () => {
        local.setItem(CHECKOUT_LAYOUT_KEY, localPayload());

        expect(take('')).toBeNull();
        expect(take('?subscribe=true')).toBeNull();
        expect(local.getItem(CHECKOUT_LAYOUT_KEY)).not.toBeNull();
      });

      it('does not restore it on a portal return, which never preserves a layout', () => {
        local.setItem(CHECKOUT_LAYOUT_KEY, localPayload());

        expect(take('?portal_return=true')).toBeNull();
        expect(local.getItem(CHECKOUT_LAYOUT_KEY)).not.toBeNull();
      });

      it('sweeps a stale one on any load', () => {
        local.setItem(CHECKOUT_LAYOUT_KEY, localPayload(DEFAULT_MAX_AGE_MS + 1));

        expect(take('')).toBeNull();
        expect(local.getItem(CHECKOUT_LAYOUT_KEY)).toBeNull();
      });
    });

    it('prefers the editor payload when a checkout was started from inside the editor', () => {
      // The checkout payload is the editor's scratch workspace; the user's real
      // layout is the one the editor set aside.
      session.setItem(EDITOR_LAYOUT_KEY, localPayload());
      local.setItem(CHECKOUT_LAYOUT_KEY, localPayload());

      expect(take('?session_id=cs_test_1'))
        .toEqual({ storage: session, key: EDITOR_LAYOUT_KEY, kind: 'editor' });
      // Otherwise the return flow would restore the scratch over the top.
      expect(local.getItem(CHECKOUT_LAYOUT_KEY)).toBeNull();
    });

    it('never restores the editor scratch when the editor had a cloud layout open', () => {
      session.setItem(EDITOR_LAYOUT_KEY, cloudPayload());
      local.setItem(CHECKOUT_LAYOUT_KEY, localPayload());

      expect(take('?session_id=cs_test_1')).toBeNull();
      expect(session.getItem(EDITOR_LAYOUT_KEY)).toBeNull();
      expect(local.getItem(CHECKOUT_LAYOUT_KEY)).toBeNull();
    });

    it('treats a storage area that refuses access as nothing to restore', () => {
      const throwing = {
        getItem: () => { throw new Error('unavailable'); },
        removeItem: () => { throw new Error('unavailable'); },
      };

      expect(takePendingPreservation('?session_id=cs_test_1', {
        session: throwing, local: throwing,
      }, NOW)).toBeNull();
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
