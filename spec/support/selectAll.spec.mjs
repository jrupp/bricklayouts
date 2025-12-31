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
      _positionSelectionToolbar: jasmine.createSpy('_positionSelectionToolbar'),
      currentLayer: currentLayer,
      layers: [currentLayer, otherLayer],
      processSelectionBoxResults: LayoutController.prototype.processSelectionBoxResults,
      selectAll: LayoutController.prototype.selectAll
    };
    
    // Mock the static LayoutController.selectComponent
    spyOn(LayoutController, 'selectComponent');
  });
  
  // Helper function to create a mock component that can be added to a layer
  function createMockComponent() {
    const mockComponent = new Container();
    Object.setPrototypeOf(mockComponent, Component.prototype);
    mockComponent.connections = new Map();
    return mockComponent;
  }
  
  // Helper function to create a mock component group that can be added to a layer
  function createMockComponentGroup(isTemporary) {
    const mockGroup = new ComponentGroup(isTemporary);
    // Override addToLayer to add the group itself to the layer's children
    // (normally it would add its components, but we want to test the group as a unit)
    mockGroup.addToLayer = function(layer) {
      this.parent = layer;
      // Manually add to layer children since we're not using the real implementation
      layer.children.splice(layer.children.length - 1, 0, this);
    };
    return mockGroup;
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
      const mockComponent = createMockComponent();
      const mockPermanentGroup = createMockComponentGroup(false);
      
      currentLayer.addChild(mockPermanentGroup);
      currentLayer.addChild(mockComponent);
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg).toBeDefined();
      expect(selectedArg.components).toBeDefined();
      expect(selectedArg.components.length).toBe(2);
      expect(selectedArg.components).toContain(mockPermanentGroup);
      expect(selectedArg.components).toContain(mockComponent);
    });

    it("should not include temporary groups", function() {
      const mockComponent = createMockComponent();
      const mockTempGroup = createMockComponentGroup(true);
      
      currentLayer.addChild(mockTempGroup);
      currentLayer.addChild(mockComponent);
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      // Should only select the component, not the temporary group
      expect(selectedArg).toBe(mockComponent);
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
  });
});
