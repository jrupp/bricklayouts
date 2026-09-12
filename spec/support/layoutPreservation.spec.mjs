import * as fc from '../support/lib/fast-check.mjs';
import {
  LayoutPreservation,
  EDITOR_LAYOUT_KEY,
  CHECKOUT_LAYOUT_KEY,
  DEFAULT_MAX_AGE_MS,
  STORAGE_BUDGET_BYTES,
  estimateStorageBytes,
  isQuotaError,
  clearOrphanedPreservation,
} from '../../src/utils/layoutPreservation.js';
// eslint-disable-next-line no-unused-vars
import { LayoutController } from '../../src/controller/layoutController.js';

describe('Feature: layout-preservation', () => {
  const TEST_KEY = 'bricklayouts_test_layout';

  let mockLayoutController;
  let layoutControllerSpy;
  let importedData;
  let importedCloudInfo;

  beforeEach(() => {
    importedData = null;
    importedCloudInfo = null;

    mockLayoutController = {
      isCloudLayout: jasmine.createSpy('isCloudLayout').and.returnValue(false),
      getLayoutName: jasmine.createSpy('getLayoutName').and.returnValue(null),
      setLayoutName: jasmine.createSpy('setLayoutName'),
      workspace: { x: 0, y: 0, scale: { x: 1 } },
      layers: [],
      layoutMetadata: {},
      config: {
        serializeWorkspaceSettings: jasmine.createSpy('serializeWorkspaceSettings')
          .and.returnValue({}),
      },
      _saveToCloud: jasmine.createSpy('_saveToCloud').and.returnValue(Promise.resolve(true)),
      _getAuthManager: jasmine.createSpy('_getAuthManager').and.returnValue(Promise.resolve(null)),
      _importLayout: jasmine.createSpy('_importLayout')
        .and.callFake(async (data, cloudInfo = null) => {
          importedData = data;
          importedCloudInfo = cloudInfo;
        }),
    };

    layoutControllerSpy = spyOn(LayoutController, 'getInstance')
      .and.returnValue(mockLayoutController);

    sessionStorage.removeItem(TEST_KEY);
  });

  afterEach(() => {
    sessionStorage.removeItem(TEST_KEY);
    layoutControllerSpy.and.callThrough();
  });

  const newService = () => new LayoutPreservation({ storage: sessionStorage, key: TEST_KEY });

  const layerArbitrary = fc.record({
    name: fc.string({ minLength: 0, maxLength: 20 }),
    visible: fc.boolean(),
    components: fc.array(
      fc.record({
        type: fc.string({ minLength: 1, maxLength: 30 }),
        x: fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true })
          .map((v) => (Object.is(v, -0) ? 0 : v)),
        y: fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true })
          .map((v) => (Object.is(v, -0) ? 0 : v)),
        rotation: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
        flipped: fc.boolean(),
      }),
      { minLength: 0, maxLength: 5 }
    ),
  });

  const configArbitrary = fc.record({
    backgroundColor: fc.hexaString({ minLength: 6, maxLength: 6 }),
    gridEnabled: fc.boolean(),
    gridSize: fc.integer({ min: 1, max: 100 }),
  });

  const layoutDataArbitrary = fc.record({
    version: fc.integer({ min: 1, max: 10 }),
    date: fc.integer({ min: 0, max: Date.now() + 1000000 }),
    x: fc.double({ min: -5000, max: 5000, noNaN: true })
      .map((v) => (Object.is(v, -0) ? 0 : v)),
    y: fc.double({ min: -5000, max: 5000, noNaN: true })
      .map((v) => (Object.is(v, -0) ? 0 : v)),
    zoom: fc.double({ min: 0.1, max: 10, noNaN: true }),
    layers: fc.array(layerArbitrary, { minLength: 1, maxLength: 3 }),
    config: configArbitrary,
  });

  const configureLocalLayout = (layoutData, layoutName = null) => {
    mockLayoutController.isCloudLayout.and.returnValue(false);
    mockLayoutController.workspace = {
      x: layoutData.x,
      y: layoutData.y,
      scale: { x: layoutData.zoom },
    };
    mockLayoutController.layers = layoutData.layers.map((layer) => ({
      serialize: () => layer,
      children: layer.components,
    }));
    mockLayoutController.config.serializeWorkspaceSettings.and.returnValue(layoutData.config);
    mockLayoutController.getLayoutName.and.returnValue(layoutName);
  };

  describe('Property: local layout round-trip through storage', () => {
    it('round-trips arbitrary local layout data', async () => {
      await fc.assert(
        fc.asyncProperty(layoutDataArbitrary, async (layoutData) => {
          configureLocalLayout(layoutData);
          const service = newService();

          await service.save();

          expect(sessionStorage.getItem(TEST_KEY)).not.toBeNull();

          importedData = null;
          const restored = await service.restore();

          expect(restored).toBeTrue();
          expect(importedData).not.toBeNull();
          expect(importedData.x).toBe(layoutData.x);
          expect(importedData.y).toBe(layoutData.y);
          expect(importedData.zoom).toBe(layoutData.zoom);
          expect(importedData.layers.length).toBe(layoutData.layers.length);
          for (let i = 0; i < layoutData.layers.length; i++) {
            expect(importedData.layers[i]).toEqual(layoutData.layers[i]);
          }
          expect(importedData.config).toEqual(layoutData.config);
          expect(sessionStorage.getItem(TEST_KEY)).toBeNull();
        }),
        { numRuns: 20 }
      );
    });

    it('round-trips local layout data with metadata (named layouts)', async () => {
      await fc.assert(
        fc.asyncProperty(
          layoutDataArbitrary,
          fc.string({ minLength: 1, maxLength: 50 }),
          async (layoutData, layoutName) => {
            configureLocalLayout(layoutData, layoutName);
            const service = newService();

            await service.save();

            importedData = null;
            const restored = await service.restore();

            expect(restored).toBeTrue();
            expect(importedData).not.toBeNull();
            expect(importedData.metadata).toBeDefined();
            expect(importedData.metadata.name).toBe(layoutName);
            expect(sessionStorage.getItem(TEST_KEY)).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property: cloud layout stored by reference', () => {
    it('stores only the cloudId and reloads from cloud on restore', async () => {
      const loadedLayout = {
        layoutId: 'cloud-123',
        layoutName: 'My Cloud Layout',
        s3Key: 'layouts/cloud-123.json',
        updatedAt: '2026-01-01T00:00:00Z',
        layoutData: {
          version: 2,
          x: 5,
          y: 6,
          zoom: 1.5,
          layers: [{ name: 'Layer 1', visible: true, components: [] }],
          config: {},
        },
      };
      const cloudStorage = {
        loadLayout: jasmine.createSpy('loadLayout').and.returnValue(Promise.resolve(loadedLayout)),
      };
      const authManager = {
        isAuthenticated: true,
        getCloudFeatures: jasmine.createSpy('getCloudFeatures').and.returnValue({ cloudStorage }),
      };

      mockLayoutController.isCloudLayout.and.returnValue(true);
      mockLayoutController.getLayoutName.and.returnValue('My Cloud Layout');
      mockLayoutController.layoutMetadata = { cloudId: 'cloud-123' };
      mockLayoutController._getAuthManager.and.returnValue(Promise.resolve(authManager));

      const service = newService();
      await service.save();

      // Persisted edits to cloud, and stored only a reference.
      expect(mockLayoutController._saveToCloud).toHaveBeenCalledWith('My Cloud Layout');
      const stored = JSON.parse(sessionStorage.getItem(TEST_KEY));
      expect(stored.type).toBe('cloud');
      expect(stored.cloudId).toBe('cloud-123');
      expect(stored.layoutData).toBeUndefined();

      const restored = await service.restore();

      expect(restored).toBeTrue();
      expect(cloudStorage.loadLayout).toHaveBeenCalledWith('cloud-123');
      expect(importedData).toEqual(loadedLayout.layoutData);
      expect(importedCloudInfo).toEqual(jasmine.objectContaining({
        cloudId: 'cloud-123',
        s3Key: 'layouts/cloud-123.json',
        lastSaved: '2026-01-01T00:00:00Z',
      }));
      expect(mockLayoutController.setLayoutName).toHaveBeenCalledWith('My Cloud Layout');
      expect(sessionStorage.getItem(TEST_KEY)).toBeNull();
    });

    it('does not restore a cloud layout when the user is no longer signed in', async () => {
      mockLayoutController.isCloudLayout.and.returnValue(true);
      mockLayoutController.getLayoutName.and.returnValue('My Cloud Layout');
      mockLayoutController.layoutMetadata = { cloudId: 'cloud-123' };
      mockLayoutController._getAuthManager.and.returnValue(Promise.resolve(null));

      const service = newService();
      await service.save();

      const restored = await service.restore();

      expect(restored).toBeFalse();
      expect(importedData).toBeNull();
      expect(sessionStorage.getItem(TEST_KEY)).toBeNull();
    });

    // showSnackbar reuses a single #cloudSnackbar element, so seed it with a
    // sentinel rather than relying on its absence — leftovers from other specs
    // would otherwise make these assertions depend on execution order.
    const seedSnackbar = () => {
      let snackbar = document.getElementById('cloudSnackbar');
      if (!snackbar) {
        snackbar = document.createElement('div');
        snackbar.id = 'cloudSnackbar';
        document.body.appendChild(snackbar);
      }
      snackbar.textContent = 'SENTINEL';
      return snackbar;
    };

    it('warns but keeps going when the cloud save fails', async () => {
      // A failed cloud save (offline, a declined MOC upload prompt, a rejected
      // request) must not stop the caller from proceeding into editor mode.
      mockLayoutController.isCloudLayout.and.returnValue(true);
      mockLayoutController.getLayoutName.and.returnValue('My Cloud Layout');
      mockLayoutController.layoutMetadata = { cloudId: 'cloud-123' };
      mockLayoutController._saveToCloud.and.returnValue(Promise.resolve(false));
      const snackbar = seedSnackbar();

      const service = newService();
      await service.save();

      expect(snackbar.textContent).toContain('Recent changes may be lost');

      // The cloud reference is still preserved, so the restore brings back the
      // last successfully saved copy rather than nothing at all.
      const stored = JSON.parse(sessionStorage.getItem(TEST_KEY));
      expect(stored.type).toBe('cloud');
      expect(stored.cloudId).toBe('cloud-123');
      expect(stored.layoutData).toBeUndefined();
    });

    it('does not warn when the cloud save succeeds', async () => {
      mockLayoutController.isCloudLayout.and.returnValue(true);
      mockLayoutController.getLayoutName.and.returnValue('My Cloud Layout');
      mockLayoutController.layoutMetadata = { cloudId: 'cloud-123' };
      const snackbar = seedSnackbar();

      const service = newService();
      await service.save();

      expect(snackbar.textContent).toBe('SENTINEL');
    });
  });

  describe('Property: stale and corrupt data handling', () => {
    it('ignores stale layout data older than maxAgeMs', async () => {
      const staleData = {
        type: 'local',
        layoutData: {
          version: 1, x: 0, y: 0, zoom: 1, layers: [], config: {},
        },
        timestamp: Date.now() - DEFAULT_MAX_AGE_MS - 1000,
      };
      sessionStorage.setItem(TEST_KEY, JSON.stringify(staleData));

      const restored = await newService().restore();

      expect(restored).toBeFalse();
      expect(importedData).toBeNull();
      expect(sessionStorage.getItem(TEST_KEY)).toBeNull();
    });

    it('handles corrupted JSON gracefully and cleans up', async () => {
      sessionStorage.setItem(TEST_KEY, '{not valid json!!!');

      const restored = await newService().restore();

      expect(restored).toBeFalse();
      expect(importedData).toBeNull();
      expect(sessionStorage.getItem(TEST_KEY)).toBeNull();
    });

    it('returns false when there is nothing to restore', async () => {
      const restored = await newService().restore();
      expect(restored).toBeFalse();
      expect(importedData).toBeNull();
    });
  });

  describe('Property: storage unavailability is handled gracefully', () => {
    const throwingStorage = {
      getItem: () => { throw new Error('unavailable'); },
      setItem: () => { throw new Error('unavailable'); },
      removeItem: () => { throw new Error('unavailable'); },
    };

    it('save does not throw when storage is unavailable', async () => {
      configureLocalLayout({
        version: 2, date: 0, x: 0, y: 0, zoom: 1,
        layers: [{ name: 'L', visible: true, components: [] }],
        config: {},
      });
      const service = new LayoutPreservation({ storage: throwingStorage, key: TEST_KEY });
      await expectAsync(service.save()).toBeResolved();
    });

    it('restore returns false when storage is unavailable', async () => {
      const service = new LayoutPreservation({ storage: throwingStorage, key: TEST_KEY });
      await expectAsync(service.restore()).toBeResolvedTo(false);
    });
  });

  describe('storage budgeting helpers', () => {
    it('charges two bytes per character, including the key', () => {
      expect(estimateStorageBytes('ab', 'cde')).toBe(10);
      expect(estimateStorageBytes('', '')).toBe(0);
    });

    it('recognizes a full storage area across browsers', () => {
      expect(isQuotaError({ name: 'QuotaExceededError' })).toBeTrue();
      expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBeTrue();
      expect(isQuotaError({ code: 22 })).toBeTrue();
      expect(isQuotaError({ code: 1014 })).toBeTrue();
    });

    it('does not mistake disabled storage for a full one', () => {
      // SecurityError means no tier will help, so it must not look like quota.
      expect(isQuotaError({ name: 'SecurityError' })).toBeFalse();
      expect(isQuotaError(new Error('nope'))).toBeFalse();
      expect(isQuotaError(null)).toBeFalse();
    });
  });

  describe('carrying MOCs through checkout', () => {
    const MOC_KEY = 'bricklayouts_moc_test_layout';
    let storage;
    let trackA;
    let trackB;

    /** A storage stub whose next writes can be made to fail on demand. */
    const makeStorage = () => {
      const data = new Map();
      const stub = {
        failures: [],
        get length() { return data.size; },
        key: (i) => Array.from(data.keys())[i],
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => {
          const failure = stub.failures.shift();
          if (failure) {
            const error = new Error(failure);
            error.name = failure === 'quota' ? 'QuotaExceededError' : 'SecurityError';
            throw error;
          }
          data.set(key, value);
        },
        removeItem: (key) => { data.delete(key); },
      };
      return stub;
    };

    const seedSnackbar = () => {
      let snackbar = document.getElementById('cloudSnackbar');
      if (!snackbar) {
        snackbar = document.createElement('div');
        snackbar.id = 'cloudSnackbar';
        document.body.appendChild(snackbar);
      }
      snackbar.textContent = 'SENTINEL';
      return snackbar;
    };

    /**
     * Builds a layer whose serialize() re-reads the tracks it places, so a
     * re-key during an upload shows up in a later serialization exactly as it
     * does in the real LayoutLayer.
     */
    const layerOver = (tracks) => ({
      serialize: () => ({
        name: 'L',
        visible: true,
        opacity: 100,
        components: tracks.map((track) => ({ type: track.alias, pose: {} })),
        mocs: tracks.filter((track) => track.mine).map((track) => track.alias),
      }),
    });

    const newService = (options = {}) => new LayoutPreservation({
      storage, key: MOC_KEY, preserveMocs: true, ...options,
    });

    const storedLayout = () => JSON.parse(storage.getItem(MOC_KEY)).layoutData;

    beforeEach(() => {
      storage = makeStorage();
      trackA = { alias: 'localA', name: 'A', mine: 1 };
      trackB = { alias: 'localB', name: 'B', mine: 1 };

      mockLayoutController.isCloudLayout.and.returnValue(false);
      mockLayoutController.trackData = { bundles: [{ assets: [trackA, trackB] }] };
      mockLayoutController.layers = [layerOver([trackA])];
      mockLayoutController._serializeMocs = jasmine.createSpy('_serializeMocs')
        .and.callFake((aliases) => Promise.resolve(aliases.map((alias) => ({
          name: alias, textureData: 'data:image/png;base64,AAAA',
        }))));
      mockLayoutController._ensureMocsInCloud = jasmine.createSpy('_ensureMocsInCloud')
        .and.returnValue(Promise.resolve({ ok: true, reason: null, limit: null }));
    });

    it('leaves MOCs alone for the editor instance', async () => {
      // The editor blocks MOC deletion, so its payload cannot go stale.
      await newService({ preserveMocs: false }).save();

      expect(mockLayoutController._serializeMocs).not.toHaveBeenCalled();
      expect(storedLayout().mocs).toBeUndefined();
    });

    it('embeds the textures of the local MOCs the layout places', async () => {
      await newService().save();

      expect(storedLayout().mocs[0].textureData).toBe('data:image/png;base64,AAAA');
      expect(mockLayoutController._ensureMocsInCloud).not.toHaveBeenCalled();
    });

    it('embeds only the MOCs the layout actually places', async () => {
      // trackB is available in the browser but not placed anywhere.
      await newService().save();

      expect(mockLayoutController._serializeMocs).toHaveBeenCalledWith(['localA']);
    });

    it('skips MOCs that are already in the cloud, and never stores their src', async () => {
      // A presigned URL would be long expired by the time a 24h payload restores.
      trackA.mocId = 'uuid-1';
      trackA.src = 'https://s3.example.com/presigned?X-Amz-Signature=abc';

      await newService().save();

      expect(mockLayoutController._serializeMocs).not.toHaveBeenCalled();
      expect(storedLayout().mocs).toBeUndefined();
      expect(storage.getItem(MOC_KEY)).not.toContain('X-Amz-Signature');
    });

    it('strips the per-layer mocs lists the import side ignores', async () => {
      await newService().save();

      expect(storedLayout().layers[0].mocs).toBeUndefined();
    });

    it('uploads to the cloud and re-serializes when the textures do not fit', async () => {
      storage.failures = ['quota'];
      mockLayoutController._ensureMocsInCloud.and.callFake(() => {
        // saveMocToCloud re-keys the track in place.
        trackA.alias = 'mocuuid-1';
        trackA.mocId = 'uuid-1';
        return Promise.resolve({ ok: true, reason: null, limit: null });
      });

      await newService().save();

      expect(mockLayoutController._ensureMocsInCloud).toHaveBeenCalled();
      // The pre-upload serialization named 'localA', which no longer resolves.
      expect(storedLayout().layers[0].components[0].type).toBe('mocuuid-1');
      expect(storedLayout().mocs).toBeUndefined();
    });

    it('drops the local components when the upload does not happen', async () => {
      // Tier 1 is the only write attempted before tier 3: a declined upload
      // never reaches a write of its own.
      storage.failures = ['quota'];
      mockLayoutController._ensureMocsInCloud.and.returnValue(
        Promise.resolve({ ok: false, reason: 'declined', limit: null })
      );
      const snackbar = seedSnackbar();

      await newService().save();

      expect(storedLayout().layers[0].components.length).toBe(0);
      expect(storedLayout().mocs).toBeUndefined();
      expect(snackbar.textContent).toContain('1 custom MOC(s) could not be saved');
    });

    it('keeps the MOCs that uploaded before the account hit its limit', async () => {
      // The regression test for the partial-upload case: the tracks that did
      // upload have been re-keyed in place, so tier 3 has to re-serialize
      // before stripping or it leaves them naming an alias that is gone.
      mockLayoutController.layers = [layerOver([trackA, trackB])];
      storage.failures = ['quota'];
      mockLayoutController._ensureMocsInCloud.and.callFake(() => {
        trackA.alias = 'mocuuid-1';
        trackA.mocId = 'uuid-1';
        return Promise.resolve({ ok: false, reason: 'mocLimitReached', limit: 10 });
      });
      const snackbar = seedSnackbar();

      await newService().save();

      const types = storedLayout().layers[0].components.map((component) => component.type);
      expect(types).toEqual(['mocuuid-1']);
      expect(types).not.toContain('localA');
      expect(storedLayout().mocs).toBeUndefined();
      expect(snackbar.textContent).toContain("Your account's MOC limit was reached");
      expect(snackbar.textContent).toContain('1 custom MOC(s)');
    });

    it('gives up cleanly when nothing fits at all', async () => {
      storage.setItem(MOC_KEY, 'stale');
      storage.failures = ['quota', 'quota'];
      mockLayoutController._ensureMocsInCloud.and.returnValue(
        Promise.resolve({ ok: false, reason: 'uploadFailed', limit: null })
      );
      const snackbar = seedSnackbar();

      await newService().save();

      // An empty restore is honest; a half-written one is not.
      expect(storage.getItem(MOC_KEY)).toBeNull();
      expect(snackbar.textContent).toContain('could not be saved');
    });

    it('does not attempt an upload when storage is switched off', async () => {
      storage.failures = ['security'];
      const snackbar = seedSnackbar();

      await newService().save();

      expect(mockLayoutController._ensureMocsInCloud).not.toHaveBeenCalled();
      expect(snackbar.textContent).toContain('could not be saved');
    });

    it('refuses a payload that is over the storage budget before writing it', async () => {
      // The pre-check keeps an obviously hopeless write from being attempted.
      mockLayoutController._serializeMocs.and.returnValue(Promise.resolve([{
        name: 'A', textureData: 'x'.repeat(STORAGE_BUDGET_BYTES / 2),
      }]));
      mockLayoutController._ensureMocsInCloud.and.returnValue(
        Promise.resolve({ ok: false, reason: 'declined', limit: null })
      );
      seedSnackbar();

      await newService().save();

      expect(mockLayoutController._ensureMocsInCloud).toHaveBeenCalled();
      expect(storedLayout().layers[0].components.length).toBe(0);
    });
  });

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
