import { LayoutController } from "../../src/controller/layoutController.js";
import { Component } from "../../src/model/component.js";
import { ComponentGroup } from "../../src/model/componentGroup.js";
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

/**
 * Stands in for BeerCSS's `ui()`. The first call on a dialog opens it, the
 * second closes it and fires the `close` event the dialog builders resolve on.
 */
function uiToggle(selector) {
  const element = document.querySelector(selector);
  if (!element || element.tagName !== 'DIALOG') {
    return;
  }
  if (element.dataset.open === 'true') {
    delete element.dataset.open;
    element.dispatchEvent(new Event('close'));
  } else {
    element.dataset.open = 'true';
  }
}

const DIALOG_IDS = [
  'deleteMocDialog', 'mocEditorModeDialog', 'mocInUseDialog',
];

/**
 * Deleting a MOC is mostly local work: a downloaded layout file can embed MOCs,
 * so a signed-out user must be able to delete them with no cloud code loaded.
 * Only the account side is delegated, to CloudMocSync.deleteRemote, which is
 * faked here and covered for real in spec/cloud/cloudMocSync.spec.mjs.
 */
describe("LayoutController MOC deletion", function () {
  let controller;
  let cloudMocs;
  let track;

  beforeEach(function () {
    if (!window.ui) {
      window.ui = () => {};
    }
    spyOn(window, 'ui').and.callFake(uiToggle);

    track = {
      alias: 'myMoc', name: 'My MOC', mine: 1, category: 'mine', scale: 1, type: 'track',
    };
    cloudMocs = {
      deleteRemote: jasmine.createSpy('deleteRemote').and.returnValue(Promise.resolve('deleted')),
    };

    controller = Object.create(LayoutController.prototype);
    controller.readOnly = false;
    controller.editorMode = false;
    controller.layers = [{ children: [] }];
    controller.trackData = { bundles: [{ assets: [track] }] };
    controller.copiedComponent = null;
    controller.undoManager = {
      clearIfReferencesAlias: jasmine.createSpy('clearIfReferencesAlias'),
    };
    spyOn(controller, 'createComponentBrowser').and.stub();
    // Signed in with cloud MOC support already loaded, which is the state any
    // user who owns a cloud MOC is in. The signed-out case is set up per-test.
    controller._cloudMocs = cloudMocs;
  });

  afterEach(function () {
    DIALOG_IDS.forEach((id) => document.getElementById(id)?.remove());
    Assets.cache.remove('myMoc');
  });

  /** Stubs every dialog so the orchestration can be tested on its own. */
  function stubDialogs({ confirm = true } = {}) {
    spyOn(controller, '_confirmDeleteMoc').and.returnValue(Promise.resolve(confirm));
    spyOn(controller, '_showMocEditorModeDialog').and.returnValue(Promise.resolve());
    spyOn(controller, '_showMocInUseDialog').and.returnValue(Promise.resolve());
  }

  describe("deleteMoc", function () {
    it("refuses while the editor is open, before anything else is checked", async function () {
      // The guard exists precisely for the unused case: in editor mode the real
      // layout is in sessionStorage, not in this.layers, so the usage scan below
      // would wrongly report the MOC as free to delete.
      controller.editorMode = true;
      stubDialogs();

      await controller.deleteMoc('myMoc');

      expect(controller._showMocEditorModeDialog).toHaveBeenCalled();
      expect(controller._confirmDeleteMoc).not.toHaveBeenCalled();
      expect(cloudMocs.deleteRemote).not.toHaveBeenCalled();
      expect(controller.trackData.bundles[0].assets).toContain(track);
    });

    it("does nothing at all when the layout is read only", async function () {
      controller.readOnly = true;
      stubDialogs();

      await controller.deleteMoc('myMoc');

      expect(controller._showMocEditorModeDialog).not.toHaveBeenCalled();
      expect(controller._confirmDeleteMoc).not.toHaveBeenCalled();
      expect(controller.trackData.bundles[0].assets).toContain(track);
    });

    it("refuses when the MOC is placed in the open layout", async function () {
      controller.layers = [{ children: [makeComponent(track)] }];
      stubDialogs();

      await controller.deleteMoc('myMoc');

      expect(controller._showMocInUseDialog).toHaveBeenCalledWith(track);
      expect(controller._confirmDeleteMoc).not.toHaveBeenCalled();
      expect(cloudMocs.deleteRemote).not.toHaveBeenCalled();
      expect(controller.trackData.bundles[0].assets).toContain(track);
    });

    it("removes nothing when the user declines the confirmation", async function () {
      stubDialogs({ confirm: false });

      await controller.deleteMoc('myMoc');

      expect(cloudMocs.deleteRemote).not.toHaveBeenCalled();
      expect(controller.trackData.bundles[0].assets).toContain(track);
      expect(controller.createComponentBrowser).not.toHaveBeenCalled();
    });

    it("re-checks usage after the confirm dialog, which awaits", async function () {
      stubDialogs();
      controller._confirmDeleteMoc.and.callFake(() => {
        // The user placed the MOC while the dialog was open.
        controller.layers = [{ children: [makeComponent(track)] }];
        return Promise.resolve(true);
      });

      await controller.deleteMoc('myMoc');

      expect(controller._showMocInUseDialog).toHaveBeenCalledWith(track);
      expect(controller.trackData.bundles[0].assets).toContain(track);
    });

    it("deletes a local-only MOC without touching the cloud", async function () {
      Assets.cache.set('myMoc', { width: 64, height: 64 });
      stubDialogs();

      await controller.deleteMoc('myMoc');

      expect(controller.trackData.bundles[0].assets).not.toContain(track);
      expect(Assets.cache.has('myMoc')).toBeFalse();
      expect(controller.createComponentBrowser).toHaveBeenCalled();
      expect(cloudMocs.deleteRemote).not.toHaveBeenCalled();
    });

    it("deletes a local-only MOC for a signed-out user", async function () {
      // The case the whole split exists for: a MOC that arrived inside a
      // downloaded layout file, deleted with no cloud module loaded at all.
      delete controller._cloudMocs;
      spyOn(controller, '_getCloudStorage').and.returnValue(Promise.resolve(null));
      stubDialogs();

      await controller.deleteMoc('myMoc');

      expect(controller.trackData.bundles[0].assets).not.toContain(track);
      expect(controller._getCloudStorage).not.toHaveBeenCalled();
    });

    it("deletes a cloud MOC from the account and then locally", async function () {
      track.mocId = 'uuid-1';
      stubDialogs();

      await controller.deleteMoc('myMoc');

      expect(cloudMocs.deleteRemote).toHaveBeenCalledWith(track);
      expect(controller.trackData.bundles[0].assets).not.toContain(track);
    });

    it("keeps the MOC when the cloud refuses because a layout still uses it", async function () {
      track.mocId = 'uuid-1';
      Assets.cache.set('myMoc', { width: 64, height: 64 });
      stubDialogs();
      cloudMocs.deleteRemote.and.returnValue(Promise.resolve('blocked'));

      await controller.deleteMoc('myMoc');

      expect(controller.trackData.bundles[0].assets).toContain(track);
      expect(Assets.cache.has('myMoc')).toBeTrue();
    });

    it("keeps the MOC when the cloud delete fails", async function () {
      track.mocId = 'uuid-1';
      stubDialogs();
      cloudMocs.deleteRemote.and.returnValue(Promise.resolve('failed'));

      await controller.deleteMoc('myMoc');

      expect(controller.trackData.bundles[0].assets).toContain(track);
    });

    it("keeps a cloud MOC when the user is no longer signed in", async function () {
      // Removing it locally would orphan the cloud record with no way back.
      track.mocId = 'uuid-1';
      stubDialogs();
      delete controller._cloudMocs;
      spyOn(controller, '_getCloudStorage').and.returnValue(Promise.resolve(null));

      await controller.deleteMoc('myMoc');

      expect(controller.trackData.bundles[0].assets).toContain(track);
      expect(cloudMocs.deleteRemote).not.toHaveBeenCalled();
    });

    it("ignores an alias that has no track", async function () {
      stubDialogs();

      await controller.deleteMoc('nothingHere');

      expect(controller._confirmDeleteMoc).not.toHaveBeenCalled();
      expect(controller.trackData.bundles[0].assets).toContain(track);
    });
  });

  describe("_removeMocLocally", function () {
    it("clears the undo buffer through the alias check", async function () {
      stubDialogs();

      await controller.deleteMoc('myMoc');

      expect(controller.undoManager.clearIfReferencesAlias).toHaveBeenCalledWith('myMoc');
    });

    it("destroys a copied component built from the deleted MOC", async function () {
      const copied = makeComponent(track);
      copied.destroy = jasmine.createSpy('destroy');
      controller.copiedComponent = copied;
      stubDialogs();

      await controller.deleteMoc('myMoc');

      expect(copied.destroy).toHaveBeenCalled();
      expect(controller.copiedComponent).toBeNull();
    });

    it("destroys a copied group containing the deleted MOC", async function () {
      const group = Object.create(ComponentGroup.prototype);
      // isTemporary is an accessor over a private field, which a bare prototype
      // object does not have; shadow it with a plain property.
      Object.defineProperty(group, 'isTemporary', { value: true, writable: true });
      group.destroy = jasmine.createSpy('destroy');
      group.getAllComponents = () => [makeComponent({ alias: 'r104' }), makeComponent(track)];
      controller.copiedComponent = group;
      stubDialogs();

      await controller.deleteMoc('myMoc');

      // A temporary group destroys its members unless the flag is cleared first.
      expect(group.isTemporary).toBeFalse();
      expect(group.destroy).toHaveBeenCalled();
      expect(controller.copiedComponent).toBeNull();
    });

    it("leaves a copied component built from a different MOC alone", async function () {
      const copied = makeComponent({ alias: 'otherMoc' });
      copied.destroy = jasmine.createSpy('destroy');
      controller.copiedComponent = copied;
      stubDialogs();

      await controller.deleteMoc('myMoc');

      expect(copied.destroy).not.toHaveBeenCalled();
      expect(controller.copiedComponent).toBe(copied);
    });
  });

  describe("the dialogs", function () {
    it("names the MOC and where it lives when confirming a local delete", function () {
      controller._confirmDeleteMoc(track);

      const dialog = document.getElementById('deleteMocDialog');
      expect(dialog.textContent).toContain('Delete "My MOC"?');
      expect(dialog.textContent).toContain('only exists in this browser');
      expect(window.ui).toHaveBeenCalledWith('#deleteMocDialog');
    });

    it("says the account is involved when confirming a cloud delete", function () {
      track.mocId = 'uuid-1';
      controller._confirmDeleteMoc(track);

      expect(document.getElementById('deleteMocDialog').textContent)
        .toContain('removed from your account');
    });

    it("resolves true only when the confirm button is used", async function () {
      const confirmed = controller._confirmDeleteMoc(track);
      document.getElementById('deleteMocConfirm').click();
      await expectAsync(confirmed).toBeResolvedTo(true);

      const cancelled = controller._confirmDeleteMoc(track);
      document.getElementById('deleteMocCancel').click();
      await expectAsync(cancelled).toBeResolvedTo(false);
    });

    it("treats dismissing the confirm dialog as a cancel", async function () {
      const dismissed = controller._confirmDeleteMoc(track);
      // Esc and the backdrop both surface as a `close` event.
      document.getElementById('deleteMocDialog').dispatchEvent(new Event('close'));
      await expectAsync(dismissed).toBeResolvedTo(false);
    });

    it("falls back to the alias when a MOC has no name", function () {
      delete track.name;
      controller._confirmDeleteMoc(track);

      expect(document.getElementById('deleteMocDialog').textContent)
        .toContain('Delete "myMoc"?');
    });

    it("explains the editor-mode refusal and resolves when acknowledged", async function () {
      const shown = controller._showMocEditorModeDialog();

      const dialog = document.getElementById('mocEditorModeDialog');
      expect(dialog.textContent).toContain('You must exit the Editor to delete MOCs.');
      expect(window.ui).toHaveBeenCalledWith('#mocEditorModeDialog');

      document.getElementById('mocEditorModeDialogOk').click();
      await expectAsync(shown).toBeResolved();
      expect(document.getElementById('mocEditorModeDialog')).toBeNull();
    });

    it("names the MOC in the in-use dialog", function () {
      controller._showMocInUseDialog(track);

      expect(document.getElementById('mocInUseDialog').textContent)
        .toContain('The layout you have open is using "My MOC".');
    });

    it("replaces a previously opened dialog instead of stacking them", function () {
      controller._showMocInUseDialog(track);
      controller._showMocInUseDialog(track);

      expect(document.querySelectorAll('#mocInUseDialog').length).toBe(1);
    });
  });
});
