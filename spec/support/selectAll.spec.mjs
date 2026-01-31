import { LayoutController } from "../../src/controller/layoutController.js";
import { Component } from "../../src/model/component.js";
import { ComponentGroup } from "../../src/model/componentGroup.js";
import { LayoutLayer } from "../../src/model/layoutLayer.js";
import { Container } from '../../src/pixi.mjs';

describe("Select All", function() {
  let layoutController;
  let currentLayer;
  let otherLayer;
  
  beforeAll(function() {
    window.RBush = class RBush {
      constructor() {
      }
    };
    spyOn(window, 'RBush').and.returnValue(jasmine.createSpyObj("RBush", ["insert", "remove", "clear", "search"]));
  });
  
  beforeEach(function() {
    // Create real LayoutLayer instances
    currentLayer = new LayoutLayer();
    otherLayer = new LayoutLayer();
    
    // Create a mock layout controller with minimal setup
    layoutController = {
      hideFileMenu: jasmine.createSpy('hideFileMenu'),
      _showSelectionToolbar: jasmine.createSpy('_showSelectionToolbar'),
      _hideSelectionToolbar: jasmine.createSpy('_hideSelectionToolbar'),
      _positionSelectionToolbar: jasmine.createSpy('_positionSelectionToolbar'),
      currentLayer: currentLayer,
      layers: [currentLayer, otherLayer],
      processSelectionBoxResults: LayoutController.prototype.processSelectionBoxResults,
      selectAll: LayoutController.prototype.selectAll
    };
    
    // Mock the static LayoutController.selectComponent and selectedComponent
    spyOn(LayoutController, 'selectComponent').and.callThrough();
    LayoutController.selectedComponent = null;
    spyOn(LayoutController, 'getInstance').and.returnValue(layoutController);
  });
  
  afterEach(function() {
    // Clean up static state to prevent test interference
    LayoutController.selectedComponent = null;
  });
  
  // Helper function to create a mock component that can be added to a layer
  function createMockComponent() {
    const mockComponent = new Container();
    Object.setPrototypeOf(mockComponent, Component.prototype);
    mockComponent.connections = new Map();
    return mockComponent;
  }

  describe("selectAll method", function() {
    it("should do nothing when there are 0 components on the current layer", function() {
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).not.toHaveBeenCalled();
    });

    it("should select a single component when there is 1 component on the current layer", function() {
      const mockComponent = createMockComponent();
      currentLayer.addChild(mockComponent);
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg).toBe(mockComponent);
    });

    it("should create a temporary group when there are multiple components", function() {
      const mockComponent1 = createMockComponent();
      const mockComponent2 = createMockComponent();
      const mockComponent3 = createMockComponent();
      
      currentLayer.addChild(mockComponent1);
      currentLayer.addChild(mockComponent2);
      currentLayer.addChild(mockComponent3);
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(3);
    });

    it("should only select components from the current layer (not overlay)", function() {
      const mockComponent1 = createMockComponent();
      const mockComponent2 = createMockComponent();
      
      currentLayer.addChild(mockComponent1);
      currentLayer.addChild(mockComponent2);
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.components.length).toBe(2);
      // Verify overlay is still a child but not selected
      expect(currentLayer.children.length).toBe(3); // 2 components + 1 overlay
    });

    it("should include permanent groups as whole units", function() {
      // Create components and add them to the layer first
      const groupedComponent1 = createMockComponent();
      const groupedComponent2 = createMockComponent();
      const individualComponent = createMockComponent();
      
      currentLayer.addChild(groupedComponent1);
      currentLayer.addChild(groupedComponent2);
      currentLayer.addChild(individualComponent);
      
      // Now create a permanent group and add the components to it
      const mockPermanentGroup = new ComponentGroup(false);
      mockPermanentGroup.addComponent(groupedComponent1);
      mockPermanentGroup.addComponent(groupedComponent2);
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg).toBeDefined();
      expect(selectedArg.components).toBeDefined();
      // Should contain the permanent group and the individual component
      expect(selectedArg.components.length).toBe(2);
      expect(selectedArg.components).toContain(mockPermanentGroup);
      expect(selectedArg.components).toContain(individualComponent);
    });

    it("should only select components from the current layer when multiple layers exist", function() {
      // Create mock components for current layer
      const currentLayerComponent1 = createMockComponent();
      const currentLayerComponent2 = createMockComponent();
      
      // Create mock components for other layer
      const otherLayerComponent1 = createMockComponent();
      const otherLayerComponent2 = createMockComponent();
      
      // Add components to their respective layers
      currentLayer.addChild(currentLayerComponent1);
      currentLayer.addChild(currentLayerComponent2);
      otherLayer.addChild(otherLayerComponent1);
      otherLayer.addChild(otherLayerComponent2);
      
      // Call selectAll
      layoutController.selectAll();
      
      // Verify selection was called
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      
      // Verify only current layer components are in the group
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(2);
      expect(selectedArg.components).toContain(currentLayerComponent1);
      expect(selectedArg.components).toContain(currentLayerComponent2);
      
      // Verify other layer components are NOT in the group
      expect(selectedArg.components).not.toContain(otherLayerComponent1);
      expect(selectedArg.components).not.toContain(otherLayerComponent2);
    });

    it("should select all components even when some are already in a temporary group", function() {
      // Create components
      const comp1 = createMockComponent();
      const comp2 = createMockComponent();
      const comp3 = createMockComponent();
      const comp4 = createMockComponent();
      
      currentLayer.addChild(comp1);
      currentLayer.addChild(comp2);
      currentLayer.addChild(comp3);
      currentLayer.addChild(comp4);
      
      // First, select comp1 and comp2 as a temporary group
      const tempGroup = new ComponentGroup(true);
      tempGroup.addComponent(comp1);
      tempGroup.addComponent(comp2);
      LayoutController.selectComponent(tempGroup);
      
      // Verify the temporary group is selected
      expect(LayoutController.selectedComponent).toBe(tempGroup);
      expect(LayoutController.selectedComponent.components.length).toBe(2);
      
      // Now call selectAll - it should select ALL 4 components
      layoutController.selectAll();
      
      // Verify selectComponent was called three times:
      // 1. Initial selection of tempGroup during setup
      // 2. Deselection (null) to destroy the old temporary group
      // 3. Selection of new temporary group with all 4 components
      expect(LayoutController.selectComponent.calls.count()).toBe(3);
      
      // Verify all 4 components are now in the selected group
      const selectedArg = LayoutController.selectedComponent;
      expect(selectedArg).toBeDefined();
      expect(selectedArg).not.toBe(tempGroup); // Should be a NEW group object
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(4);
      expect(selectedArg.components).toContain(comp1);
      expect(selectedArg.components).toContain(comp2);
      expect(selectedArg.components).toContain(comp3);
      expect(selectedArg.components).toContain(comp4);
      
      // Verify the old temporary group was destroyed and replaced with a new one
      expect(tempGroup.destroyed).toBe(true);
    });
  });
});
