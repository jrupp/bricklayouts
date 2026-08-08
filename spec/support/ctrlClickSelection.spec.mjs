import { LayoutController } from "../../src/controller/layoutController.js";
import { Component } from "../../src/model/component.js";
import { ComponentGroup } from "../../src/model/componentGroup.js";
import { LayoutLayer } from "../../src/model/layoutLayer.js";
import { Container } from '../../src/pixi.mjs';

describe("Ctrl+Click Selection", function() {
  let layoutController;
  let currentLayer;

  beforeAll(function() {
    window.RBush = class RBush {
      constructor() {
      }
    };
    spyOn(window, 'RBush').and.returnValue(jasmine.createSpyObj("RBush", ["insert", "remove", "clear", "search"]));
  });

  beforeEach(function() {
    currentLayer = new LayoutLayer();

    layoutController = {
      hideFileMenu: jasmine.createSpy('hideFileMenu'),
      _showSelectionToolbar: jasmine.createSpy('_showSelectionToolbar'),
      _hideSelectionToolbar: jasmine.createSpy('_hideSelectionToolbar'),
      _positionSelectionToolbar: jasmine.createSpy('_positionSelectionToolbar'),
      deleteComponent: jasmine.createSpy('deleteComponent'),
      currentLayer: currentLayer
    };

    spyOn(LayoutController, 'getInstance').and.returnValue(layoutController);
    LayoutController.selectedComponent = null;
  });

  afterEach(function() {
    LayoutController.selectedComponent = null;
  });

  /**
   * Creates a minimal Component stand-in that can be added to a layer and a ComponentGroup.
   */
  function createMockComponent() {
    const mockComponent = new Container();
    Object.setPrototypeOf(mockComponent, Component.prototype);
    mockComponent.connections = new Map();
    mockComponent.sprite = { rotation: 0 };
    mockComponent.layer = currentLayer;
    mockComponent.isDragging = false;
    mockComponent.group = null;
    const uuid = crypto.randomUUID();
    Object.defineProperty(mockComponent, 'uuid', {
      get: function() { return uuid; },
      enumerable: false,
      configurable: true
    });
    currentLayer.addChild(mockComponent);
    return mockComponent;
  }

  function ctrlClick(component, overrides = {}) {
    Component.onClick.call(component, { button: 0, ctrlKey: true, metaKey: false, ...overrides });
  }

  function plainClick(component) {
    Component.onClick.call(component, { button: 0, ctrlKey: false, metaKey: false });
  }

  describe("with nothing currently selected", function() {
    it("should select the clicked component", function() {
      const compA = createMockComponent();

      ctrlClick(compA);

      expect(LayoutController.selectedComponent).toBe(compA);
      expect(compA.tint).toBe(0xffff00);
    });

    it("should select the permanent group of the clicked component", function() {
      const compA = createMockComponent();
      const permGroup = new ComponentGroup(false);
      permGroup.addComponent(compA);

      ctrlClick(compA);

      expect(LayoutController.selectedComponent).toBe(permGroup);
      expect(compA.group).toBe(permGroup);
    });

    it("should select the outermost permanent group when groups are nested", function() {
      const compA = createMockComponent();
      const innerGroup = new ComponentGroup(false);
      innerGroup.addComponent(compA);
      const outerGroup = new ComponentGroup(false);
      outerGroup.addComponent(innerGroup);

      ctrlClick(compA);

      expect(LayoutController.selectedComponent).toBe(outerGroup);
    });
  });

  describe("with a single component selected", function() {
    it("should deselect when the same component is clicked", function() {
      const compA = createMockComponent();
      LayoutController.selectComponent(compA);

      ctrlClick(compA);

      expect(LayoutController.selectedComponent).toBeNull();
      expect(compA.tint).toBe(0xffffff);
      expect(layoutController._hideSelectionToolbar).toHaveBeenCalled();
    });

    it("should create a temporary group containing both components", function() {
      const compA = createMockComponent();
      const compB = createMockComponent();
      LayoutController.selectComponent(compA);

      ctrlClick(compB);

      const selected = LayoutController.selectedComponent;
      expect(selected).toBeInstanceOf(ComponentGroup);
      expect(selected.isTemporary).toBe(true);
      expect(selected.components).toEqual([compA, compB]);
      expect(compA.group).toBe(selected);
      expect(compB.group).toBe(selected);
      expect(compA.tint).toBe(0xffff00);
      expect(compB.tint).toBe(0xffff00);
    });

    it("should add the whole permanent group when the clicked component belongs to one", function() {
      const compA = createMockComponent();
      const compB = createMockComponent();
      const compC = createMockComponent();
      const permGroup = new ComponentGroup(false);
      permGroup.addComponent(compB);
      permGroup.addComponent(compC);
      LayoutController.selectComponent(compA);

      ctrlClick(compB);

      const selected = LayoutController.selectedComponent;
      expect(selected.isTemporary).toBe(true);
      expect(selected.components).toEqual([compA, permGroup]);
      expect(permGroup.group).toBe(selected);
      expect(compB.group).toBe(permGroup);
      expect(compC.group).toBe(permGroup);
    });
  });

  describe("with a temporary group selected", function() {
    let compA;
    let compB;
    let tempGroup;

    beforeEach(function() {
      compA = createMockComponent();
      compB = createMockComponent();
      tempGroup = new ComponentGroup(true);
      tempGroup.addComponent(compA);
      tempGroup.addComponent(compB);
      LayoutController.selectComponent(tempGroup);
    });

    it("should add a clicked component that is not in the group", function() {
      const compC = createMockComponent();

      ctrlClick(compC);

      expect(LayoutController.selectedComponent).toBe(tempGroup);
      expect(tempGroup.components).toEqual([compA, compB, compC]);
      expect(compC.group).toBe(tempGroup);
      expect(compC.tint).toBe(0xffff00);
    });

    it("should add the whole permanent group of a clicked component not in the group", function() {
      const compC = createMockComponent();
      const compD = createMockComponent();
      const permGroup = new ComponentGroup(false);
      permGroup.addComponent(compC);
      permGroup.addComponent(compD);

      ctrlClick(compC);

      expect(LayoutController.selectedComponent).toBe(tempGroup);
      expect(tempGroup.components).toEqual([compA, compB, permGroup]);
      expect(permGroup.group).toBe(tempGroup);
      expect(compC.group).toBe(permGroup);
    });

    it("should remove a clicked component that is a direct member", function() {
      const compC = createMockComponent();
      tempGroup.addComponent(compC);

      ctrlClick(compA);

      expect(LayoutController.selectedComponent).toBe(tempGroup);
      expect(tempGroup.components).toEqual([compB, compC]);
      expect(compA.group).toBeNull();
      expect(compA.tint).toBe(0xffffff);
      expect(compB.tint).toBe(0xffff00);
    });

    it("should collapse to the last member when only one would be left", function() {
      ctrlClick(compA);

      expect(tempGroup.destroyed).toBe(true);
      expect(LayoutController.selectedComponent).toBe(compB);
      expect(compA.group).toBeNull();
      expect(compB.group).toBeNull();
      expect(compA.tint).toBe(0xffffff);
      expect(compB.tint).toBe(0xffff00);
    });

    it("should collapse to the last member when that member is a permanent group", function() {
      const compC = createMockComponent();
      const compD = createMockComponent();
      const permGroup = new ComponentGroup(false);
      permGroup.addComponent(compC);
      permGroup.addComponent(compD);
      tempGroup.addComponent(permGroup);
      tempGroup.removeComponent(compB);

      ctrlClick(compA);

      expect(tempGroup.destroyed).toBe(true);
      expect(LayoutController.selectedComponent).toBe(permGroup);
      expect(permGroup.group).toBeNull();
      expect(permGroup.components).toEqual([compC, compD]);
      expect(compC.tint).toBe(0xffff00);
    });

    it("should select nothing after collapsing and then clicking the last member", function() {
      ctrlClick(compA);
      ctrlClick(compB);

      expect(LayoutController.selectedComponent).toBeNull();
      expect(compA.group).toBeNull();
      expect(compB.group).toBeNull();
      expect(compA.tint).toBe(0xffffff);
      expect(compB.tint).toBe(0xffffff);
    });

    it("should remove the whole permanent group when a member of it is clicked", function() {
      const compC = createMockComponent();
      const compD = createMockComponent();
      const compE = createMockComponent();
      const permGroup = new ComponentGroup(false);
      permGroup.addComponent(compC);
      permGroup.addComponent(compD);
      tempGroup.addComponent(permGroup);
      tempGroup.addComponent(compE);

      ctrlClick(compC);

      expect(LayoutController.selectedComponent).toBe(tempGroup);
      expect(tempGroup.components).toEqual([compA, compB, compE]);
      expect(permGroup.group).toBeNull();
      expect(permGroup.destroyed).toBe(false);
      expect(compC.tint).toBe(0xffffff);
      expect(compD.tint).toBe(0xffffff);
    });

    it("should never remove a component from its permanent group", function() {
      const compC = createMockComponent();
      const compD = createMockComponent();
      const compE = createMockComponent();
      const permGroup = new ComponentGroup(false);
      permGroup.addComponent(compC);
      permGroup.addComponent(compD);
      tempGroup.addComponent(permGroup);
      tempGroup.addComponent(compE);

      ctrlClick(compC);

      expect(compC.group).toBe(permGroup);
      expect(compD.group).toBe(permGroup);
      expect(permGroup.components).toEqual([compC, compD]);
      expect(layoutController.deleteComponent).not.toHaveBeenCalled();
    });

    it("should remove the outermost permanent group when nested groups are members", function() {
      const compC = createMockComponent();
      const compD = createMockComponent();
      const innerGroup = new ComponentGroup(false);
      innerGroup.addComponent(compC);
      const outerGroup = new ComponentGroup(false);
      outerGroup.addComponent(innerGroup);
      tempGroup.addComponent(outerGroup);
      tempGroup.addComponent(compD);

      ctrlClick(compC);

      expect(tempGroup.components).toEqual([compA, compB, compD]);
      expect(outerGroup.group).toBeNull();
      expect(innerGroup.group).toBe(outerGroup);
      expect(compC.group).toBe(innerGroup);
    });
  });

  describe("with a permanent group selected", function() {
    let compA;
    let compB;
    let permGroup;

    beforeEach(function() {
      compA = createMockComponent();
      compB = createMockComponent();
      permGroup = new ComponentGroup(false);
      permGroup.addComponent(compA);
      permGroup.addComponent(compB);
      LayoutController.selectComponent(permGroup);
    });

    it("should deselect the whole group when one of its members is clicked", function() {
      ctrlClick(compA);

      expect(LayoutController.selectedComponent).toBeNull();
      expect(permGroup.destroyed).toBe(false);
      expect(compA.group).toBe(permGroup);
      expect(compA.tint).toBe(0xffffff);
      expect(compB.tint).toBe(0xffffff);
      expect(layoutController.deleteComponent).not.toHaveBeenCalled();
    });

    it("should create a temporary group when a component outside the group is clicked", function() {
      const compC = createMockComponent();

      ctrlClick(compC);

      const selected = LayoutController.selectedComponent;
      expect(selected).toBeInstanceOf(ComponentGroup);
      expect(selected.isTemporary).toBe(true);
      expect(selected.components).toEqual([permGroup, compC]);
      expect(permGroup.group).toBe(selected);
      expect(compC.group).toBe(selected);
      expect(compA.tint).toBe(0xffff00);
      expect(compC.tint).toBe(0xffff00);
    });

    it("should combine two permanent groups into a temporary group", function() {
      const compC = createMockComponent();
      const otherGroup = new ComponentGroup(false);
      otherGroup.addComponent(compC);

      ctrlClick(compC);

      const selected = LayoutController.selectedComponent;
      expect(selected.isTemporary).toBe(true);
      expect(selected.components).toEqual([permGroup, otherGroup]);
      expect(compC.group).toBe(otherGroup);
    });
  });

  describe("modifier and guard handling", function() {
    it("should treat the meta key the same as the control key", function() {
      const compA = createMockComponent();
      const compB = createMockComponent();
      LayoutController.selectComponent(compA);

      Component.onClick.call(compB, { button: 0, ctrlKey: false, metaKey: true });

      const selected = LayoutController.selectedComponent;
      expect(selected).toBeInstanceOf(ComponentGroup);
      expect(selected.components).toEqual([compA, compB]);
    });

    it("should ignore clicks from buttons other than the primary one", function() {
      const compA = createMockComponent();
      const compB = createMockComponent();
      LayoutController.selectComponent(compA);

      Component.onClick.call(compB, { button: 2, ctrlKey: true, metaKey: false });

      expect(LayoutController.selectedComponent).toBe(compA);
    });

    it("should not toggle when the component was being dragged", function() {
      const compA = createMockComponent();
      const compB = createMockComponent();
      LayoutController.selectComponent(compA);
      compB.isDragging = true;

      ctrlClick(compB);

      expect(LayoutController.selectedComponent).toBe(compA);
      expect(compB.isDragging).toBe(false);
    });

    it("should replace the selection when clicking without a modifier key", function() {
      const compA = createMockComponent();
      const compB = createMockComponent();
      LayoutController.selectComponent(compA);

      plainClick(compB);

      expect(LayoutController.selectedComponent).toBe(compB);
      expect(compA.tint).toBe(0xffffff);
      expect(compB.tint).toBe(0xffff00);
    });

    it("should destroy a selected temporary group when clicking without a modifier key", function() {
      const compA = createMockComponent();
      const compB = createMockComponent();
      const compC = createMockComponent();
      const tempGroup = new ComponentGroup(true);
      tempGroup.addComponent(compA);
      tempGroup.addComponent(compB);
      LayoutController.selectComponent(tempGroup);

      plainClick(compC);

      expect(tempGroup.destroyed).toBe(true);
      expect(LayoutController.selectedComponent).toBe(compC);
    });
  });
});
