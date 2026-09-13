import { LayoutController } from "../../src/controller/layoutController.js";
import { Assets } from "../../src/pixi.mjs";

/**
 * _loadLayoutMocs is the shared registration primitive: the same code path takes
 * MOCs embedded in a downloaded layout file and MOCs listed by the cloud. It
 * stays on LayoutController precisely because the local path must work with no
 * cloud code loaded, so it is tested here rather than alongside CloudMocSync.
 * The cloud sync itself is covered by spec/cloud/cloudMocSync.spec.mjs.
 */
describe("LayoutController MOC registration", function () {
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
});
