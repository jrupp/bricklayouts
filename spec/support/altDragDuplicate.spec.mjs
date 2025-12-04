import { Component } from '../../src/model/component.js';
import { ComponentGroup } from '../../src/model/componentGroup.js';
import { LayoutController } from '../../src/controller/layoutController.js';
import { Pose } from '../../src/model/pose.js';

describe('Alt-Drag to Duplicate Feature', () => {
  let mockLayer;
  let mockTrackData;
  let originalDragTarget;
  let originalDragWithAlt;

  beforeEach(() => {
    // Store original state
    originalDragTarget = LayoutController.dragTarget;
    originalDragWithAlt = LayoutController.dragWithAlt;
    
    // Reset LayoutController state
    LayoutController.dragTarget = null;
    LayoutController.dragDistance = 0;
    LayoutController.dragWithAlt = false;
    LayoutController.selectedComponent = null;
    
    // Create mock layer with collision tree
    mockLayer = {
      tree: {
        insert: jasmine.createSpy('insert'),
        remove: jasmine.createSpy('remove'),
        search: jasmine.createSpy('search').and.returnValue([])
      },
      addChild: jasmine.createSpy('addChild'),
      toLocal: jasmine.createSpy('toLocal').and.returnValue({ x: 0, y: 0 })
    };

    // Create mock track data
    mockTrackData = {
      alias: 'test-track',
      name: 'Test Track',
      category: 'test',
      src: 'test.png',
      image: new Image(),
      scale: 1,
      connections: []
    };

    // Mock window.app.stage
    window.app = {
      stage: {
        on: jasmine.createSpy('on'),
        off: jasmine.createSpy('off')
      }
    };
  });

  afterEach(() => {
    // Restore original state
    LayoutController.dragTarget = originalDragTarget;
    LayoutController.dragWithAlt = originalDragWithAlt;
  });

  describe('Component.onStartDrag', () => {
    describe('when Alt key is NOT pressed', () => {
      it('should set dragWithAlt to false', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: false,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        component.onStartDrag(mockEvent);

        expect(LayoutController.dragWithAlt).toBe(false);
      });

      it('should set the original component as dragTarget', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const originalUuid = component.uuid;
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: false,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        component.onStartDrag(mockEvent);

        expect(LayoutController.dragTarget).toBe(component);
        expect(LayoutController.dragTarget.uuid).toBe(originalUuid);
      });
    });

    describe('when Alt key IS pressed', () => {
      it('should set dragWithAlt to true', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        component.onStartDrag(mockEvent);

        expect(LayoutController.dragWithAlt).toBe(true);
      });

      it('should set the original component as dragTarget initially', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const originalUuid = component.uuid;
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        component.onStartDrag(mockEvent);

        // Initially, dragTarget should be the original component
        // Duplication happens later in onDragMove after threshold
        expect(LayoutController.dragTarget).toBe(component);
        expect(LayoutController.dragTarget.uuid).toBe(originalUuid);
      });

      it('should NOT create duplicate immediately (happens after threshold in onDragMove)', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        component.onStartDrag(mockEvent);

        // Should NOT have added a new component to the layer yet
        expect(mockLayer.addChild).not.toHaveBeenCalled();
      });
    });
  });

  describe('ComponentGroup.onStartDrag', () => {
    describe('when Alt key IS pressed', () => {
      it('should set dragWithAlt to true', () => {
        const group = new ComponentGroup();
        const component1 = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        group.addComponent(component1);
        group.parent = mockLayer;
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 150, y: 150 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        group.onStartDrag(mockEvent);

        expect(LayoutController.dragWithAlt).toBe(true);
      });

      it('should NOT create duplicate immediately', () => {
        const group = new ComponentGroup();
        const component1 = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        group.addComponent(component1);
        group.parent = mockLayer;
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 150, y: 150 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        group.onStartDrag(mockEvent);

        // Should NOT have added a new component to the layer yet
        expect(mockLayer.addChild).not.toHaveBeenCalled();
      });
    });
  });

  describe('LayoutController.onDragMove - duplication after threshold', () => {
    describe('when dragWithAlt is true and threshold is passed', () => {
      it('should create a clone and switch dragTarget to the clone', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const originalUuid = component.uuid;
        
        // Set up initial drag state
        LayoutController.dragTarget = component;
        LayoutController.dragDistance = 0;
        LayoutController.dragWithAlt = true;
        component.isDragging = false;
        component.dragStartPos = new Pose(0, 0, 0);
        component.dragStartOffset = new Pose(0, 0, 0);
        component.dragStartConnection = null;
        
        spyOn(component, 'clone').and.callThrough();
        spyOn(component, 'getUsedConnections').and.returnValue([]);
        spyOn(component, 'closeConnections');
        
        // Create mock event that moves past threshold
        const mockEvent = {
          movementX: 10,
          movementY: 0,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 110, y: 100 })
        };

        LayoutController.onDragMove(mockEvent);

        // Should have cloned the component
        expect(component.clone).toHaveBeenCalledWith(mockLayer);
        
        // DragTarget should now be the clone
        expect(LayoutController.dragTarget).not.toBe(component);
        expect(LayoutController.dragTarget.uuid).not.toBe(originalUuid);
        
        // Clone should be added to layer
        expect(mockLayer.addChild).toHaveBeenCalled();
      });

      it('should finalize the original component', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        
        // Set up initial drag state
        LayoutController.dragTarget = component;
        LayoutController.dragDistance = 0;
        LayoutController.dragWithAlt = true;
        component.isDragging = false;
        component.alpha = 0.5;
        component.dragStartPos = new Pose(0, 0, 0);
        component.dragStartOffset = new Pose(0, 0, 0);
        component.dragStartConnection = null;
        
        spyOn(component, 'getUsedConnections').and.returnValue([]);
        spyOn(component, 'insertCollisionTree');
        
        const mockEvent = {
          movementX: 10,
          movementY: 0,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 110, y: 100 })
        };

        LayoutController.onDragMove(mockEvent);

        // Original should be restored to normal state
        expect(component.alpha).toBe(1);
        expect(component.isDragging).toBe(false);
        expect(component.dragStartConnection).toBe(null);
        expect(component.insertCollisionTree).toHaveBeenCalled();
      });

      it('should reset dragWithAlt flag after duplication', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        
        LayoutController.dragTarget = component;
        LayoutController.dragDistance = 0;
        LayoutController.dragWithAlt = true;
        component.isDragging = false;
        component.dragStartPos = new Pose(0, 0, 0);
        component.dragStartOffset = new Pose(0, 0, 0);
        
        spyOn(component, 'getUsedConnections').and.returnValue([]);
        
        const mockEvent = {
          movementX: 10,
          movementY: 0,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 110, y: 100 })
        };

        LayoutController.onDragMove(mockEvent);

        expect(LayoutController.dragWithAlt).toBe(false);
      });

      it('should deselect original if it was selected', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        
        LayoutController.dragTarget = component;
        LayoutController.dragDistance = 0;
        LayoutController.dragWithAlt = true;
        LayoutController.selectedComponent = component;
        component.isDragging = false;
        component.dragStartPos = new Pose(0, 0, 0);
        component.dragStartOffset = new Pose(0, 0, 0);
        
        spyOn(component, 'getUsedConnections').and.returnValue([]);
        spyOn(LayoutController, 'selectComponent');
        
        const mockEvent = {
          movementX: 10,
          movementY: 0,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 110, y: 100 })
        };

        LayoutController.onDragMove(mockEvent);

        expect(LayoutController.selectComponent).toHaveBeenCalledWith(null);
      });
    });

    describe('when dragWithAlt is true but threshold NOT passed', () => {
      it('should NOT create duplicate yet', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const originalUuid = component.uuid;
        
        LayoutController.dragTarget = component;
        LayoutController.dragDistance = 0;
        LayoutController.dragWithAlt = true;
        component.isDragging = false;
        component.dragStartPos = new Pose(0, 0, 0);
        component.dragStartOffset = new Pose(0, 0, 0);
        
        spyOn(component, 'getUsedConnections').and.returnValue([]);
        
        // Small movement, below threshold
        const mockEvent = {
          movementX: 1,
          movementY: 0,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 101, y: 100 })
        };

        LayoutController.onDragMove(mockEvent);

        // Should still be dragging original
        expect(LayoutController.dragTarget).toBe(component);
        expect(LayoutController.dragTarget.uuid).toBe(originalUuid);
        expect(mockLayer.addChild).not.toHaveBeenCalled();
      });
    });

    describe('when dragWithAlt is false', () => {
      it('should NOT create duplicate even after threshold', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const originalUuid = component.uuid;
        
        LayoutController.dragTarget = component;
        LayoutController.dragDistance = 0;
        LayoutController.dragWithAlt = false;
        component.isDragging = false;
        component.dragStartPos = new Pose(0, 0, 0);
        component.dragStartOffset = new Pose(0, 0, 0);
        
        spyOn(component, 'getUsedConnections').and.returnValue([]);
        spyOn(component, 'closeConnections');
        
        const mockEvent = {
          movementX: 10,
          movementY: 0,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 110, y: 100 })
        };

        LayoutController.onDragMove(mockEvent);

        // Should still be dragging original
        expect(LayoutController.dragTarget).toBe(component);
        expect(LayoutController.dragTarget.uuid).toBe(originalUuid);
        expect(mockLayer.addChild).not.toHaveBeenCalled();
        expect(component.isDragging).toBe(true);
      });
    });
  });

  describe('LayoutController.finalizeDraggedComponent', () => {
    it('should restore component visual state', () => {
      const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
      component.alpha = 0.5;
      component.isDragging = true;
      component.dragStartConnection = {};
      
      spyOn(component, 'insertCollisionTree');
      spyOn(component, 'getOpenConnections').and.returnValue([]);
      
      LayoutController.finalizeDraggedComponent(component);
      
      expect(component.alpha).toBe(1);
      expect(component.isDragging).toBe(false);
      expect(component.dragStartConnection).toBe(null);
      expect(component.insertCollisionTree).toHaveBeenCalled();
    });
  });
});
