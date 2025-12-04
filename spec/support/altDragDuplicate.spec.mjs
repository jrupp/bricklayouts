import { Component } from '../../src/model/component.js';
import { ComponentGroup } from '../../src/model/componentGroup.js';
import { LayoutController } from '../../src/controller/layoutController.js';
import { Pose } from '../../src/model/pose.js';

describe('Alt-Drag to Duplicate Feature', () => {
  let mockLayer;
  let mockTrackData;
  let originalDragTarget;

  beforeEach(() => {
    // Store original dragTarget
    originalDragTarget = LayoutController.dragTarget;
    
    // Reset LayoutController state
    LayoutController.dragTarget = null;
    LayoutController.dragDistance = 0;
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
    // Restore original dragTarget
    LayoutController.dragTarget = originalDragTarget;
  });

  describe('Component.onStartDrag', () => {
    describe('when Alt key is NOT pressed', () => {
      it('should move the original component (not duplicate)', () => {
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

        // Should set the original component as dragTarget
        expect(LayoutController.dragTarget).toBe(component);
        expect(LayoutController.dragTarget.uuid).toBe(originalUuid);
        
        // Should NOT have added a new component to the layer
        expect(mockLayer.addChild).not.toHaveBeenCalled();
      });

      it('should remove original component from collision tree when not selected', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const deleteCollisionTreeSpy = spyOn(component, 'deleteCollisionTree');
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: false,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        component.onStartDrag(mockEvent);

        // Should delete from collision tree once (initial delete before setting up drag)
        expect(deleteCollisionTreeSpy).toHaveBeenCalled();
      });
    });

    describe('when Alt key IS pressed', () => {
      it('should create a duplicate component and drag the duplicate', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const originalUuid = component.uuid;
        const cloneSpy = spyOn(component, 'clone').and.callThrough();
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        component.onStartDrag(mockEvent);

        // Should have cloned the component
        expect(cloneSpy).toHaveBeenCalledWith(mockLayer);
        
        // DragTarget should be a different component (the clone)
        expect(LayoutController.dragTarget).not.toBe(component);
        expect(LayoutController.dragTarget.uuid).not.toBe(originalUuid);
        
        // Should have added the clone to the layer
        expect(mockLayer.addChild).toHaveBeenCalled();
      });

      it('should insert clone into collision tree', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        component.onStartDrag(mockEvent);

        // The clone should be inserted into collision tree
        // (once after creation, then deleted before drag starts)
        expect(mockLayer.tree.insert).toHaveBeenCalled();
      });

      it('should deselect original component if it was selected', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        LayoutController.selectedComponent = component;
        const selectComponentSpy = spyOn(LayoutController, 'selectComponent');
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        component.onStartDrag(mockEvent);

        // Should deselect the original component
        expect(selectComponentSpy).toHaveBeenCalledWith(null);
      });

      it('should NOT remove original component from collision tree', () => {
        const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const deleteCollisionTreeSpy = spyOn(component, 'deleteCollisionTree');
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        component.onStartDrag(mockEvent);

        // Original component should NOT have deleteCollisionTree called on it
        expect(deleteCollisionTreeSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('ComponentGroup.onStartDrag', () => {
    describe('when Alt key is NOT pressed', () => {
      it('should move the original group (not duplicate)', () => {
        const group = new ComponentGroup();
        const component1 = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const component2 = new Component(mockTrackData, new Pose(200, 200, 0), mockLayer, {});
        
        group.addComponent(component1);
        group.addComponent(component2);
        group.parent = mockLayer;
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: false,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 150, y: 150 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        group.onStartDrag(mockEvent);

        // Should set the original group as dragTarget
        expect(LayoutController.dragTarget).toBe(group);
      });
    });

    describe('when Alt key IS pressed', () => {
      it('should create a duplicate group and drag the duplicate', () => {
        const group = new ComponentGroup();
        const component1 = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const component2 = new Component(mockTrackData, new Pose(200, 200, 0), mockLayer, {});
        
        group.addComponent(component1);
        group.addComponent(component2);
        group.parent = mockLayer;
        
        const cloneSpy = spyOn(group, 'clone').and.callThrough();
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 150, y: 150 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        group.onStartDrag(mockEvent);

        // Should have cloned the group
        expect(cloneSpy).toHaveBeenCalledWith(mockLayer);
        
        // DragTarget should be a different group (the clone)
        expect(LayoutController.dragTarget).not.toBe(group);
      });

      it('should insert cloned group into collision tree', () => {
        const group = new ComponentGroup();
        const component1 = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        const component2 = new Component(mockTrackData, new Pose(200, 200, 0), mockLayer, {});
        
        group.addComponent(component1);
        group.addComponent(component2);
        group.parent = mockLayer;
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 150, y: 150 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        group.onStartDrag(mockEvent);

        // The cloned group's components should be inserted into collision tree
        expect(mockLayer.tree.insert).toHaveBeenCalled();
      });

      it('should deselect original group if it was selected', () => {
        const group = new ComponentGroup();
        const component1 = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        
        group.addComponent(component1);
        group.parent = mockLayer;
        
        LayoutController.selectedComponent = group;
        const selectComponentSpy = spyOn(LayoutController, 'selectComponent');
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 150, y: 150 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        group.onStartDrag(mockEvent);

        // Should deselect the original group
        expect(selectComponentSpy).toHaveBeenCalledWith(null);
      });

      it('should NOT remove original group from collision tree', () => {
        const group = new ComponentGroup();
        const component1 = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
        
        group.addComponent(component1);
        group.parent = mockLayer;
        
        const deleteCollisionTreeSpy = spyOn(group, 'deleteCollisionTree');
        
        const mockEvent = {
          button: 0,
          nativeEvent: { isPrimary: true },
          altKey: true,
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 150, y: 150 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
        };

        group.onStartDrag(mockEvent);

        // Original group's deleteCollisionTree is only called on the target (cloned) group
        // The original should remain in the tree
        expect(deleteCollisionTreeSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Collision tree integrity', () => {
    it('should ensure no duplicate entries after alt-drag of component', () => {
      const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
      const insertCalls = [];
      
      // Track all insert calls
      mockLayer.tree.insert.and.callFake((item) => {
        insertCalls.push(item);
      });
      
      const mockEvent = {
        button: 0,
        nativeEvent: { isPrimary: true },
        altKey: true,
        getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
        stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
      };

      component.onStartDrag(mockEvent);

      // Verify no duplicate IDs in collision tree inserts
      const ids = insertCalls.map(item => item.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should ensure no duplicate entries after alt-drag of component group', () => {
      const group = new ComponentGroup();
      const component1 = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
      const component2 = new Component(mockTrackData, new Pose(200, 200, 0), mockLayer, {});
      
      group.addComponent(component1);
      group.addComponent(component2);
      group.parent = mockLayer;
      
      const insertCalls = [];
      mockLayer.tree.insert.and.callFake((item) => {
        insertCalls.push(item);
      });
      
      const mockEvent = {
        button: 0,
        nativeEvent: { isPrimary: true },
        altKey: true,
        getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 150, y: 150 }),
        stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
      };

      group.onStartDrag(mockEvent);

      // Verify no duplicate IDs in collision tree inserts
      const ids = insertCalls.map(item => item.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have both original and duplicate component in tree after alt-drag', () => {
      const component = new Component(mockTrackData, new Pose(100, 100, 0), mockLayer, {});
      const originalUuid = component.uuid;
      const insertCalls = [];
      
      mockLayer.tree.insert.and.callFake((item) => {
        insertCalls.push(item);
      });
      
      const mockEvent = {
        button: 0,
        nativeEvent: { isPrimary: true },
        altKey: true,
        getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
        stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
      };

      component.onStartDrag(mockEvent);

      // Should have at least one insert (the clone)
      expect(insertCalls.length).toBeGreaterThan(0);
      
      // The clone should have a different UUID than the original
      const clonedComponent = LayoutController.dragTarget;
      expect(clonedComponent.uuid).not.toBe(originalUuid);
    });
  });
});
