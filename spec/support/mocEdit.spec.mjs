import { LayoutController } from "../../src/controller/layoutController.js";
import { LayoutPreservation } from "../../src/utils/layoutPreservation.js";
import { Assets } from "../../src/pixi.mjs";

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

/** Fires a pointer event of the given kind at an element. */
function pointer(target, type, pointerType, x = 0, y = 0) {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerType, clientX: x, clientY: y,
  }));
}

/**
 * Editing a MOC is reached from its button in the component browser, through
 * a menu that also offers Delete. The editor itself is faked here; showing an
 * existing MOC is covered in editorController.spec.mjs.
 */
describe("LayoutController MOC editing", function () {
  let controller;
  let track;
  let browser;
  let savedEditorController;

  beforeEach(function () {
    if (!window.ui) {
      window.ui = () => {};
    }
    spyOn(window, 'ui').and.callFake(uiToggle);

    track = {
      alias: 'myMoc', name: 'My MOC', mine: 1, category: 'mine', scale: 1, type: 'track',
      image: document.createElement('img'),
    };

    browser = document.createElement('div');
    document.body.appendChild(browser);
    const groupSelect = document.createElement('select');
    ['all', 'mine'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      groupSelect.appendChild(option);
    });
    groupSelect.selectedIndex = 1;

    controller = Object.create(LayoutController.prototype);
    controller.readOnly = false;
    controller.editorMode = false;
    controller.layers = [{ children: [] }];
    controller.trackData = { bundles: [{ assets: [track] }] };
    controller.componentBrowser = browser;
    controller.groupSelect = groupSelect;
    controller.searchElement = document.createElement('input');
    spyOn(controller, 'addComponent');
    // Starts a mouse drag onto the canvas, which is not what is under test.
    spyOn(controller, '_onBrowserButtonPointerDown');
    spyOn(controller, 'editMoc').and.callThrough();
    spyOn(controller, 'deleteMoc').and.resolveTo();

    savedEditorController = LayoutController.editorController;
  });

  afterEach(function () {
    controller._hideMocMenu();
    document.getElementById('mocMenu')?.parentElement.remove();
    document.getElementById('mocEditorModeDialog')?.remove();
    document.getElementById('cloudSnackbar')?.remove();
    document.body.classList.remove('editor-mode');
    browser.remove();
    LayoutController.editorController = savedEditorController;
    LayoutController.browserMobileClick = false;
    Assets.cache.remove('myMoc');
  });

  /** The browser button for the MOC, after the browser has been built. */
  function mocButton() {
    controller.createComponentBrowser();
    return browser.querySelector('button.mine');
  }

  function menu() {
    return document.getElementById('mocMenu');
  }

  function menuIsOpen() {
    return menu()?.classList.contains('active') ?? false;
  }

  describe("browser button", function () {
    it("shows a 3-dot menu icon in place of the trash can", function () {
      const icons = Array.from(mocButton().querySelectorAll('i')).map((i) => i.textContent);
      expect(icons).toContain('more_vert');
      expect(icons).not.toContain('delete');
    });

    it("opens the MOC menu from the icon without adding the component", function () {
      mocButton().querySelector('i').click();

      expect(menuIsOpen()).toBeTrue();
      expect(menu().dataset.alias).toBe('myMoc');
      expect(menu().textContent).toContain('Edit');
      expect(menu().textContent).toContain('Delete');
      expect(controller.addComponent).not.toHaveBeenCalled();
    });

    it("closes the menu on a second click of the icon", function () {
      const icon = mocButton().querySelector('i');
      icon.click();
      pointer(icon, 'pointerdown', 'mouse');
      icon.click();

      expect(menuIsOpen()).toBeFalse();
    });

    it("gives buttons that are not MOCs no menu", function () {
      delete track.mine;
      track.category = 'mine';
      controller.createComponentBrowser();

      expect(browser.querySelector('button.mine')).toBeNull();
      expect(Array.from(browser.querySelectorAll('i')).map((i) => i.textContent))
        .not.toContain('more_vert');
    });
  });

  describe("menu", function () {
    beforeEach(function () {
      mocButton().querySelector('i').click();
    });

    it("edits the MOC from Edit and closes", function () {
      controller.editMoc.and.resolveTo();

      document.getElementById('mocMenuEdit').click();

      expect(controller.editMoc).toHaveBeenCalledWith('myMoc');
      expect(menuIsOpen()).toBeFalse();
    });

    it("deletes the MOC from Delete and closes", function () {
      document.getElementById('mocMenuDelete').click();

      expect(controller.deleteMoc).toHaveBeenCalledWith('myMoc');
      expect(menuIsOpen()).toBeFalse();
    });

    it("closes on a press anywhere outside it", function () {
      pointer(document.body, 'pointerdown', 'mouse');

      expect(menuIsOpen()).toBeFalse();
    });

    it("stays open for a press inside it", function () {
      pointer(document.getElementById('mocMenuEdit'), 'pointerdown', 'mouse');

      expect(menuIsOpen()).toBeTrue();
    });

    it("closes on a key press", function () {
      controller.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(menuIsOpen()).toBeFalse();
    });

    it("closes when the browser is rebuilt out from under it", function () {
      controller.createComponentBrowser();

      expect(menuIsOpen()).toBeFalse();
    });

    it("stops listening for outside presses once closed", function () {
      const removeSpy = spyOn(document, 'removeEventListener').and.callThrough();

      pointer(document.body, 'pointerdown', 'mouse');

      expect(removeSpy).toHaveBeenCalledWith('pointerdown', jasmine.any(Function), true);
    });
  });

  describe("press-and-hold", function () {
    let button;

    beforeEach(function () {
      jasmine.clock().install();
      button = mocButton();
    });

    afterEach(function () {
      jasmine.clock().uninstall();
    });

    it("opens the menu after a touch is held still", function () {
      pointer(button, 'pointerdown', 'touch', 50, 50);
      jasmine.clock().tick(499);
      expect(menuIsOpen()).toBeFalse();

      jasmine.clock().tick(1);

      expect(menuIsOpen()).toBeTrue();
      expect(menu().dataset.alias).toBe('myMoc');
    });

    it("does not add the component when the finger is lifted after the menu opens", function () {
      pointer(button, 'pointerdown', 'touch', 50, 50);
      jasmine.clock().tick(500);
      pointer(button, 'pointerup', 'touch', 50, 50);
      pointer(button, 'click', 'touch', 50, 50);

      expect(controller.addComponent).not.toHaveBeenCalled();
      expect(menuIsOpen()).toBeTrue();
    });

    it("still adds the component on the next tap", function () {
      pointer(button, 'pointerdown', 'touch', 50, 50);
      jasmine.clock().tick(500);
      pointer(button, 'click', 'touch', 50, 50);

      pointer(button, 'pointerdown', 'touch', 50, 50);
      pointer(button, 'pointerup', 'touch', 50, 50);
      pointer(button, 'click', 'touch', 50, 50);

      expect(controller.addComponent).toHaveBeenCalledOnceWith(track, true);
    });

    it("adds the component on a quick tap without opening the menu", function () {
      pointer(button, 'pointerdown', 'touch', 50, 50);
      jasmine.clock().tick(100);
      pointer(button, 'pointerup', 'touch', 50, 50);
      pointer(button, 'click', 'touch', 50, 50);
      jasmine.clock().tick(1000);

      expect(controller.addComponent).toHaveBeenCalledOnceWith(track, true);
      expect(menuIsOpen()).toBeFalse();
    });

    it("gives up when the finger moves too far", function () {
      pointer(button, 'pointerdown', 'touch', 50, 50);
      pointer(button, 'pointermove', 'touch', 50, 61);
      jasmine.clock().tick(1000);

      expect(menuIsOpen()).toBeFalse();
    });

    it("tolerates a small wobble", function () {
      pointer(button, 'pointerdown', 'touch', 50, 50);
      pointer(button, 'pointermove', 'touch', 53, 54);
      jasmine.clock().tick(500);

      expect(menuIsOpen()).toBeTrue();
    });

    it("gives up when the browser takes the touch over to scroll", function () {
      pointer(button, 'pointerdown', 'touch', 50, 50);
      pointer(button, 'pointercancel', 'touch', 50, 50);
      jasmine.clock().tick(1000);

      expect(menuIsOpen()).toBeFalse();
    });

    it("ignores the mouse, which has the icon instead", function () {
      pointer(button, 'pointerdown', 'mouse', 50, 50);
      jasmine.clock().tick(1000);

      expect(menuIsOpen()).toBeFalse();
    });

    it("keeps the platform's own long-press menu away", function () {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

      button.dispatchEvent(event);

      expect(event.defaultPrevented).toBeTrue();
    });
  });

  describe("_isAdminUser", function () {
    let authManager;

    beforeEach(function () {
      authManager = {
        hasFeatureAccess: jasmine.createSpy('hasFeatureAccess').and.resolveTo(false),
      };
      spyOn(controller, '_getAuthManager').and.resolveTo(authManager);
    });

    it("is true for a member of the admin group", async function () {
      authManager.hasFeatureAccess.and.resolveTo(true);

      expect(await controller._isAdminUser()).toBeTrue();
      expect(authManager.hasFeatureAccess).toHaveBeenCalledOnceWith('admin');
    });

    it("is false for anyone else", async function () {
      expect(await controller._isAdminUser()).toBeFalse();
    });

    it("is false when signed out", async function () {
      controller._getAuthManager.and.resolveTo(null);

      expect(await controller._isAdminUser()).toBeFalse();
    });

    it("is false, rather than throwing, when the check fails", async function () {
      authManager.hasFeatureAccess.and.rejectWith(new Error('token refresh failed'));
      spyOn(console, 'error');

      expect(await controller._isAdminUser()).toBeFalse();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("editMoc", function () {
    let editor;
    let texture;

    beforeEach(function () {
      texture = { width: 16, height: 16 };
      Assets.cache.set('myMoc', texture);
      editor = {
        reset: jasmine.createSpy('reset'),
        showExisting: jasmine.createSpy('showExisting'),
      };
      LayoutController.editorController = editor;
      spyOn(LayoutPreservation.prototype, 'save').and.resolveTo();
      spyOn(controller, 'reset');
      spyOn(controller, '_isAdminUser').and.resolveTo(false);
    });

    it("opens the editor on the MOC, keeping the current layout", async function () {
      await controller.editMoc('myMoc');

      expect(LayoutPreservation.prototype.save).toHaveBeenCalledTimes(1);
      expect(controller.reset).toHaveBeenCalled();
      expect(controller.editorMode).toBeTrue();
      expect(document.body.classList.contains('editor-mode')).toBeTrue();
      expect(editor.showExisting).toHaveBeenCalledOnceWith(track, texture);
    });

    it("preserves the layout before clearing the workspace", async function () {
      await controller.editMoc('myMoc');

      expect(LayoutPreservation.prototype.save).toHaveBeenCalledBefore(controller.reset);
    });

    it("passes on whether the user is an admin", async function () {
      controller._isAdminUser.and.resolveTo(true);

      await controller.editMoc('myMoc');

      expect(editor.isAdmin).toBeTrue();
    });

    it("waits for a MOC whose image is still loading", async function () {
      Assets.cache.remove('myMoc');
      spyOn(Assets, 'load').and.resolveTo(texture);

      await controller.editMoc('myMoc');

      expect(Assets.load).toHaveBeenCalledWith('myMoc');
      expect(editor.showExisting).toHaveBeenCalledOnceWith(track, texture);
    });

    it("explains, and leaves the layout alone, when the image cannot be loaded", async function () {
      Assets.cache.remove('myMoc');
      spyOn(Assets, 'load').and.rejectWith(new Error('offline'));
      spyOn(console, 'error');

      await controller.editMoc('myMoc');

      expect(document.getElementById('cloudSnackbar').textContent)
        .toContain('Could not load MOC image');
      expect(LayoutPreservation.prototype.save).not.toHaveBeenCalled();
      expect(controller.reset).not.toHaveBeenCalled();
      expect(controller.editorMode).toBeFalse();
      expect(editor.showExisting).not.toHaveBeenCalled();
    });

    it("refuses while the editor is already open", async function () {
      // Entering again would preserve the editor's workspace over the real layout.
      controller.editorMode = true;
      spyOn(controller, '_showMocEditorModeDialog').and.resolveTo();

      await controller.editMoc('myMoc');

      expect(controller._showMocEditorModeDialog).toHaveBeenCalledOnceWith('edit');
      expect(LayoutPreservation.prototype.save).not.toHaveBeenCalled();
      expect(editor.showExisting).not.toHaveBeenCalled();
    });

    it("tells the user to exit the editor to edit MOCs", async function () {
      const pending = controller._showMocEditorModeDialog('edit');

      expect(document.getElementById('mocEditorModeDialog').textContent)
        .toContain('You must exit the Editor to edit MOCs.');
      document.getElementById('mocEditorModeDialogOk').click();
      await pending;
      expect(document.getElementById('mocEditorModeDialog')).toBeNull();
    });

    it("still tells the user to exit the editor to delete MOCs by default", async function () {
      const pending = controller._showMocEditorModeDialog();

      expect(document.getElementById('mocEditorModeDialog').textContent)
        .toContain('You must exit the Editor to delete MOCs.');
      document.getElementById('mocEditorModeDialogOk').click();
      await pending;
    });

    it("does nothing in read-only mode", async function () {
      controller.readOnly = true;

      await controller.editMoc('myMoc');

      expect(LayoutPreservation.prototype.save).not.toHaveBeenCalled();
      expect(editor.showExisting).not.toHaveBeenCalled();
    });

    it("does nothing for a component that is not a MOC", async function () {
      const stock = { alias: 'r104', name: 'Straight Track', category: 'track' };
      controller.trackData.bundles[0].assets.push(stock);

      await controller.editMoc('r104');
      await controller.editMoc('nothingHere');

      expect(LayoutPreservation.prototype.save).not.toHaveBeenCalled();
      expect(editor.showExisting).not.toHaveBeenCalled();
    });

    it("stops if the MOC is deleted while the editor is being prepared", async function () {
      controller._isAdminUser.and.callFake(async () => {
        controller.trackData.bundles[0].assets.length = 0;
        return false;
      });

      await controller.editMoc('myMoc');

      expect(LayoutPreservation.prototype.save).not.toHaveBeenCalled();
      expect(controller.editorMode).toBeFalse();
    });
  });
});
