import { DataTypes, LayoutController } from "../../src/controller/layoutController.js";
import { Component } from "../../src/model/component.js";
import { LayoutLayer } from "../../src/model/layoutLayer.js";
import { Pose } from "../../src/model/pose.js";
import { Application, Assets, Graphics, Sprite, path } from '../../src/pixi.mjs';

function noop() {}
if (!window.ui) window.ui = noop;

const PHOTO_BASE_DATA = {
  alias: 'photo',
  name: 'Photo',
  category: 'custom',
  type: 'photo',
  src: 'photo-camera.png'
};

function makeMockLayer() {
  const layer = new LayoutLayer();
  layer.tree = {
    insert: jasmine.createSpy('insert'),
    remove: jasmine.createSpy('remove'),
    search: jasmine.createSpy('search').and.returnValue([]),
    load: jasmine.createSpy('load'),
    clear: jasmine.createSpy('clear')
  };
  return layer;
}

describe("photo component", function () {
  beforeAll(async function () {
    if (!window.app) {
      const app = new Application();
      await app.init({ preference: 'webgl' });
      await Assets.init({ basePath: '../__spec__/img/', manifest: "../data/manifest.json" });
      await Assets.loadBundle('track');
      await Assets.load({ alias: path.toAbsolute('../data/manifest.json'), src: '../data/manifest.json' });
      window.app = app;
      window.assets = Assets;
    }
    if (!window.RBush) {
      window.RBush = class RBush {
        insert() {} remove() {} search() { return []; } load() {} clear() {}
      };
    }
    if (!Assets.cache.has('photoOutlineSvg')) {
      try {
        await Assets.load({ alias: 'photoOutlineSvg', src: 'photo-outline.svg', data: { parseAsGraphicsContext: true } });
      } catch (e) {
        // ignore — tests that need it will skip via guard
      }
    }
  });

  describe("DataTypes", function () {
    it("exposes PHOTO enum value", function () {
      expect(DataTypes.PHOTO).toBe('photo');
    });
  });

  describe("construction", function () {
    it("creates a photo component with a Sprite and a Graphics child", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, 0), layer);
      expect(comp.sprite).toBeInstanceOf(Sprite);
      expect(comp.photoGraphics).toBeInstanceOf(Graphics);
      expect(comp.children).toContain(comp.photoGraphics);
      const spriteAncestor = comp.children.find(c => c !== comp.photoGraphics && c.children?.includes(comp.sprite));
      expect(spriteAncestor).toBeDefined();
    });

    it("uses the photo camera texture for the sprite", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, 0), layer);
      expect(comp.sprite.texture).toBe(Assets.get('photo'));
    });

    it("anchors the outline graphics so its tip sits at the component origin", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, 0), layer);
      expect(comp.photoGraphics.pivot.x).toBe(50);
      expect(comp.photoGraphics.pivot.y).toBe(100);
    });

    it("defaults text and url to empty strings", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, 0), layer);
      expect(comp.text).toBe('');
      expect(comp.url).toBe('');
    });

    it("stores text and url passed via options", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, 0), layer, {
        text: 'Birthday',
        url: 'https://example.com/a.jpg'
      });
      expect(comp.text).toBe('Birthday');
      expect(comp.url).toBe('https://example.com/a.jpg');
    });

    it("inserts a 100x100 bbox into the collision tree centered on position", function () {
      const layer = makeMockLayer();
      new Component(PHOTO_BASE_DATA, new Pose(40, 20, 0), layer);
      expect(layer.tree.insert).toHaveBeenCalledTimes(1);
      const arg = layer.tree.insert.calls.mostRecent().args[0];
      expect(arg.minX).toBe(-10);
      expect(arg.minY).toBe(-30);
      expect(arg.maxX).toBe(90);
      expect(arg.maxY).toBe(70);
    });
  });

  describe("rotation isolation", function () {
    it("rotation is applied at the Component level and the sprite counter-rotates upright", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, Math.PI / 4), layer);
      expect(comp.rotation).toBeCloseTo(Math.PI / 4);
      expect(comp.sprite.rotation).toBeCloseTo(-Math.PI / 4);
    });

    it("rotate() accumulates on the Component and keeps the sprite visually upright", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, 0), layer);
      for (let i = 0; i < 5; i++) {
        comp.rotate();
      }
      expect(comp.rotation).toBeCloseTo(5 * Math.PI / 8);
      expect(comp.sprite.rotation).toBeCloseTo(-5 * Math.PI / 8);
    });

    it("getPose() reports the Component angle for photo components", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(10, 20, Math.PI / 3), layer);
      const pose = comp.getPose();
      expect(pose.angle).toBeCloseTo(Math.PI / 3);
      expect(pose.x).toBe(10);
      expect(pose.y).toBe(20);
    });
  });

  describe("url getter/setter", function () {
    it("setter updates the url field", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, 0), layer);
      comp.url = 'https://new.example.com/img.png';
      expect(comp.url).toBe('https://new.example.com/img.png');
    });

    it("setter coerces null to empty string", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, 0), layer, { url: 'https://x.y' });
      comp.url = null;
      expect(comp.url).toBe('');
    });

    it("setter only mutates for photo components (no throw with non-photo type check)", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, 0), layer);
      comp.url = '';
      expect(comp.url).toBe('');
    });
  });

  describe("text setter for photo", function () {
    it("updates text without touching sprite.text", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(0, 0, 0), layer, { text: 'Old' });
      comp.text = 'New';
      expect(comp.text).toBe('New');
      expect(comp.sprite.text).toBeUndefined();
    });
  });

  describe("serialize / deserialize round-trip", function () {
    it("serialized JSON includes type, text, and url for photo components", function () {
      const layer = makeMockLayer();
      const comp = new Component(PHOTO_BASE_DATA, new Pose(100, 200, Math.PI / 2), layer, {
        text: 'Wedding',
        url: 'https://photos.example.com/w.jpg'
      });
      const json = comp.serialize();
      expect(json.type).toBe('photo');
      expect(json.text).toBe('Wedding');
      expect(json.url).toBe('https://photos.example.com/w.jpg');
      expect(json.pose).toBeDefined();
    });

    it("deserialize restores text, url, and angle", function () {
      const layer = makeMockLayer();
      const original = new Component(PHOTO_BASE_DATA, new Pose(50, 75, Math.PI / 6), layer, {
        text: 'Family',
        url: 'https://example.com/family.png'
      });
      original.connections = [];
      const json = original.serialize();
      const restored = Component.deserialize(PHOTO_BASE_DATA, json, layer);
      expect(restored.text).toBe('Family');
      expect(restored.url).toBe('https://example.com/family.png');
      expect(restored.getPose().angle).toBeCloseTo(Math.PI / 6);
      expect(restored.position.x).toBe(50);
      expect(restored.position.y).toBe(75);
    });
  });

  describe("_applyPhotosLayerInteractivity", function () {
    it("forces eventMode=passive and interactiveChildren=true on layers named Photos", function () {
      const photosLayer = new LayoutLayer();
      photosLayer.label = 'Photos';
      photosLayer.eventMode = 'none';
      photosLayer.interactiveChildren = false;
      const otherLayer = new LayoutLayer();
      otherLayer.label = 'Layer 1';
      otherLayer.eventMode = 'none';
      otherLayer.interactiveChildren = false;
      const mockController = {
        layers: [photosLayer, otherLayer],
        _applyPhotosLayerInteractivity: LayoutController.prototype._applyPhotosLayerInteractivity
      };
      mockController._applyPhotosLayerInteractivity();
      expect(photosLayer.eventMode).toBe('passive');
      expect(photosLayer.interactiveChildren).toBeTrue();
      expect(otherLayer.eventMode).toBe('none');
      expect(otherLayer.interactiveChildren).toBeFalse();
    });

    it("ignores layers without a Photos label", function () {
      const layer = new LayoutLayer();
      layer.label = 'Background';
      layer.eventMode = 'none';
      layer.interactiveChildren = false;
      const mockController = {
        layers: [layer],
        _applyPhotosLayerInteractivity: LayoutController.prototype._applyPhotosLayerInteractivity
      };
      mockController._applyPhotosLayerInteractivity();
      expect(layer.eventMode).toBe('none');
      expect(layer.interactiveChildren).toBeFalse();
    });
  });

  describe("_showPhotoDetailsBalloon / _hidePhotoDetailsBalloon", function () {
    function makeMockBalloonController() {
      const balloon = document.createElement('nav');
      balloon.classList.add('hidden');
      const title = document.createElement('h6');
      const img = document.createElement('img');
      return {
        controller: {
          photoDetailsBalloon: balloon,
          photoDetailsTitle: title,
          photoDetailsImg: img,
          _showPhotoDetailsBalloon: LayoutController.prototype._showPhotoDetailsBalloon,
          _hidePhotoDetailsBalloon: LayoutController.prototype._hidePhotoDetailsBalloon
        },
        balloon, title, img
      };
    }

    it("populates title text and image src then unhides the balloon", function () {
      const { controller, balloon, title, img } = makeMockBalloonController();
      const fakeComp = { text: 'Birthday', url: 'https://example.com/b.jpg' };
      controller._showPhotoDetailsBalloon(fakeComp);
      expect(title.textContent).toBe('Birthday');
      expect(img.getAttribute('src')).toBe('https://example.com/b.jpg');
      expect(balloon.classList.contains('hidden')).toBeFalse();
    });

    it("hides the balloon and clears the image src", function () {
      const { controller, balloon, img } = makeMockBalloonController();
      controller._showPhotoDetailsBalloon({ text: 'x', url: 'https://example.com/x.jpg' });
      controller._hidePhotoDetailsBalloon();
      expect(balloon.classList.contains('hidden')).toBeTrue();
      expect(img.hasAttribute('src')).toBeFalse();
    });

    it("show is a no-op if balloon element is missing", function () {
      const controller = {
        photoDetailsBalloon: null,
        _showPhotoDetailsBalloon: LayoutController.prototype._showPhotoDetailsBalloon
      };
      expect(() => controller._showPhotoDetailsBalloon({ text: 't', url: 'u' })).not.toThrow();
    });
  });

  describe("_ensurePhotosLayer", function () {
    it("returns the existing Photos layer if one exists", function () {
      const photos = new LayoutLayer();
      photos.label = 'Photos';
      const other = new LayoutLayer();
      other.label = 'Other';
      let currentLayerSet = null;
      const controller = {
        layers: [other, photos],
        get currentLayer() { return currentLayerSet; },
        set currentLayer(v) { currentLayerSet = v; },
        newLayer: jasmine.createSpy('newLayer'),
        updateLayerList: jasmine.createSpy('updateLayerList'),
        _applyPhotosLayerInteractivity: jasmine.createSpy('_applyPhotosLayerInteractivity'),
        _ensurePhotosLayer: LayoutController.prototype._ensurePhotosLayer
      };
      const result = controller._ensurePhotosLayer();
      expect(result).toBe(photos);
      expect(controller.newLayer).not.toHaveBeenCalled();
      expect(currentLayerSet).toBe(photos);
    });
  });

  describe("showPhotoDialog editing class", function () {
    let prevGei;
    let dialog, titleInput, urlInput, dialogTitleEl;

    beforeEach(function () {
      dialog = document.createElement('dialog');
      dialog.id = 'photoComponentDialog';
      titleInput = document.createElement('input');
      urlInput = document.createElement('input');
      dialogTitleEl = document.createElement('h6');
      prevGei = document.getElementById;
      const stub = jasmine.createSpy('getElementById').and.callFake((id) => {
        if (id === 'photoComponentDialog') return dialog;
        if (id === 'photoTitle') return titleInput;
        if (id === 'photoUrl') return urlInput;
        if (id === 'photoDialogTitle') return dialogTitleEl;
        return null;
      });
      document.getElementById = stub;
    });

    afterEach(function () {
      document.getElementById = prevGei;
    });

    it("removes the editing class when opening for create", function () {
      dialog.classList.add('editing');
      const controller = { showPhotoDialog: LayoutController.prototype.showPhotoDialog };
      controller.showPhotoDialog(false);
      expect(dialog.classList.contains('editing')).toBeFalse();
    });

    it("adds the editing class when opening to edit a selected photo", function () {
      const prevSelected = LayoutController.selectedComponent;
      LayoutController.selectedComponent = {
        baseData: { type: DataTypes.PHOTO },
        text: 'T', url: 'https://example.com/x.jpg'
      };
      try {
        const controller = { showPhotoDialog: LayoutController.prototype.showPhotoDialog };
        controller.showPhotoDialog(true);
        expect(dialog.classList.contains('editing')).toBeTrue();
        expect(titleInput.value).toBe('T');
        expect(urlInput.value).toBe('https://example.com/x.jpg');
      } finally {
        LayoutController.selectedComponent = prevSelected;
      }
    });
  });

  describe("_validatePhotoDialogInputs", function () {
    let prevGei;
    let titleInput, urlInput, titleField, urlField;

    function makeFieldWithInput(input) {
      const field = document.createElement('div');
      field.appendChild(input);
      return field;
    }

    beforeEach(function () {
      titleInput = document.createElement('input');
      urlInput = document.createElement('input');
      titleField = makeFieldWithInput(titleInput);
      urlField = makeFieldWithInput(urlInput);
      prevGei = document.getElementById;
      document.getElementById = jasmine.createSpy('getElementById').and.callFake((id) => {
        if (id === 'photoTitle') return titleInput;
        if (id === 'photoUrl') return urlInput;
        return null;
      });
    });

    afterEach(function () {
      document.getElementById = prevGei;
    });

    function validate() {
      const controller = { _validatePhotoDialogInputs: LayoutController.prototype._validatePhotoDialogInputs };
      return controller._validatePhotoDialogInputs();
    }

    it("returns null and marks both fields invalid when both are empty", function () {
      titleInput.value = '';
      urlInput.value = '';
      expect(validate()).toBeNull();
      expect(titleField.classList.contains('invalid')).toBeTrue();
      expect(urlField.classList.contains('invalid')).toBeTrue();
    });

    it("returns null when title is whitespace-only", function () {
      titleInput.value = '   ';
      urlInput.value = 'https://example.com/a.jpg';
      expect(validate()).toBeNull();
      expect(titleField.classList.contains('invalid')).toBeTrue();
      expect(urlField.classList.contains('invalid')).toBeFalse();
    });

    it("returns null when URL is missing the https:// scheme", function () {
      titleInput.value = 'Birthday';
      urlInput.value = 'http://example.com/a.jpg';
      expect(validate()).toBeNull();
      expect(urlField.classList.contains('invalid')).toBeTrue();
    });

    it("returns null when URL has no scheme", function () {
      titleInput.value = 'Birthday';
      urlInput.value = 'example.com/a.jpg';
      expect(validate()).toBeNull();
      expect(urlField.classList.contains('invalid')).toBeTrue();
    });

    it("returns null when URL is malformed", function () {
      titleInput.value = 'Birthday';
      urlInput.value = 'https://';
      expect(validate()).toBeNull();
      expect(urlField.classList.contains('invalid')).toBeTrue();
    });

    it("returns the trimmed values when title and URL are valid", function () {
      titleInput.value = '  Birthday  ';
      urlInput.value = '  https://example.com/a.jpg  ';
      const result = validate();
      expect(result).toEqual({ title: 'Birthday', url: 'https://example.com/a.jpg' });
      expect(titleField.classList.contains('invalid')).toBeFalse();
      expect(urlField.classList.contains('invalid')).toBeFalse();
    });
  });

  describe("onCreatePhoto / onSavePhoto validation", function () {
    let prevGei, titleInput, urlInput;
    beforeEach(function () {
      titleInput = document.createElement('input');
      urlInput = document.createElement('input');
      const titleField = document.createElement('div'); titleField.appendChild(titleInput);
      const urlField = document.createElement('div'); urlField.appendChild(urlInput);
      prevGei = document.getElementById;
      document.getElementById = jasmine.createSpy('getElementById').and.callFake((id) => {
        if (id === 'photoTitle') return titleInput;
        if (id === 'photoUrl') return urlInput;
        return null;
      });
    });
    afterEach(function () {
      document.getElementById = prevGei;
    });

    it("onCreatePhoto does not call addComponent when inputs are invalid", function () {
      titleInput.value = '';
      urlInput.value = 'http://no-https.com/a.jpg';
      const controller = {
        trackData: { bundles: [{ assets: [{ alias: 'photo' }] }] },
        addComponent: jasmine.createSpy('addComponent'),
        _ensurePhotosLayer: jasmine.createSpy('_ensurePhotosLayer'),
        _validatePhotoDialogInputs: LayoutController.prototype._validatePhotoDialogInputs,
        onCreatePhoto: LayoutController.prototype.onCreatePhoto
      };
      controller.onCreatePhoto();
      expect(controller.addComponent).not.toHaveBeenCalled();
      expect(controller._ensurePhotosLayer).not.toHaveBeenCalled();
    });

    it("onSavePhoto does not mutate the component or record undo when inputs are invalid", function () {
      const prevSelected = LayoutController.selectedComponent;
      const comp = {
        baseData: { type: DataTypes.PHOTO },
        text: 'Old', url: 'https://example.com/old.jpg',
        locked: false,
        uuid: 'p1',
        serialize: jasmine.createSpy('serialize').and.returnValue({}),
        layer: { uuid: 'l1', children: [] }
      };
      LayoutController.selectedComponent = comp;
      try {
        titleInput.value = 'New';
        urlInput.value = 'not-a-url';
        const controller = {
          undoManager: { record: jasmine.createSpy('record') },
          _validatePhotoDialogInputs: LayoutController.prototype._validatePhotoDialogInputs,
          _positionSelectionToolbar: jasmine.createSpy('_positionSelectionToolbar'),
          onSavePhoto: LayoutController.prototype.onSavePhoto
        };
        controller.onSavePhoto();
        expect(comp.text).toBe('Old');
        expect(comp.url).toBe('https://example.com/old.jpg');
        expect(controller.undoManager.record).not.toHaveBeenCalled();
      } finally {
        LayoutController.selectedComponent = prevSelected;
      }
    });
  });
});
