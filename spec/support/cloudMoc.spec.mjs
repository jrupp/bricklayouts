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
      controller.categories = new Map([
        ['structures', 'Structures'],
        ['mine', 'My MOCs'],
      ]);
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
      Assets.cache.set('myMoc', { width: 64, height: 64 });
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
      Assets.cache.set('mocuuid-1', { width: 64, height: 64 });
      const serializeSpy = spyOn(controller, '_serializeMocs');

      const result = await controller.saveMocToCloud('mocuuid-1');

      expect(result).toBeNull();
      expect(cloudStorage.updateMoc).toHaveBeenCalledWith('uuid-1', {
        name: 'X', category: 'structures', scale: 1, type: 'track', onbp: '#237841',
      });
      expect(cloudStorage.createMoc).not.toHaveBeenCalled();
      expect(serializeSpy).not.toHaveBeenCalled();
    });

    it("sends null for an onbp that has been cleared locally", async function () {
      // The MOC previously had a baseplate color; the user has since removed it.
      // `onbp` is the only cloud field that can legitimately be absent here —
      // validateMocForCloud requires name, category, scale and type — so it is
      // the only one the null-clearing behaviour still applies to.
      const track = {
        alias: 'mocuuid-1', mocId: 'uuid-1', name: 'X',
        category: 'structures', scale: 1, type: 'track',
      };
      controller.trackData = { bundles: [{ assets: [track] }] };
      Assets.cache.set('mocuuid-1', { width: 64, height: 64 });

      await controller.saveMocToCloud('mocuuid-1');

      expect(cloudStorage.updateMoc).toHaveBeenCalledWith('uuid-1', {
        name: 'X', category: 'structures', scale: 1, type: 'track', onbp: null,
      });
    });

    it("refuses to update a MOC that is missing a required cloud field", async function () {
      // The counterpart to the test above: the fields that used to be sent as
      // null can no longer reach the API at all.
      const track = { alias: 'mocuuid-1', mocId: 'uuid-1', name: 'X', type: 'track' };
      controller.trackData = { bundles: [{ assets: [track] }] };
      Assets.cache.set('mocuuid-1', { width: 64, height: 64 });

      const result = await controller.saveMocToCloud('mocuuid-1');

      expect(result).toBeNull();
      expect(cloudStorage.updateMoc).not.toHaveBeenCalled();
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
      const track = {
        alias: 'mocuuid-1', mocId: 'uuid-1', name: 'X',
        category: 'structures', scale: 1, type: 'track',
      };
      controller.trackData = { bundles: [{ assets: [track] }] };
      Assets.cache.set('mocuuid-1', { width: 64, height: 64 });
      cloudStorage.updateMoc.and.returnValue(Promise.reject(new Error('boom')));
      spyOn(console, 'error');

      await expectAsync(controller.saveMocToCloud('mocuuid-1')).toBeResolvedTo(null);
    });

    it("resolves to null instead of throwing when cloud storage lookup fails", async function () {
      controller._getCloudStorage.and.returnValue(Promise.reject(new Error('offline')));
      spyOn(console, 'error');

      await expectAsync(controller.saveMocToCloud('myMoc')).toBeResolvedTo(null);
    });

    it("rejects a MOC that fails validation without calling the API", async function () {
      const track = {
        alias: 'myMoc', name: 'My MOC', category: 'bogus', scale: 1, type: 'track',
      };
      controller.trackData = { bundles: [{ assets: [track] }] };
      Assets.cache.set('myMoc', { width: 64, height: 64 });
      spyOn(controller, '_serializeMocs');

      const result = await controller.saveMocToCloud('myMoc');

      expect(result).toBeNull();
      expect(cloudStorage.createMoc).not.toHaveBeenCalled();
      expect(cloudStorage.updateMoc).not.toHaveBeenCalled();
    });

    it("does not create a cloud MOC when the texture is not a PNG data URL", async function () {
      const track = {
        alias: 'myMoc', name: 'My MOC', category: 'structures', scale: 1, type: 'track',
      };
      controller.trackData = { bundles: [{ assets: [track] }] };
      Assets.cache.set('myMoc', { width: 64, height: 64 });
      spyOn(controller, '_serializeMocs').and.returnValue(Promise.resolve([{
        name: 'My MOC', category: 'structures', scale: 1, type: 'track',
        textureData: 'not-a-data-url',
      }]));

      const result = await controller.saveMocToCloud('myMoc');

      expect(result).toBeNull();
      expect(cloudStorage.uploadMocImage).not.toHaveBeenCalled();
      // Bailing out after createMoc would leave an imageless MOC record behind.
      expect(cloudStorage.createMoc).not.toHaveBeenCalled();
    });

    it("rethrows the MOC storage limit so a batch upload can stop", async function () {
      // The one failure that is not swallowed: it is account-wide, not a problem
      // with this MOC, so the caller has to be able to abandon the rest.
      const track = {
        alias: 'myMoc', name: 'My MOC', category: 'structures', scale: 1, type: 'track',
      };
      controller.trackData = { bundles: [{ assets: [track] }] };
      Assets.cache.set('myMoc', { width: 64, height: 64 });
      spyOn(controller, '_serializeMocs').and.returnValue(Promise.resolve([{
        name: 'My MOC', category: 'structures', scale: 1, type: 'track',
        textureData: 'data:image/png;base64,AAAA',
      }]));
      const limitError = new Error('Subscription is required to store more than 10 MOCs');
      limitError.code = 'MOC_LIMIT_REACHED';
      limitError.details = { reason: 'mocLimitReached', limit: 10, current: 10 };
      cloudStorage.createMoc.and.returnValue(Promise.reject(limitError));
      spyOn(console, 'error');

      // showSnackbar reuses a single element, so seed a sentinel rather than
      // relying on its absence: a leftover from another spec would otherwise
      // make this assertion depend on execution order.
      const snackbar = document.getElementById('cloudSnackbar')
        || document.body.appendChild(Object.assign(
          document.createElement('div'), { id: 'cloudSnackbar' }
        ));
      snackbar.textContent = 'SENTINEL';

      await expectAsync(controller.saveMocToCloud('myMoc')).toBeRejectedWith(limitError);
      // The user is told why before the error travels on.
      expect(snackbar.textContent)
        .toContain('Subscription is required to store more than 10 MOCs');
      expect(track.mocId).toBeUndefined();
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

    it("does not stamp a non-string mocId onto a track", async function () {
      const controller = Object.create(LayoutController.prototype);
      const assets = [];
      controller.trackData = { bundles: [{ assets }] };
      spyOn(controller, 'createComponentBrowser').and.stub();
      spyOn(controller, '_backgroundLoadRemaining').and.stub();

      await controller._loadLayoutMocs([
        {
          alias: 'forged', mocId: { toString: () => 'evil' },
          src: 'https://img.example/e.png', name: 'E',
        },
        { alias: 'forged2', mocId: 12345, src: 'https://img.example/f.png', name: 'F' },
      ]);

      expect(assets.find((t) => t.alias === 'forged').mocId).toBeUndefined();
      expect(assets.find((t) => t.alias === 'forged2').mocId).toBeUndefined();
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

  describe("_ensureMocsInCloud", function () {
    let controller;

    beforeEach(function () {
      controller = Object.create(LayoutController.prototype);
      spyOn(controller, 'saveMocToCloud');
      spyOn(controller, '_confirmUploadMocs');
    });

    it("resolves true without prompting when every MOC already has a cloud id", async function () {
      controller.layers = [
        { children: [makeComponent({ alias: 'a', mine: 1, mocId: 'id-a' })] },
        { children: [makeComponent({ alias: 'b', mine: 1, mocId: 'id-b' })] },
      ];

      await expectAsync(controller._ensureMocsInCloud())
        .toBeResolvedTo(jasmine.objectContaining({ ok: true, reason: null }));
      expect(controller._confirmUploadMocs).not.toHaveBeenCalled();
      expect(controller.saveMocToCloud).not.toHaveBeenCalled();
    });

    it("ignores stock tracks and things that are not Components", async function () {
      controller.layers = [
        { children: [makeComponent({ alias: 'r104' }), { notAComponent: true }] },
      ];

      await expectAsync(controller._ensureMocsInCloud())
        .toBeResolvedTo(jasmine.objectContaining({ ok: true, reason: null }));
      expect(controller._confirmUploadMocs).not.toHaveBeenCalled();
    });

    it("resolves false and uploads nothing when the user declines", async function () {
      controller.layers = [{ children: [makeComponent({ alias: 'a', mine: 1 })] }];
      controller._confirmUploadMocs.and.returnValue(Promise.resolve(false));

      await expectAsync(controller._ensureMocsInCloud())
        .toBeResolvedTo(jasmine.objectContaining({ ok: false, reason: 'declined' }));
      expect(controller._confirmUploadMocs).toHaveBeenCalled();
      expect(controller.saveMocToCloud).not.toHaveBeenCalled();
    });

    it("uploads each pending MOC in order and resolves true on success", async function () {
      const a = { alias: 'a', mine: 1 };
      const b = { alias: 'b', mine: 1 };
      controller.layers = [
        { children: [makeComponent(a)] },
        { children: [makeComponent(b)] },
      ];
      controller._confirmUploadMocs.and.returnValue(Promise.resolve(true));
      const order = [];
      controller.saveMocToCloud.and.callFake((alias) => {
        order.push(alias);
        (alias === 'a' ? a : b).mocId = `id-${alias}`;
        return Promise.resolve(`moc-${alias}`);
      });

      await expectAsync(controller._ensureMocsInCloud())
        .toBeResolvedTo(jasmine.objectContaining({ ok: true, reason: null }));
      expect(order).toEqual(['a', 'b']);
      expect(controller.saveMocToCloud).toHaveBeenCalledTimes(2);
    });

    it("uploads a MOC placed several times only once", async function () {
      // Components hold their track by reference, so the same MOC placed twice
      // must not be uploaded twice.
      const a = { alias: 'a', mine: 1 };
      controller.layers = [
        { children: [makeComponent(a), makeComponent(a)] },
        { children: [makeComponent(a)] },
      ];
      controller._confirmUploadMocs.and.returnValue(Promise.resolve(true));
      controller.saveMocToCloud.and.callFake(() => {
        a.mocId = 'id-a';
        return Promise.resolve('moc-a');
      });

      await expectAsync(controller._ensureMocsInCloud())
        .toBeResolvedTo(jasmine.objectContaining({ ok: true, reason: null }));
      expect(controller.saveMocToCloud).toHaveBeenCalledTimes(1);
      expect(controller._confirmUploadMocs).toHaveBeenCalledWith([a]);
    });

    it("aborts and warns when an upload leaves a MOC without a cloud id", async function () {
      controller.layers = [{ children: [makeComponent({ alias: 'a', mine: 1 })] }];
      controller._confirmUploadMocs.and.returnValue(Promise.resolve(true));
      controller.saveMocToCloud.and.returnValue(Promise.resolve(null));

      await expectAsync(controller._ensureMocsInCloud())
        .toBeResolvedTo(jasmine.objectContaining({ ok: false, reason: 'uploadFailed' }));
    });

    it("refuses to prompt when more than the batch limit are pending", async function () {
      const children = [];
      for (let i = 0; i < 21; i += 1) {
        children.push(makeComponent({ alias: `a${i}`, mine: 1 }));
      }
      controller.layers = [{ children }];

      await expectAsync(controller._ensureMocsInCloud())
        .toBeResolvedTo(jasmine.objectContaining({ ok: false, reason: 'batchTooLarge' }));
      expect(controller._confirmUploadMocs).not.toHaveBeenCalled();
    });

    it("abandons the rest of the batch when the account hits its MOC limit", async function () {
      // The cap is account-wide, so the third MOC must never be attempted.
      const a = { alias: 'a', mine: 1 };
      const b = { alias: 'b', mine: 1 };
      const c = { alias: 'c', mine: 1 };
      controller.layers = [{
        children: [makeComponent(a), makeComponent(b), makeComponent(c)],
      }];
      controller._confirmUploadMocs.and.returnValue(Promise.resolve(true));
      controller.saveMocToCloud.and.callFake((alias) => {
        if (alias === 'a') {
          a.mocId = 'id-a';
          return Promise.resolve('moc-a');
        }
        const error = new Error('Subscription is required to store more than 10 MOCs');
        error.code = 'MOC_LIMIT_REACHED';
        error.details = { reason: 'mocLimitReached', limit: 10, current: 10 };
        return Promise.reject(error);
      });

      await expectAsync(controller._ensureMocsInCloud()).toBeResolvedTo({
        ok: false,
        reason: 'mocLimitReached',
        limit: 10,
      });
      expect(controller.saveMocToCloud).toHaveBeenCalledTimes(2);
    });

    it("lets a non-limit error from saveMocToCloud propagate", async function () {
      controller.layers = [{ children: [makeComponent({ alias: 'a', mine: 1 })] }];
      controller._confirmUploadMocs.and.returnValue(Promise.resolve(true));
      controller.saveMocToCloud.and.returnValue(Promise.reject(new Error('boom')));

      await expectAsync(controller._ensureMocsInCloud()).toBeRejectedWithError('boom');
    });
  });
});
