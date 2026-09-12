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
  'deleteMocDialog', 'mocEditorModeDialog', 'mocInUseDialog', 'mocBlockedDialog',
];

describe("LayoutController MOC deletion", function () {
  let controller;
  let cloudStorage;
  let track;

  beforeEach(function () {
    if (!window.ui) {
      window.ui = () => {};
    }
    spyOn(window, 'ui').and.callFake(uiToggle);

    track = {
      alias: 'myMoc', name: 'My MOC', mine: 1, category: 'mine', scale: 1, type: 'track',
    };
    cloudStorage = {
      deleteMoc: jasmine.createSpy('deleteMoc').and.returnValue(Promise.resolve(true)),
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
    spyOn(controller, '_getCloudStorage').and.returnValue(Promise.resolve(cloudStorage));
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
    spyOn(controller, '_showMocBlockedDialog').and.returnValue(Promise.resolve());
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
      expect(cloudStorage.deleteMoc).not.toHaveBeenCalled();
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
      expect(cloudStorage.deleteMoc).not.toHaveBeenCalled();
      expect(controller.trackData.bundles[0].assets).toContain(track);
    });

    it("removes nothing when the user declines the confirmation", async function () {
      stubDialogs({ confirm: false });

      await controller.deleteMoc('myMoc');

      expect(cloudStorage.deleteMoc).not.toHaveBeenCalled();
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
      expect(controller._getCloudStorage).not.toHaveBeenCalled();
      expect(cloudStorage.deleteMoc).not.toHaveBeenCalled();
    });

    it("deletes a cloud MOC from the account and then locally", async function () {
      track.mocId = 'uuid-1';
      stubDialogs();

      await controller.deleteMoc('myMoc');

      expect(cloudStorage.deleteMoc).toHaveBeenCalledWith('uuid-1');
      expect(controller.trackData.bundles[0].assets).not.toContain(track);
    });

    it("keeps the MOC when the cloud refuses because a layout still uses it", async function () {
      track.mocId = 'uuid-1';
      Assets.cache.set('myMoc', { width: 64, height: 64 });
      stubDialogs();
      const error = new Error('MOC is used by 1 layout(s) and cannot be deleted.');
      error.code = 'MOC_IN_USE';
      error.details = { blockingLayoutCount: 1, layouts: [], otherOwnerCount: 0 };
      cloudStorage.deleteMoc.and.returnValue(Promise.reject(error));

      await controller.deleteMoc('myMoc');

      expect(controller._showMocBlockedDialog).toHaveBeenCalledWith(track, error);
      expect(controller.trackData.bundles[0].assets).toContain(track);
      expect(Assets.cache.has('myMoc')).toBeTrue();
    });

    it("removes a MOC the cloud has already lost", async function () {
      track.mocId = 'uuid-1';
      stubDialogs();
      const error = new Error('MOC not found.');
      error.code = 'NOT_FOUND';
      cloudStorage.deleteMoc.and.returnValue(Promise.reject(error));

      await controller.deleteMoc('myMoc');

      expect(controller.trackData.bundles[0].assets).not.toContain(track);
    });

    it("keeps the MOC on any other cloud error", async function () {
      track.mocId = 'uuid-1';
      stubDialogs();
      cloudStorage.deleteMoc.and.returnValue(Promise.reject(new Error('offline')));
      spyOn(console, 'error');

      await controller.deleteMoc('myMoc');

      expect(controller.trackData.bundles[0].assets).toContain(track);
      expect(controller._showMocBlockedDialog).not.toHaveBeenCalled();
    });

    it("keeps a cloud MOC when the user is no longer signed in", async function () {
      // Removing it locally would orphan the cloud record with no way back.
      track.mocId = 'uuid-1';
      stubDialogs();
      controller._getCloudStorage.and.returnValue(Promise.resolve(null));

      await controller.deleteMoc('myMoc');

      expect(controller.trackData.bundles[0].assets).toContain(track);
      expect(cloudStorage.deleteMoc).not.toHaveBeenCalled();
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

    it("lists the blocking layouts, the shared count and the truncation note", function () {
      const error = new Error('MOC is used by 3 layout(s) and cannot be deleted.');
      error.details = {
        blockingLayoutCount: 3,
        layouts: [
          { layoutId: 'l-1', layoutName: 'Town Center' },
          { layoutId: 'l-2', layoutName: 'Train Yard' },
        ],
        ownLayoutCount: 2,
        otherOwnerCount: 1,
        truncated: true,
      };

      controller._showMocBlockedDialog(track, error);

      const dialog = document.getElementById('mocBlockedDialog');
      expect(dialog.textContent).toContain('MOC is used by 3 layout(s)');
      expect(dialog.textContent).toContain('Town Center');
      expect(dialog.textContent).toContain('Train Yard');
      expect(dialog.textContent).toContain('Also used by 1 layout(s)');
      expect(dialog.textContent).toContain('more layouts than could be listed');
      expect(dialog.querySelectorAll('li').length).toBe(2);
    });

    it("uses the layout id when a blocking layout has no name", function () {
      const error = new Error('Blocked.');
      error.details = { layouts: [{ layoutId: 'l-1' }] };

      controller._showMocBlockedDialog(track, error);

      expect(document.getElementById('mocBlockedDialog').querySelector('li').textContent)
        .toBe('l-1');
    });

    it("renders layout names as text rather than markup", function () {
      const error = new Error('Blocked.');
      error.details = { layouts: [{ layoutName: '<img src=x onerror="window.x=1">' }] };

      controller._showMocBlockedDialog(track, error);

      const item = document.getElementById('mocBlockedDialog').querySelector('li');
      expect(item.querySelector('img')).toBeNull();
      expect(item.textContent).toBe('<img src=x onerror="window.x=1">');
    });

    it("degrades to the message alone when details are missing or malformed", function () {
      const error = new Error('Blocked.');

      expect(() => controller._showMocBlockedDialog(track, error)).not.toThrow();
      expect(document.getElementById('mocBlockedDialog').textContent).toContain('Blocked.');
      expect(document.getElementById('mocBlockedDialog').querySelectorAll('li').length).toBe(0);

      document.getElementById('mocBlockedDialog').remove();
      error.details = 'not an object';
      expect(() => controller._showMocBlockedDialog(track, error)).not.toThrow();
      expect(document.getElementById('mocBlockedDialog').textContent).toContain('Blocked.');
    });

    it("replaces a previously opened dialog instead of stacking them", function () {
      controller._showMocInUseDialog(track);
      controller._showMocInUseDialog(track);

      expect(document.querySelectorAll('#mocInUseDialog').length).toBe(1);
    });
  });
});
