import { LayoutController } from "../../src/controller/layoutController.js";
import { Component } from "../../src/model/component.js";
import { Assets } from "../../src/pixi.mjs";

/**
 * A minimal stand-in for a placed Component that satisfies the `instanceof`
 * check without building the full PixiJS display object.
 */
function makeComponent(baseData) {
  const component = Object.create(Component.prototype);
  component.baseData = baseData;
  return component;
}

describe("LayoutController cloud MOCs", function () {
  describe("saveMocToCloud", function () {
    let controller;
    let cloudStorage;
    let originalFetch;

    beforeEach(function () {
      controller = Object.create(LayoutController.prototype);
      cloudStorage = {
        createMoc: jasmine.createSpy('createMoc')
          .and.returnValue(Promise.resolve({ mocId: 'uuid-1', uploadUrl: 'https://up.example' })),
        uploadMocImage: jasmine.createSpy('uploadMocImage')
          .and.returnValue(Promise.resolve(true)),
        updateMoc: jasmine.createSpy('updateMoc')
          .and.returnValue(Promise.resolve({ mocId: 'uuid-1', updatedAt: 'now' })),
      };
      spyOn(controller, '_getCloudStorage').and.returnValue(Promise.resolve(cloudStorage));
      spyOn(controller, 'createComponentBrowser').and.stub();
      originalFetch = globalThis.fetch;
      globalThis.fetch = () => Promise.resolve({
        blob: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })),
      });
    });

    afterEach(function () {
      globalThis.fetch = originalFetch;
      Assets.cache.remove('myMoc');
      Assets.cache.remove('mocuuid-1');
    });

    it("creates the MOC, uploads the image, and re-keys the alias", async function () {
      const track = {
        alias: 'myMoc', name: 'My MOC', category: 'structures', scale: 1, type: 'track',
      };
      controller.trackData = { bundles: [{ assets: [track] }] };
      Assets.cache.set('myMoc', { id: 'texture' });
      spyOn(controller, '_serializeMocs').and.returnValue(Promise.resolve([{
        name: 'My MOC',
        category: 'structures',
        scale: 1,
        type: 'track',
        textureData: 'data:image/png;base64,AAAA',
      }]));

      const newAlias = await controller.saveMocToCloud('myMoc');

      expect(newAlias).toBe('mocuuid-1');
      expect(cloudStorage.createMoc).toHaveBeenCalledWith({
        name: 'My MOC', category: 'structures', scale: 1, type: 'track', onbp: null,
      });
      expect(cloudStorage.uploadMocImage)
        .toHaveBeenCalledWith('https://up.example', jasmine.any(Blob));
      expect(track.alias).toBe('mocuuid-1');
      expect(track.mocId).toBe('uuid-1');
      expect(Assets.cache.has('mocuuid-1')).toBeTrue();
      expect(Assets.cache.has('myMoc')).toBeFalse();
    });

    it("updates metadata for an already-committed MOC without re-creating", async function () {
      const track = {
        alias: 'mocuuid-1', mocId: 'uuid-1', name: 'X',
        category: 'structures', scale: 1, type: 'track', onbp: 0x237841,
      };
      controller.trackData = { bundles: [{ assets: [track] }] };
      const serializeSpy = spyOn(controller, '_serializeMocs');

      const result = await controller.saveMocToCloud('mocuuid-1');

      expect(result).toBeNull();
      expect(cloudStorage.updateMoc).toHaveBeenCalledWith('uuid-1', {
        name: 'X', category: 'structures', scale: 1, type: 'track', onbp: '#237841',
      });
      expect(cloudStorage.createMoc).not.toHaveBeenCalled();
      expect(serializeSpy).not.toHaveBeenCalled();
    });

    it("sends null for cloud fields that have been cleared locally", async function () {
      // The MOC previously had a baseplate color; the user has since removed it.
      const track = { alias: 'mocuuid-1', mocId: 'uuid-1', name: 'X', type: 'track' };
      controller.trackData = { bundles: [{ assets: [track] }] };

      await controller.saveMocToCloud('mocuuid-1');

      expect(cloudStorage.updateMoc).toHaveBeenCalledWith('uuid-1', {
        name: 'X', category: null, scale: null, type: 'track', onbp: null,
      });
    });

    it("does nothing when cloud storage is unavailable", async function () {
      controller._getCloudStorage.and.returnValue(Promise.resolve(null));
      controller.trackData = { bundles: [{ assets: [{ alias: 'myMoc' }] }] };

      const result = await controller.saveMocToCloud('myMoc');

      expect(result).toBeNull();
      expect(cloudStorage.createMoc).not.toHaveBeenCalled();
      expect(cloudStorage.updateMoc).not.toHaveBeenCalled();
    });

    it("resolves to null instead of throwing when the cloud save fails", async function () {
      const track = { alias: 'mocuuid-1', mocId: 'uuid-1', name: 'X', type: 'track' };
      controller.trackData = { bundles: [{ assets: [track] }] };
      cloudStorage.updateMoc.and.returnValue(Promise.reject(new Error('boom')));
      spyOn(console, 'error');

      await expectAsync(controller.saveMocToCloud('mocuuid-1')).toBeResolvedTo(null);
    });

    it("resolves to null instead of throwing when cloud storage lookup fails", async function () {
      controller._getCloudStorage.and.returnValue(Promise.reject(new Error('offline')));
      spyOn(console, 'error');

      await expectAsync(controller.saveMocToCloud('myMoc')).toBeResolvedTo(null);
    });
  });

  describe("loadCloudMocs", function () {
    let controller;
    let cloudStorage;

    beforeEach(function () {
      controller = Object.create(LayoutController.prototype);
      cloudStorage = {
        listMocs: jasmine.createSpy('listMocs').and.returnValue(Promise.resolve([
          { alias: 'mocuuid-1', mocId: 'uuid-1', src: 'https://img.example/a.png', name: 'A' },
        ])),
      };
      spyOn(controller, '_getCloudStorage').and.returnValue(Promise.resolve(cloudStorage));
      spyOn(controller, '_loadLayoutMocs').and.returnValue(Promise.resolve());
    });

    it("lists MOCs and hands them to the shared MOC loader", async function () {
      controller.trackData = { bundles: [{ assets: [] }] };

      await controller.loadCloudMocs();

      expect(cloudStorage.listMocs).toHaveBeenCalled();
      expect(controller._loadLayoutMocs).toHaveBeenCalledWith([
        { alias: 'mocuuid-1', mocId: 'uuid-1', src: 'https://img.example/a.png', name: 'A' },
      ]);
    });

    it("does nothing when cloud storage is unavailable", async function () {
      controller._getCloudStorage.and.returnValue(Promise.resolve(null));

      await controller.loadCloudMocs();

      expect(cloudStorage.listMocs).not.toHaveBeenCalled();
      expect(controller._loadLayoutMocs).not.toHaveBeenCalled();
    });

    it("swallows errors so a failed MOC load never breaks startup", async function () {
      cloudStorage.listMocs.and.returnValue(Promise.reject(new Error('offline')));
      spyOn(console, 'error');

      await expectAsync(controller.loadCloudMocs()).toBeResolved();
      expect(controller._loadLayoutMocs).not.toHaveBeenCalled();
    });
  });

  describe("_loadLayoutMocs cloud ids", function () {
    it("stamps the cloud id onto tracks that carry one", async function () {
      const controller = Object.create(LayoutController.prototype);
      const assets = [];
      controller.trackData = { bundles: [{ assets }] };
      spyOn(controller, 'createComponentBrowser').and.stub();
      spyOn(controller, '_backgroundLoadRemaining').and.stub();

      await controller._loadLayoutMocs([
        { alias: 'mocuuid-9', mocId: 'uuid-9', src: 'https://img.example/b.png', name: 'B' },
        { alias: 'localMoc', textureData: null, src: 'https://img.example/c.png', name: 'C' },
      ]);

      expect(assets.find((t) => t.alias === 'mocuuid-9').mocId).toBe('uuid-9');
      expect(assets.find((t) => t.alias === 'localMoc').mocId).toBeUndefined();
    });
  });

  describe("removeCloudMocs", function () {
    let controller;

    beforeEach(function () {
      controller = Object.create(LayoutController.prototype);
      controller.layers = [];
      spyOn(controller, 'createComponentBrowser').and.stub();
    });

    afterEach(function () {
      Assets.cache.remove('mocuuid-1');
      Assets.cache.remove('mocuuid-2');
    });

    it("removes unused cloud MOCs and their cached textures", function () {
      const assets = [
        { alias: 'plain' },
        { alias: 'localMoc', mine: 1 },
        { alias: 'mocuuid-1', mocId: 'uuid-1', mine: 1 },
      ];
      controller.trackData = { bundles: [{ assets }] };
      Assets.cache.set('mocuuid-1', { id: 'texture' });

      expect(controller.removeCloudMocs()).toBe(1);

      expect(assets.map((t) => t.alias)).toEqual(['plain', 'localMoc']);
      expect(Assets.cache.has('mocuuid-1')).toBeFalse();
      expect(controller.createComponentBrowser).toHaveBeenCalled();
    });

    it("keeps MOCs still placed in the layout but clears their cloud id", function () {
      const placed = { alias: 'mocuuid-1', mocId: 'uuid-1', mine: 1 };
      const unused = { alias: 'mocuuid-2', mocId: 'uuid-2', mine: 1 };
      const assets = [placed, unused];
      controller.trackData = { bundles: [{ assets }] };
      // A component holds its track by reference, exactly as _loadLayoutMocs leaves it.
      controller.layers = [{ children: [makeComponent(placed)] }];

      expect(controller.removeCloudMocs()).toBe(1);

      expect(assets).toEqual([placed]);
      expect(placed.mocId).toBeUndefined();
      expect(placed.alias).toBe('mocuuid-1');
    });

    it("leaves local MOCs and stock tracks alone", function () {
      const assets = [{ alias: 'plain' }, { alias: 'localMoc', mine: 1 }];
      controller.trackData = { bundles: [{ assets }] };

      expect(controller.removeCloudMocs()).toBe(0);

      expect(assets.length).toBe(2);
      expect(controller.createComponentBrowser).not.toHaveBeenCalled();
    });

  });

  describe("_loadLayoutMocs texture failures", function () {
    let controller;
    let assets;

    beforeEach(function () {
      controller = Object.create(LayoutController.prototype);
      assets = [];
      controller.trackData = { bundles: [{ assets }] };
      spyOn(controller, 'createComponentBrowser').and.stub();
      spyOn(controller, '_backgroundLoadRemaining').and.stub();
      spyOn(controller, 'extractTrackImage').and.returnValue(Promise.resolve({}));
      spyOn(console, 'error');
    });

    afterEach(function () {
      ['brokenMoc', 'dupeMoc'].forEach((alias) => {
        if (Assets.cache.has(alias)) {
          Assets.cache.remove(alias);
        }
      });
    });

    it("caches nothing when the embedded texture cannot be decoded", async function () {
      await controller._loadLayoutMocs([
        { alias: 'brokenMoc', textureData: 'not-a-data-url', name: 'Broken' },
      ]);

      expect(assets.length).toBe(0);
      expect(Assets.cache.has('brokenMoc')).toBeFalse();
    });

    it("still background-loads an alias whose embedded texture failed earlier", async function () {
      await controller._loadLayoutMocs([
        { alias: 'dupeMoc', textureData: 'not-a-data-url', name: 'Broken' },
        { alias: 'dupeMoc', src: 'https://img.example/d.png', name: 'Good' },
      ]);

      expect(assets.map((t) => t.alias)).toEqual(['dupeMoc']);
      // A poisoned cache entry would make this look already-loaded and send it
      // through extractTrackImage with an undefined texture.
      expect(controller.extractTrackImage).not.toHaveBeenCalled();
      expect(controller._backgroundLoadRemaining).toHaveBeenCalledWith(['dupeMoc']);
    });
  });

  describe("_mocIdsForAliases", function () {
    it("maps aliases to cloud ids and drops MOCs that are not in the cloud", function () {
      const controller = Object.create(LayoutController.prototype);
      controller.trackData = {
        bundles: [{
          assets: [
            { alias: 'mocuuid-1', mocId: 'uuid-1' },
            { alias: 'localOnly' },
          ],
        }],
      };

      expect(controller._mocIdsForAliases(['mocuuid-1', 'localOnly', 'missing']))
        .toEqual(['uuid-1']);
    });
  });
});
