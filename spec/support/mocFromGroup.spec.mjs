/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import { LayoutController } from "../../src/controller/layoutController.js";
import { ComponentGroup } from "../../src/model/componentGroup.js";
import { LayoutLayer } from "../../src/model/layoutLayer.js";
import { Application, Assets, Container, Graphics, Texture } from "../../src/pixi.mjs";

/**
 * A stand-in for a Component on a layer: a container holding a rectangle, with
 * an open connection marker sticking out past it.
 * @param {Container} layer
 * @param {Number} x
 * @param {Number} y
 * @param {Number} width
 * @param {Number} height
 * @returns {Container}
 */
function addMember(layer, x, y, width, height) {
  const member = new Container();
  member.position.set(x, y);
  member.addChild(new Graphics().rect(0, 0, width, height).fill(0xff0000));
  const circle = new Graphics().circle(0, 0, 10).fill(0xffff00);
  circle.position.set(width, height / 2);
  member.addChild(circle);
  member.connections = [{ circle }];
  layer.addChild(member);
  return member;
}

/**
 * Creating a MOC from the selected ComponentGroup renders just its components
 * and opens the Editor on the result. The renderer and the editor are faked;
 * showing the editor at a known size is covered in editorController.spec.mjs.
 */
describe("LayoutController MOC from group", function () {
  let controller;
  let layer;
  let editor;
  let extractSpy;
  let savedSelected;

  beforeEach(function () {
    layer = new Container();
    layer.overlay = new Container();
    layer.addChild(layer.overlay);

    extractSpy = jasmine.createSpy('extract.canvas').and.callFake((options) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(options.frame.width * options.resolution);
      canvas.height = Math.round(options.frame.height * options.resolution);
      return canvas;
    });

    controller = Object.create(LayoutController.prototype);
    controller.readOnly = false;
    controller.editorMode = false;
    controller.app = {
      renderer: { gl: { MAX_TEXTURE_SIZE: 4096 }, extract: { canvas: extractSpy } },
    };
    spyOn(controller, '_isAdminUser').and.resolveTo(false);
    spyOn(controller, '_hideSelectionToolbar');
    spyOn(controller, '_showSelectionToolbar');
    spyOn(controller, '_positionSelectionToolbar');
    spyOn(controller, '_showMocEditorModeDialog').and.resolveTo();
    spyOn(LayoutController, 'getInstance').and.returnValue(controller);

    editor = {
      baseData: {},
      showRendered: jasmine.createSpy('showRendered'),
    };
    spyOn(controller, '_enterEditorMode').and.callFake(async () => {
      controller.editorMode = true;
      return editor;
    });

    savedSelected = LayoutController.selectedComponent;
  });

  afterEach(function () {
    if (editor.currentAlias) {
      Assets.cache.remove(editor.currentAlias);
    }
    LayoutController.selectedComponent = savedSelected;
    document.getElementById('cloudSnackbar')?.remove();
  });

  /**
   * Select a group of the given members.
   * @param {Array<Container>} members
   * @param {Boolean} [temporary=false]
   * @returns {ComponentGroup}
   */
  function selectGroup(members, temporary = false) {
    const group = new ComponentGroup(temporary);
    members.forEach((member) => group.addComponent(member));
    LayoutController.selectedComponent = group;
    return group;
  }

  describe("createMocFromSelection", function () {
    it("does nothing in read-only mode", async function () {
      selectGroup([addMember(layer, 0, 0, 32, 32)]);
      controller.readOnly = true;

      await controller.createMocFromSelection();

      expect(extractSpy).not.toHaveBeenCalled();
      expect(controller._enterEditorMode).not.toHaveBeenCalled();
    });

    it("tells the user to exit the Editor first when it is open", async function () {
      selectGroup([addMember(layer, 0, 0, 32, 32)]);
      controller.editorMode = true;

      await controller.createMocFromSelection();

      expect(controller._showMocEditorModeDialog).toHaveBeenCalledOnceWith('create');
      expect(controller._enterEditorMode).not.toHaveBeenCalled();
    });

    it("does nothing when a single component is selected", async function () {
      LayoutController.selectedComponent = addMember(layer, 0, 0, 32, 32);

      await controller.createMocFromSelection();

      expect(extractSpy).not.toHaveBeenCalled();
      expect(controller._enterEditorMode).not.toHaveBeenCalled();
    });

    it("renders the group, then opens the Editor on it at the group's size", async function () {
      selectGroup([addMember(layer, 16, 16, 32, 32), addMember(layer, 48, 32, 64, 16)]);
      extractSpy.and.callFake((options) => {
        expect(controller._enterEditorMode).not.toHaveBeenCalled();
        const canvas = document.createElement('canvas');
        canvas.width = options.frame.width;
        canvas.height = options.frame.height;
        return canvas;
      });

      await controller.createMocFromSelection();

      expect(LayoutController.selectedComponent).toBeNull();
      expect(extractSpy).toHaveBeenCalledTimes(1);
      expect(controller._enterEditorMode).toHaveBeenCalledOnceWith(false);
      expect(editor.showRendered).toHaveBeenCalledTimes(1);
      const [texture, width, height] = editor.showRendered.calls.argsFor(0);
      expect(width).toBe(96);
      expect(height).toBe(32);
      expect(texture.width).toBe(96);
      expect(texture.height).toBe(32);
      expect(Assets.cache.get(editor.currentAlias)).toBe(texture);
      expect(editor.baseData.alias).toBe(editor.currentAlias);
    });

    it("renders a temporary group, even though deselecting destroys it", async function () {
      const group = selectGroup(
        [addMember(layer, 0, 0, 32, 32), addMember(layer, 32, 0, 32, 32)], true);

      await controller.createMocFromSelection();

      expect(group.destroyed).toBeTrue();
      const [, width, height] = editor.showRendered.calls.argsFor(0);
      expect(width).toBe(64);
      expect(height).toBe(32);
    });

    it("renders the components of nested groups", async function () {
      const inner = new ComponentGroup();
      inner.addComponent(addMember(layer, 0, 0, 32, 32));
      inner.addComponent(addMember(layer, 64, 0, 32, 32));
      const outer = new ComponentGroup();
      outer.addComponent(inner);
      outer.addComponent(addMember(layer, 0, 64, 16, 16));
      LayoutController.selectedComponent = outer;

      await controller.createMocFromSelection();

      const [, width, height] = editor.showRendered.calls.argsFor(0);
      expect(width).toBe(96);
      expect(height).toBe(80);
    });

    it("reports a failed render and stays out of the Editor", async function () {
      spyOn(console, 'error');
      selectGroup([addMember(layer, 0, 0, 32, 32)]);
      extractSpy.and.throwError('context lost');

      await controller.createMocFromSelection();

      expect(controller._enterEditorMode).not.toHaveBeenCalled();
      expect(document.getElementById('cloudSnackbar').textContent)
        .toContain('Could not create MOC image');
    });

    it("stays out of the Editor if one opened while checking for admin", async function () {
      selectGroup([addMember(layer, 0, 0, 32, 32)]);
      controller._isAdminUser.and.callFake(async () => {
        controller.editorMode = true;
        return false;
      });

      await controller.createMocFromSelection();

      expect(extractSpy).not.toHaveBeenCalled();
      expect(controller._enterEditorMode).not.toHaveBeenCalled();
    });
  });

  describe("_renderComponentsToTexture", function () {
    it("renders the layer, framed to the components, at 1 pixel per world unit", async function () {
      const a = addMember(layer, 16.5, 16, 32, 32);
      const b = addMember(layer, 48, 32, 64, 16.25);

      const result = await controller._renderComponentsToTexture([a, b]);

      const options = extractSpy.calls.argsFor(0)[0];
      expect(options.target).toBe(layer);
      expect(options.resolution).toBe(1);
      expect(options.frame.x).toBe(16);
      expect(options.frame.y).toBe(16);
      expect(options.frame.width).toBe(96);
      expect(options.frame.height).toBe(33);
      expect(result.width).toBe(96);
      expect(result.height).toBe(33);
      expect(result.texture).toBeInstanceOf(Texture);
    });

    it("is not affected by the layer's parent being zoomed and panned", async function () {
      const workspace = new Container();
      workspace.scale.set(0.25);
      workspace.position.set(-500, 300);
      workspace.addChild(layer);
      const member = addMember(layer, 32, 48, 64, 32);

      const result = await controller._renderComponentsToTexture([member]);

      const options = extractSpy.calls.argsFor(0)[0];
      expect(options.frame.x).toBe(32);
      expect(options.frame.y).toBe(48);
      expect(result.width).toBe(64);
      expect(result.height).toBe(32);
    });

    it("hides everything else on the layer while rendering, then restores it", async function () {
      const member = addMember(layer, 0, 0, 32, 32);
      const other = addMember(layer, 500, 500, 32, 32);
      const hiddenOther = addMember(layer, 600, 600, 32, 32);
      hiddenOther.visible = false;
      const circle = member.connections[0].circle;
      let duringRender;
      extractSpy.and.callFake((options) => {
        duringRender = {
          member: member.visible,
          other: other.visible,
          overlay: layer.overlay.visible,
          circle: circle.visible,
        };
        const canvas = document.createElement('canvas');
        canvas.width = options.frame.width;
        canvas.height = options.frame.height;
        return canvas;
      });

      const result = await controller._renderComponentsToTexture([member]);

      expect(duringRender).toEqual({ member: true, other: false, overlay: false, circle: false });
      // The open connection marker sticks out past the component; it is left out.
      expect(result.width).toBe(32);
      expect(result.height).toBe(32);
      expect(other.visible).toBeTrue();
      expect(hiddenOther.visible).toBeFalse();
      expect(layer.overlay.visible).toBeTrue();
      expect(circle.visible).toBeTrue();
    });

    it("renders at full opacity, then restores the layer's opacity", async function () {
      const member = addMember(layer, 0, 0, 32, 32);
      layer.alpha = 0.4;
      let alphaDuringRender;
      extractSpy.and.callFake((options) => {
        alphaDuringRender = layer.alpha;
        const canvas = document.createElement('canvas');
        canvas.width = options.frame.width;
        canvas.height = options.frame.height;
        return canvas;
      });

      await controller._renderComponentsToTexture([member]);

      expect(alphaDuringRender).toBe(1);
      expect(layer.alpha).toBeCloseTo(0.4);
    });

    it("restores the layer when rendering fails", async function () {
      spyOn(console, 'error');
      const member = addMember(layer, 0, 0, 32, 32);
      const other = addMember(layer, 500, 500, 32, 32);
      layer.alpha = 0.5;
      extractSpy.and.throwError('context lost');

      const result = await controller._renderComponentsToTexture([member]);

      expect(result).toBeNull();
      expect(other.visible).toBeTrue();
      expect(layer.overlay.visible).toBeTrue();
      expect(member.connections[0].circle.visible).toBeTrue();
      expect(layer.alpha).toBe(0.5);
    });

    it("scales down to fit the maximum texture size, keeping the size in world units",
      async function () {
        controller.app.renderer.gl.MAX_TEXTURE_SIZE = 1024;
        const member = addMember(layer, 0, 0, 2048, 512);

        const result = await controller._renderComponentsToTexture([member]);

        expect(extractSpy.calls.argsFor(0)[0].resolution).toBe(0.5);
        expect(result.width).toBe(2048);
        expect(result.height).toBe(512);
        expect(result.texture.width).toBe(1024);
        expect(result.texture.height).toBe(256);
      });

    it("returns null for components that are no longer on a layer", async function () {
      const member = addMember(layer, 0, 0, 32, 32);
      layer.removeChild(member);

      expect(await controller._renderComponentsToTexture([member])).toBeNull();
      expect(extractSpy).not.toHaveBeenCalled();
    });
  });

  describe("_renderComponentsToTexture with a real renderer", function () {
    let app;
    let addedRBush = false;

    beforeAll(async function () {
      if (!window.RBush) {
        addedRBush = true;
        window.RBush = class RBush {};
      }
      app = new Application();
      await app.init({ preference: 'webgl', width: 64, height: 64 });
    });

    afterAll(function () {
      app.destroy();
      if (addedRBush) {
        delete window.RBush;
      }
    });

    /**
     * The RGBA value of one pixel of a texture, read back the way saving a MOC
     * reads its texture.
     * @param {Texture} texture
     * @param {Number} x
     * @param {Number} y
     * @returns {Array<Number>}
     */
    function pixelAt(texture, x, y) {
      const { pixels, width } = app.renderer.extract.pixels(texture);
      const i = (y * width + x) * 4;
      return Array.from(pixels.slice(i, i + 4));
    }

    it("draws only the components, opaque, without connection markers", async function () {
      controller.app = app;
      const workspace = new Container();
      workspace.scale.set(0.5);
      const realLayer = new LayoutLayer();
      realLayer.alpha = 0.5;
      workspace.addChild(realLayer);
      app.stage.addChild(workspace);

      const member = new Container();
      member.position.set(16, 16);
      member.addChild(new Graphics().rect(0, 0, 32, 16).fill(0xff0000));
      // Open connection markers are drawn through the layer's overlay.
      const circle = new Graphics().circle(0, 0, 10).fill(0xffff00);
      circle.priority = true;
      circle.position.set(32, 8);
      member.addChild(circle);
      member.connections = [{ circle }];
      realLayer.addChild(member);
      // Overlaps the right half of the member.
      const other = new Container();
      other.addChild(new Graphics().rect(32, 16, 64, 16).fill(0x0000ff));
      realLayer.addChild(other);

      const result = await controller._renderComponentsToTexture([member]);

      expect(result.width).toBe(32);
      expect(result.height).toBe(16);
      expect(result.texture.width).toBe(32);
      expect(result.texture.height).toBe(16);
      expect(pixelAt(result.texture, 4, 8)).toEqual([255, 0, 0, 255]);
      // Where the other component and the connection marker overlap the member.
      expect(pixelAt(result.texture, 28, 8)).toEqual([255, 0, 0, 255]);
      expect(pixelAt(result.texture, 20, 4)).toEqual([255, 0, 0, 255]);

      result.texture.destroy(true);
      app.stage.removeChild(workspace);
    });
  });
});
