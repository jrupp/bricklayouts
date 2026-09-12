import { LayoutController } from "../../src/controller/layoutController.js";

/**
 * The cloud MOC code lives in a module that is only fetched once the user is
 * known to be signed in. What stays on LayoutController is a set of thin
 * delegates plus enableCloudMocs(), and the contract that matters here is what
 * they do when that module is absent: a no-op or a prompt, never a failed
 * import. The module's own behaviour is covered by
 * spec/cloud/cloudMocSync.spec.mjs.
 */
describe("LayoutController cloud MOC delegates", function () {
  let controller;

  beforeEach(function () {
    controller = Object.create(LayoutController.prototype);
    controller.trackData = { bundles: [{ assets: [] }] };
    controller.layers = [];
  });

  describe("signed out", function () {
    beforeEach(function () {
      spyOn(controller, '_getCloudStorage').and.returnValue(Promise.resolve(null));
    });

    it("resolves enableCloudMocs to null without importing anything", async function () {
      await expectAsync(controller.enableCloudMocs()).toBeResolvedTo(null);
    });

    it("does not cache the null, so a later sign-in still loads", async function () {
      await controller.enableCloudMocs();
      expect(controller._cloudMocsReady).toBeNull();

      // A second attempt must consult cloud storage again rather than reusing
      // the resolved-null promise from the first.
      await controller.enableCloudMocs();
      expect(controller._getCloudStorage).toHaveBeenCalledTimes(2);
    });

    it("resolves saveMocToCloud to null", async function () {
      await expectAsync(controller.saveMocToCloud('myMoc')).toBeResolvedTo(null);
    });

    it("resolves loadCloudMocs without doing anything", async function () {
      await expectAsync(controller.loadCloudMocs()).toBeResolved();
    });

    it("reports no MOC ids for any alias", function () {
      expect(controller._mocIdsForAliases(['a', 'b'])).toEqual([]);
    });

    it("removes no cloud MOCs", function () {
      expect(controller.removeCloudMocs()).toBe(0);
    });

    it("reports the MOC gate as failed so a cloud layout save stops", async function () {
      // The caller is about to save a layout to the cloud, which a signed-out
      // user cannot do either, so reporting success here would be misleading.
      await expectAsync(controller._ensureMocsInCloud())
        .toBeResolvedTo({ ok: false, reason: 'uploadFailed', limit: null });
    });
  });

  describe("when cloud storage cannot be reached", function () {
    it("swallows the failure rather than breaking the caller", async function () {
      spyOn(controller, '_getCloudStorage').and.returnValue(Promise.reject(new Error('offline')));
      spyOn(console, 'error');

      await expectAsync(controller.enableCloudMocs()).toBeResolvedTo(null);
      await expectAsync(controller.saveMocToCloud('myMoc')).toBeResolvedTo(null);
    });
  });

  describe("signed in", function () {
    let cloudMocs;

    beforeEach(function () {
      cloudMocs = {
        saveMoc: jasmine.createSpy('saveMoc').and.returnValue(Promise.resolve('mocuuid-1')),
        listAndRegister: jasmine.createSpy('listAndRegister')
          .and.returnValue(Promise.resolve()),
        removeCloudTracks: jasmine.createSpy('removeCloudTracks').and.returnValue(3),
        mocIdsForAliases: jasmine.createSpy('mocIdsForAliases').and.returnValue(['uuid-1']),
        ensureMocsInCloud: jasmine.createSpy('ensureMocsInCloud')
          .and.returnValue(Promise.resolve({ ok: true, reason: null, limit: null })),
      };
      controller._cloudMocs = cloudMocs;
    });

    it("passes saveMocToCloud straight through", async function () {
      await expectAsync(controller.saveMocToCloud('myMoc')).toBeResolvedTo('mocuuid-1');
      expect(cloudMocs.saveMoc).toHaveBeenCalledWith('myMoc');
    });

    it("passes loadCloudMocs straight through", async function () {
      await controller.loadCloudMocs();
      expect(cloudMocs.listAndRegister).toHaveBeenCalled();
    });

    it("passes removeCloudMocs straight through, synchronously", function () {
      expect(controller.removeCloudMocs()).toBe(3);
    });

    it("passes _mocIdsForAliases straight through", function () {
      expect(controller._mocIdsForAliases(['mocuuid-1'])).toEqual(['uuid-1']);
      expect(cloudMocs.mocIdsForAliases).toHaveBeenCalledWith(['mocuuid-1']);
    });

    it("passes _ensureMocsInCloud straight through", async function () {
      await expectAsync(controller._ensureMocsInCloud())
        .toBeResolvedTo({ ok: true, reason: null, limit: null });
    });

    it("reuses the loaded module instead of importing again", async function () {
      spyOn(controller, '_getCloudStorage');

      await expectAsync(controller.enableCloudMocs()).toBeResolvedTo(cloudMocs);
      expect(controller._getCloudStorage).not.toHaveBeenCalled();
    });

    it("releases the module on logout", function () {
      controller.disableCloudMocs();

      expect(controller._cloudMocs).toBeNull();
      expect(controller._cloudMocsReady).toBeNull();
      expect(controller.removeCloudMocs()).toBe(0);
    });
  });

  describe("a click arriving while the module is still loading", function () {
    it("waits for the in-flight import instead of starting a second one", async function () {
      let release;
      spyOn(controller, '_getCloudStorage')
        .and.returnValue(new Promise((resolve) => { release = resolve; }));

      const first = controller.enableCloudMocs();
      const second = controller.enableCloudMocs();
      release(null);
      await Promise.all([first, second]);

      expect(controller._getCloudStorage).toHaveBeenCalledTimes(1);
    });
  });
});
