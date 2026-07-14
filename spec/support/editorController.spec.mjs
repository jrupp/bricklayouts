import { EditorController } from "../../src/controller/editorController.js";
import { Assets } from "../../src/pixi.mjs";
import { PolarVector } from "../../src/model/polarVector.js";

describe("EditorController", function () {
  describe("computePrefill", function () {
    it("returns studs when both dimensions are multiples of 16", function () {
      const texture = { width: 32, height: 64 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 2, height: 4, units: 'studs' });
    });

    it("returns studs for large square multiples of 16", function () {
      const texture = { width: 320, height: 320 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 20, height: 20, units: 'studs' });
    });

    it("returns inches for dimensions that are integer multiples of 51.2", function () {
      // 51.2 * 5 = 256, which is also a multiple of 16, so studs wins by priority
      // Use a case where only inches makes sense - but any integer multiple of 51.2
      // is also a multiple of 16, so studs will always take priority for inches.
      // Verify that priority ordering: 256 x 256 → studs (16, 16), not inches (5, 5)
      const texture = { width: 256, height: 256 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 16, height: 16, units: 'studs' });
    });

    it("returns centimeters when dimensions are multiples of 20 but not 16", function () {
      const texture = { width: 60, height: 100 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 3, height: 5, units: 'centimeters' });
    });

    it("returns millimeters when dimensions are multiples of 2 but not 16 or 20", function () {
      const texture = { width: 6, height: 14 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 3, height: 7, units: 'millimeters' });
    });

    it("returns millimeters for dimensions divisible by 2 but not 16 or 20", function () {
      const texture = { width: 30, height: 30 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 15, height: 15, units: 'millimeters' });
    });

    it("returns null when no unit yields whole numbers", function () {
      const texture = { width: 33, height: 33 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toBeNull();
    });

    it("returns null when only one dimension is a whole number in a unit", function () {
      // 32 is multiple of 16 (2 studs), 33 is not
      const texture = { width: 32, height: 33 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toBeNull();
    });

    it("returns null for zero dimensions", function () {
      expect(EditorController.computePrefill(0, 32)).toBeNull();
      expect(EditorController.computePrefill(32, 0)).toBeNull();
    });

    it("returns null for negative dimensions", function () {
      expect(EditorController.computePrefill(-16, 16)).toBeNull();
    });

    it("returns null for non-finite dimensions", function () {
      expect(EditorController.computePrefill(NaN, 16)).toBeNull();
      expect(EditorController.computePrefill(16, Infinity)).toBeNull();
    });

    it("prioritizes studs over centimeters when both apply", function () {
      // 80 is divisible by both 16 (5 studs) and 20 (4 cm) - studs wins
      const texture = { width: 80, height: 80 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result.units).toBe('studs');
      expect(result.width).toBe(5);
      expect(result.height).toBe(5);
    });

    it("handles a 16x16 texture as 1x1 studs", function () {
      const texture = { width: 16, height: 16 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 1, height: 1, units: 'studs' });
    });

    it("handles a non-square studs texture", function () {
      const texture = { width: 48, height: 96 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 3, height: 6, units: 'studs' });
    });
  });

  describe("exportComponent", function () {
    let controller;
    let saveAsSpy;
    let logSpy;

    beforeEach(function () {
      // Fake instance — bypass the constructor's DOM wiring so this spec doesn't
      // need the full LayoutController bootstrap.
      controller = Object.create(EditorController.prototype);
      controller.baseData = {
        alias: 'testAlias',
        name: 'Test',
        category: 'structures',
        src: '',
        scale: 1,
        type: 0,
        make: 0,
        connections: []
      };
      controller.isAdmin = false;
      logSpy = spyOn(console, 'log');
      saveAsSpy = spyOn(window, 'saveAs').and.stub();
    });

    it("always logs the JSON to console", async function () {
      await controller.exportComponent();
      const logged = logSpy.calls.allArgs().find((args) => args[0] === '[component export]');
      expect(logged).toBeDefined();
      const parsed = JSON.parse(logged[1]);
      expect(parsed.alias).toBe('testAlias');
      expect(parsed.name).toBe('Test');
    });

    it("does not trigger a file download for non-admins", async function () {
      controller.isAdmin = false;
      await controller.exportComponent();
      expect(saveAsSpy).not.toHaveBeenCalled();
    });

    it("triggers a file download for admins", async function () {
      controller.isAdmin = true;
      await controller.exportComponent();
      expect(saveAsSpy).toHaveBeenCalledTimes(1);
      const [blob, filename] = saveAsSpy.calls.mostRecent().args;
      expect(blob).toEqual(jasmine.any(Blob));
      expect(filename).toBe('testAlias.json');
    });
  });

  describe("setTexture", function () {
    let controller;
    const alias = 'test-alias-' + Math.random().toString(36).slice(2);

    beforeEach(function () {
      controller = Object.create(EditorController.prototype);
      controller.currentAlias = null;
      controller.texture = null;
    });

    afterEach(function () {
      Assets.cache.remove(alias);
    });

    it("replaces this.texture", function () {
      const t1 = { width: 32, height: 32 };
      const t2 = { width: 16, height: 16 };
      controller.setTexture(t1);
      expect(controller.texture).toBe(t1);
      controller.setTexture(t2);
      expect(controller.texture).toBe(t2);
    });

    it("keeps the Assets cache entry in sync with the current alias", function () {
      // Regression: after crop, Component reads Assets.get(baseData.alias) — if
      // the cache still points at the pre-crop texture, the component renders
      // the wrong image (scaled to fit the target size instead of the cropped
      // region).
      const original = { width: 512, height: 512, id: 'original' };
      const cropped = { width: 256, height: 512, id: 'cropped' };
      controller.currentAlias = alias;
      controller.setTexture(original);
      expect(Assets.cache.get(alias)).toBe(original);
      controller.setTexture(cropped);
      expect(Assets.cache.get(alias)).toBe(cropped);
    });

    it("does not touch the cache when currentAlias is unset", function () {
      const before = Assets.cache.get(alias);
      controller.currentAlias = null;
      controller.setTexture({ width: 32, height: 32 });
      expect(Assets.cache.get(alias)).toBe(before);
    });
  });

  describe("reset", function () {
    let controller;
    let scaleInput;
    let aliasInput;
    let nameInput;
    let categories;
    let bpToggle;
    let bpColor;
    let bpField;
    let bpColorField;
    let connectionsList;
    let sizeDialog;
    let cropDialog;
    let connectionEditor;
    let geiSpy;

    beforeEach(function () {
      controller = Object.create(EditorController.prototype);
      controller.newComp = null;
      controller.testComps = [];
      controller.currentAlias = null;
      controller.texture = null;
      controller.baseData = { alias: 'x', name: 'x', category: 'x', scale: 5, connections: [], onbp: 0xff0000 };

      scaleInput = document.createElement('input');
      scaleInput.value = '5';
      aliasInput = document.createElement('input');
      aliasInput.value = 'staleAlias';
      nameInput = document.createElement('input');
      nameInput.value = 'Stale Name';
      categories = document.createElement('select');
      ['9V', 'structures', 'trees'].forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v;
        categories.appendChild(opt);
      });
      categories.selectedIndex = 1; // structures
      bpToggle = document.createElement('input');
      bpToggle.type = 'checkbox';
      bpToggle.checked = true;
      bpColor = document.createElement('select');
      ['#ff0000', '#00ff00'].forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v;
        bpColor.appendChild(opt);
      });
      bpColor.selectedIndex = 1;
      bpField = document.createElement('div');
      bpField.classList.remove('hidden');
      bpColorField = document.createElement('div');
      bpColorField.classList.remove('hidden');
      connectionsList = document.createElement('ul');
      connectionsList.innerHTML = '<li>stale</li>';
      sizeDialog = document.createElement('dialog');
      sizeDialog.id = 'editorSizeDialog';
      document.body.appendChild(sizeDialog);
      cropDialog = document.createElement('dialog');
      cropDialog.id = 'editorCropDialog';
      document.body.appendChild(cropDialog);
      connectionEditor = document.createElement('div');
      connectionEditor.setAttribute('data-connection', '3');

      geiSpy = spyOn(document, 'getElementById');
      geiSpy.and.returnValue(null);
      geiSpy.withArgs('componentScale').and.returnValue(scaleInput);
      geiSpy.withArgs('componentAlias').and.returnValue(aliasInput);
      geiSpy.withArgs('componentName').and.returnValue(nameInput);
      geiSpy.withArgs('componentCategories').and.returnValue(categories);
      geiSpy.withArgs('componentBaseplateToggle').and.returnValue(bpToggle);
      geiSpy.withArgs('componentBaseplateColor').and.returnValue(bpColor);
      geiSpy.withArgs('componentBaseplateField').and.returnValue(bpField);
      geiSpy.withArgs('componentBaseplateColorField').and.returnValue(bpColorField);
      geiSpy.withArgs('componentEditorConnectionsList').and.returnValue(connectionsList);
      geiSpy.withArgs('editorSizeDialog').and.returnValue(sizeDialog);
      geiSpy.withArgs('editorCropDialog').and.returnValue(cropDialog);
      geiSpy.withArgs('connectionEditor').and.returnValue(connectionEditor);
    });

    afterEach(function () {
      sizeDialog.remove();
      cropDialog.remove();
    });

    it("clears internal state (texture, baseData, testComps)", function () {
      controller.testComps = [{ destroy: jasmine.createSpy('destroy') }];
      controller.texture = { width: 32, height: 32 };
      controller.reset();
      expect(controller.texture).toBeNull();
      expect(controller.testComps).toHaveSize(0);
      expect(controller.baseData.alias).toBe('newComponent');
      expect(controller.baseData.name).toBe('New Component');
      expect(controller.baseData.category).toBe('9V');
    });

    it("resets form inputs so a subsequent session starts fresh", function () {
      // Regression: category/baseplate/etc. carried over into the next editor
      // session because onComponentSave re-reads the DOM. reset() must clear
      // these back to defaults.
      controller.reset();
      expect(scaleInput.value).toBe('1');
      expect(aliasInput.value).toBe('newComponent');
      expect(nameInput.value).toBe('New Component');
      expect(categories.options[categories.selectedIndex].value).toBe('9V');
      expect(bpToggle.checked).toBeFalse();
      expect(bpColor.selectedIndex).toBe(0);
      expect(bpField.classList.contains('hidden')).toBeTrue();
      expect(bpColorField.classList.contains('hidden')).toBeTrue();
      expect(connectionsList.innerHTML).toBe('');
    });

    it("removes transient dialogs and hides the connection editor", function () {
      controller.reset();
      expect(document.getElementById.calls.any()).toBeTrue();
      expect(sizeDialog.parentNode).toBeNull();
      expect(cropDialog.parentNode).toBeNull();
      expect(connectionEditor.classList.contains('hidden')).toBeTrue();
      expect(connectionEditor.getAttribute('data-connection')).toBe('-1');
    });
  });

  describe("texture protection", function () {
    let controller;
    const alias = 'test-commit-alias-' + Math.random().toString(36).slice(2);

    function makeTexture() {
      return { width: 32, height: 32, destroy: jasmine.createSpy('destroy') };
    }

    beforeEach(function () {
      controller = Object.create(EditorController.prototype);
      controller.newComp = null;
      controller.testComps = [];
      controller.currentAlias = alias;
      controller.texture = makeTexture();
      controller.committed = false;
      controller.baseData = {
        alias,
        name: 'Committed',
        category: '9V',
        src: '',
        image: controller.texture,
        scale: 1.0,
        make: 0,
        type: 0,
        connections: []
      };
      Assets.cache.set(alias, controller.texture);
    });

    afterEach(function () {
      Assets.cache.remove(alias);
    });

    describe("setTexture", function () {
      it("replaces the cached texture when not committed", function () {
        const replacement = makeTexture();
        controller.setTexture(replacement);
        expect(Assets.cache.get(alias)).toBe(replacement);
      });

      it("leaves the cache alone when committed", function () {
        const original = Assets.cache.get(alias);
        controller.committed = true;
        controller.setTexture(makeTexture());
        expect(Assets.cache.get(alias)).toBe(original);
      });

      it("still updates this.texture when committed (so editor can move on)", function () {
        controller.committed = true;
        const next = makeTexture();
        controller.setTexture(next);
        expect(controller.texture).toBe(next);
      });
    });

    describe("reset", function () {
      let scaleInput, aliasInput, nameInput, categories, bpToggle, bpColor,
          bpField, bpColorField, connectionsList, sizeDialog, cropDialog,
          connectionEditor, geiSpy;

      beforeEach(function () {
        scaleInput = document.createElement('input');
        aliasInput = document.createElement('input');
        nameInput = document.createElement('input');
        categories = document.createElement('select');
        ['9V', 'structures'].forEach((v) => {
          const opt = document.createElement('option');
          opt.value = v;
          categories.appendChild(opt);
        });
        bpToggle = document.createElement('input');
        bpToggle.type = 'checkbox';
        bpColor = document.createElement('select');
        const opt = document.createElement('option');
        opt.value = '#ff0000';
        bpColor.appendChild(opt);
        bpField = document.createElement('div');
        bpColorField = document.createElement('div');
        connectionsList = document.createElement('ul');
        sizeDialog = document.createElement('dialog');
        sizeDialog.id = 'editorSizeDialog';
        document.body.appendChild(sizeDialog);
        cropDialog = document.createElement('dialog');
        cropDialog.id = 'editorCropDialog';
        document.body.appendChild(cropDialog);
        connectionEditor = document.createElement('div');

        geiSpy = spyOn(document, 'getElementById');
        geiSpy.and.returnValue(null);
        geiSpy.withArgs('componentScale').and.returnValue(scaleInput);
        geiSpy.withArgs('componentAlias').and.returnValue(aliasInput);
        geiSpy.withArgs('componentName').and.returnValue(nameInput);
        geiSpy.withArgs('componentCategories').and.returnValue(categories);
        geiSpy.withArgs('componentBaseplateToggle').and.returnValue(bpToggle);
        geiSpy.withArgs('componentBaseplateColor').and.returnValue(bpColor);
        geiSpy.withArgs('componentBaseplateField').and.returnValue(bpField);
        geiSpy.withArgs('componentBaseplateColorField').and.returnValue(bpColorField);
        geiSpy.withArgs('componentEditorConnectionsList').and.returnValue(connectionsList);
        geiSpy.withArgs('editorSizeDialog').and.returnValue(sizeDialog);
        geiSpy.withArgs('editorCropDialog').and.returnValue(cropDialog);
        geiSpy.withArgs('connectionEditor').and.returnValue(connectionEditor);
      });

      afterEach(function () {
        sizeDialog.remove();
        cropDialog.remove();
      });

      it("destroys and removes the cached texture when not committed", function () {
        const tex = controller.texture;
        controller.reset();
        expect(tex.destroy).toHaveBeenCalledWith(true);
        expect(Assets.cache.get(alias)).toBeUndefined();
      });

      it("leaves the cached texture intact when committed", function () {
        const tex = controller.texture;
        controller.committed = true;
        controller.reset();
        expect(tex.destroy).not.toHaveBeenCalled();
        expect(Assets.cache.get(alias)).toBe(tex);
      });

      it("clears the committed flag so the next session behaves normally", function () {
        controller.committed = true;
        controller.reset();
        expect(controller.committed).toBeFalse();
      });
    });
  });

  describe("exportComponent commit", function () {
    let controller;
    let bundleAssets;
    let extractSpy;
    let generatedImage;

    beforeEach(function () {
      generatedImage = document.createElement('img');
      bundleAssets = [];
      extractSpy = jasmine.createSpy('extractTrackImage')
        .and.returnValue(Promise.resolve(generatedImage));
      controller = Object.create(EditorController.prototype);
      controller.isAdmin = false;
      controller.committed = false;
      controller.currentAlias = 'ea';
      controller.texture = { width: 16, height: 16 };
      controller.baseData = {
        alias: 'ea',
        name: 'Exported Alias',
        category: '9V',
        src: '',
        image: controller.texture,
        scale: 1.0,
        make: 0,
        type: 0,
        connections: [
          { type: 1, vector: new PolarVector(10, 0.5, 0.25), next: 0 }
        ]
      };
      controller.layoutController = {
        trackData: { bundles: [{ assets: bundleAssets }] },
        extractTrackImage: extractSpy
      };
      spyOn(console, 'log');
      spyOn(window, 'saveAs').and.stub();
    });

    it("pushes a copy of baseData onto trackData.bundles[0].assets", async function () {
      await controller.exportComponent();
      expect(bundleAssets.length).toBe(1);
      expect(bundleAssets[0]).not.toBe(controller.baseData);
      expect(bundleAssets[0].alias).toBe('ea');
      expect(bundleAssets[0].name).toBe('Exported Alias');
    });

    it("deep-copies connections so later edits do not clobber the committed track", async function () {
      await controller.exportComponent();
      const committed = bundleAssets[0];
      expect(committed.connections).not.toBe(controller.baseData.connections);
      expect(committed.connections[0]).not.toBe(controller.baseData.connections[0]);
      expect(committed.connections[0].vector).not.toBe(controller.baseData.connections[0].vector);

      controller.baseData.connections[0].vector.magnitude = 999;
      controller.baseData.connections[0].next = 42;
      expect(committed.connections[0].vector.magnitude).toBe(10);
      expect(committed.connections[0].next).toBe(0);
    });

    it("generates a track image via layoutController.extractTrackImage", async function () {
      await controller.exportComponent();
      expect(extractSpy).toHaveBeenCalledTimes(1);
      expect(extractSpy).toHaveBeenCalledWith(bundleAssets[0]);
      expect(bundleAssets[0].image).toBe(generatedImage);
    });

    it("sets the committed flag on success", async function () {
      expect(controller.committed).toBeFalse();
      await controller.exportComponent();
      expect(controller.committed).toBeTrue();
    });

    it("does not commit or throw when no bundle is available", async function () {
      controller.layoutController = { trackData: { bundles: [] } };
      await controller.exportComponent();
      expect(controller.committed).toBeFalse();
      expect(extractSpy).not.toHaveBeenCalled();
    });
  });
});
