import { LayoutController } from "../../src/controller/layoutController.js";
import { Component } from "../../src/model/component.js";
import { ComponentGroup } from "../../src/model/componentGroup.js";
import { LayoutLayer } from "../../src/model/layoutLayer.js";
import { Application } from '../../src/pixi.mjs';

describe("Select All", function() {
  let layoutController;
  
  beforeEach(function() {
    // Create a mock layout controller with minimal setup
    layoutController = {
      hideFileMenu: jasmine.createSpy('hideFileMenu'),
      _showSelectionToolbar: jasmine.createSpy('_showSelectionToolbar'),
      _positionSelectionToolbar: jasmine.createSpy('_positionSelectionToolbar'),
      currentLayer: {
        children: []
      },
      processSelectionBoxResults: function(components) {
        // Simplified logic from the actual implementation
        if (!components || components.length === 0) {
          return null;
        }
        
        if (components.length === 1) {
          const component = components[0];
          return component.group && !component.group.isTemporary ? component.group : component;
        }
        
        // Create temporary group for multiple components
        const tempGroup = {
          isTemporary: true,
          components: components
        };
        return tempGroup;
      },
      selectAll: LayoutController.prototype.selectAll
    };
    
    // Mock the static LayoutController.selectComponent
    spyOn(LayoutController, 'selectComponent');
  });

  describe("selectAll method", function() {
    it("should do nothing when there are 0 components on the current layer", function() {
      layoutController.currentLayer.children = [];
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).not.toHaveBeenCalled();
    });

    it("should select a single component when there is 1 component on the current layer", function() {
      const mockComponent = { 
        constructor: { name: 'Component' }
      };
      Object.setPrototypeOf(mockComponent, Component.prototype);
      layoutController.currentLayer.children = [mockComponent];
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg).toBe(mockComponent);
    });

    it("should create a temporary group when there are multiple components", function() {
      const mockComponent1 = { constructor: { name: 'Component' } };
      const mockComponent2 = { constructor: { name: 'Component' } };
      const mockComponent3 = { constructor: { name: 'Component' } };
      Object.setPrototypeOf(mockComponent1, Component.prototype);
      Object.setPrototypeOf(mockComponent2, Component.prototype);
      Object.setPrototypeOf(mockComponent3, Component.prototype);
      
      layoutController.currentLayer.children = [mockComponent1, mockComponent2, mockComponent3];
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.isTemporary).toBe(true);
      expect(selectedArg.components.length).toBe(3);
    });

    it("should only select components from the current layer (not overlay)", function() {
      const mockComponent1 = { constructor: { name: 'Component' } };
      const mockComponent2 = { constructor: { name: 'Component' } };
      const mockOverlay = { constructor: { name: 'RenderLayer' } };
      Object.setPrototypeOf(mockComponent1, Component.prototype);
      Object.setPrototypeOf(mockComponent2, Component.prototype);
      
      layoutController.currentLayer.children = [mockComponent1, mockComponent2, mockOverlay];
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.components.length).toBe(2);
    });

    it("should include permanent groups as whole units", function() {
      const mockComponent = { constructor: { name: 'Component' } };
      const mockPermanentGroup = { 
        constructor: { name: 'ComponentGroup' },
        isTemporary: false
      };
      Object.setPrototypeOf(mockComponent, Component.prototype);
      Object.setPrototypeOf(mockPermanentGroup, ComponentGroup.prototype);
      
      layoutController.currentLayer.children = [mockPermanentGroup, mockComponent];
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedArg.components.length).toBe(2);
      expect(selectedArg.components).toContain(mockPermanentGroup);
      expect(selectedArg.components).toContain(mockComponent);
    });

    it("should not include temporary groups", function() {
      const mockComponent = { constructor: { name: 'Component' } };
      const mockTempGroup = { 
        constructor: { name: 'ComponentGroup' },
        isTemporary: true
      };
      Object.setPrototypeOf(mockComponent, Component.prototype);
      Object.setPrototypeOf(mockTempGroup, ComponentGroup.prototype);
      
      layoutController.currentLayer.children = [mockTempGroup, mockComponent];
      
      layoutController.selectAll();
      
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedArg = LayoutController.selectComponent.calls.mostRecent().args[0];
      // Should only select the component, not the temporary group
      expect(selectedArg).toBe(mockComponent);
    });
  });
});
