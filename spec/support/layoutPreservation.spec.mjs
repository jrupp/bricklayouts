import * as fc from '../support/lib/fast-check.mjs';
import {
  LayoutPreservation,
  EDITOR_LAYOUT_KEY,
  CHECKOUT_LAYOUT_KEY,
  DEFAULT_MAX_AGE_MS,
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
      _saveToCloud: jasmine.createSpy('_saveToCloud').and.returnValue(Promise.resolve()),
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

  describe('exported constants', () => {
    it('exposes distinct keys for checkout and editor preservation', () => {
      expect(CHECKOUT_LAYOUT_KEY).toBe('bricklayouts_checkout_layout');
      expect(EDITOR_LAYOUT_KEY).toBe('bricklayouts_editor_layout');
      expect(CHECKOUT_LAYOUT_KEY).not.toBe(EDITOR_LAYOUT_KEY);
    });
  });
});
