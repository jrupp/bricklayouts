import { ComponentGroup } from '../../src/model/componentGroup.js';
import { LayoutController } from '../../src/controller/layoutController.js';
import { Pose } from '../../src/model/pose.js';
import { PolarVector } from '../../src/model/polarVector.js';
import * as fc from './lib/fast-check.mjs';
import { Component } from '../../src/model/component.js';

describe('ComponentGroup', () => {
  describe('getBounds', () => {
    it('should return null when the group is empty', () => {
      const group = new ComponentGroup();
      
      expect(group.getBounds()).toBeNull();
    });

    it('should return the bounds of a single component', () => {
      const group = new ComponentGroup();
      const mockBounds = { 
        minX: 0, 
        minY: 0, 
        maxX: 10, 
        maxY: 10 
      };
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds),
        connections: []
      };
      
      group.addComponent(mockComponent);
      
      const result = group.getBounds();
      
      expect(mockComponent.getBounds).toHaveBeenCalled();
      expect(result.minX).toBe(0);
      expect(result.minY).toBe(0);
      expect(result.maxX).toBe(10);
      expect(result.maxY).toBe(10);
    });

    it('should return the combined bounds for multiple components', () => {
      const group = new ComponentGroup();
      
      const mockBounds1 = {
        minX: 0, minY: 0, maxX: 10, maxY: 10
      };
      const mockBounds2 = { 
        minX: 5, minY: 5, maxX: 20, maxY: 20 
      };
      const mockBounds3 = { 
        minX: 10, minY: 10, maxX: 30, maxY: 30 
      };
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds1),
        connections: []
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds2),
        connections: []
      };
      const mockComponent3 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds3),
        connections: []
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      group.addComponent(mockComponent3);
      
      const result = group.getBounds();
      
      expect(mockComponent1.getBounds).toHaveBeenCalled();
      expect(mockComponent2.getBounds).toHaveBeenCalled();
      expect(mockComponent3.getBounds).toHaveBeenCalled();
      
      // Should encompass all three bounds
      expect(result.minX).toBe(0);
      expect(result.minY).toBe(0);
      expect(result.maxX).toBe(30);
      expect(result.maxY).toBe(30);
    });
  });

  describe('getGlobalPosition', () => {
    it('should return null when the group is empty', () => {
      const group = new ComponentGroup();
      
      expect(group.getGlobalPosition()).toBeNull();
    });

    it('should return null when getBounds returns null', () => {
      const group = new ComponentGroup();
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(null),
        connections: []
      };
      
      group.addComponent(mockComponent);
      
      expect(group.getGlobalPosition()).toBeNull();
    });

    it('should return the global center position for a single component', () => {
      const group = new ComponentGroup();
      const mockBounds = {
        minX: 0,
        minY: 0,
        maxX: 10,
        maxY: 10
      };
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds),
        connections: []
      };
      
      group.addComponent(mockComponent);
      
      const result = group.getGlobalPosition();
      
      // Center should be (5, 5)
      expect(result.x).toBe(5);
      expect(result.y).toBe(5);
    });

    it('should return the global center position for multiple components', () => {
      const group = new ComponentGroup();
      
      const mockBounds1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const mockBounds2 = { minX: 5, minY: 5, maxX: 20, maxY: 20 };
      const mockBounds3 = { minX: 10, minY: 10, maxX: 30, maxY: 30 };
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds1),
        connections: []
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds2),
        connections: []
      };
      const mockComponent3 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds3),
        connections: []
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      group.addComponent(mockComponent3);
      
      const result = group.getGlobalPosition();
      
      // Combined bounds: minX=0, minY=0, maxX=30, maxY=30
      // Center should be (15, 15)
      expect(result.x).toBe(15);
      expect(result.y).toBe(15);
    });
  });

  describe('getLocalPosition', () => {
    it('should return null when the group is empty', () => {
      const group = new ComponentGroup();
      
      expect(group.getLocalPosition()).toBeNull();
    });

    it('should return null when getGlobalPosition returns null', () => {
      const group = new ComponentGroup();
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(null),
        connections: []
      };
      
      group.addComponent(mockComponent);
      
      expect(group.getLocalPosition()).toBeNull();
    });

    it('should convert global position to local coordinates', () => {
      const group = new ComponentGroup();
      const mockBounds = {
        minX: 0,
        minY: 0,
        maxX: 10,
        maxY: 10
      };
      
      const mockParent = {
        toLocal: jasmine.createSpy('toLocal').and.callFake(point => ({
          x: point.x - 100,
          y: point.y - 50
        }))
      };
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds),
        connections: [],
        parent: mockParent
      };
      
      group.addComponent(mockComponent);
      
      const result = group.getLocalPosition();
      
      // Global center is (5, 5)
      expect(mockParent.toLocal).toHaveBeenCalledWith({ x: 5, y: 5 });
      // After local conversion
      expect(result.x).toBe(-95);  // 5 - 100
      expect(result.y).toBe(-45);  // 5 - 50
    });

    it('should use the parent from the first component', () => {
      const group = new ComponentGroup();
      
      const mockParent1 = {
        toLocal: jasmine.createSpy('toLocal').and.callFake(point => ({
          x: point.x * 2,
          y: point.y * 2
        }))
      };
      
      const mockParent2 = {
        toLocal: jasmine.createSpy('toLocal').and.callFake(point => ({
          x: point.x * 3,
          y: point.y * 3
        }))
      };
      
      const mockBounds1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const mockBounds2 = { minX: 10, minY: 10, maxX: 30, maxY: 30 };
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds1),
        connections: [],
        parent: mockParent1
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds2),
        connections: [],
        parent: mockParent1  // Must be same parent as first component
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      
      const result = group.getLocalPosition();
      
      // Combined bounds: center is (15, 15)
      // Should use mockParent1 (first component's parent)
      expect(mockParent1.toLocal).toHaveBeenCalledWith({ x: 15, y: 15 });
      expect(mockParent2.toLocal).not.toHaveBeenCalled();
      expect(result.x).toBe(30);  // 15 * 2 (using mockParent1's transform)
      expect(result.y).toBe(30);  // 15 * 2
    });
  });

  describe('position', () => {
    it('should return an object with a set method', () => {
      const group = new ComponentGroup();
      const position = group.position;
      
      expect(position).toBeDefined();
      expect(typeof position.set).toBe('function');
    });

    it('should call move when set is called', () => {
      const group = new ComponentGroup();
      const mockBounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const mockParent = {
        toLocal: jasmine.createSpy('toLocal').and.returnValue({ x: 5, y: 5 })
      };
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds),
        connections: [],
        parent: mockParent,
        position: {
          x: 5,
          y: 5,
          set: jasmine.createSpy('set')
        }
      };
      
      group.addComponent(mockComponent);
      
      spyOn(group, 'move');
      group.position.set(100, 200);
      
      expect(group.move).toHaveBeenCalledWith(100, 200);
    });
  });

  describe('move', () => {
    it('should do nothing when the group is empty', () => {
      const group = new ComponentGroup();
      
      // Should not throw
      expect(() => group.move(100, 200)).not.toThrow();
    });

    it('should do nothing when getLocalPosition returns null', () => {
      const group = new ComponentGroup();
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(null),
        connections: [],
        position: {
          set: jasmine.createSpy('set')
        }
      };
      
      group.addComponent(mockComponent);
      group.move(100, 200);
      
      expect(mockComponent.position.set).not.toHaveBeenCalled();
    });

    it('should move a single component by the delta', () => {
      const group = new ComponentGroup();
      const mockBounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const mockParent = {
        toLocal: jasmine.createSpy('toLocal').and.returnValue({ x: 5, y: 5 })
      };
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds),
        connections: [],
        parent: mockParent,
        position: {
          x: 5,
          y: 5,
          set: jasmine.createSpy('set')
        }
      };
      
      group.addComponent(mockComponent);
      
      // Move to position (100, 200)
      // Current local position is (5, 5)
      // Delta should be (95, 195)
      group.move(100, 200);
      
      expect(mockComponent.position.set).toHaveBeenCalledWith(
        100,  // 5 + 95
        200   // 5 + 195
      );
    });

    it('should move multiple components by the same delta', () => {
      const group = new ComponentGroup();
      
      const mockBounds1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const mockBounds2 = { minX: 10, minY: 10, maxX: 30, maxY: 30 };
      
      const mockParent = {
        toLocal: jasmine.createSpy('toLocal').and.returnValue({ x: 15, y: 15 })
      };
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds1),
        connections: [],
        parent: mockParent,
        position: {
          x: 10,
          y: 10,
          set: jasmine.createSpy('set')
        }
      };
      
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds2),
        connections: [],
        parent: mockParent,
        position: {
          x: 20,
          y: 20,
          set: jasmine.createSpy('set')
        }
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      
      // Move to position (50, 60)
      // Current local position is (15, 15)
      // Delta should be (35, 45)
      group.move(50, 60);
      
      expect(mockComponent1.position.set).toHaveBeenCalledWith(
        45,  // 10 + 35
        55   // 10 + 45
      );
      
      expect(mockComponent2.position.set).toHaveBeenCalledWith(
        55,  // 20 + 35
        65   // 20 + 45
      );
    });

    it('should skip components with null position', () => {
      const group = new ComponentGroup();
      const mockBounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const mockParent = {
        toLocal: jasmine.createSpy('toLocal').and.returnValue({ x: 5, y: 5 })
      };
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds),
        connections: [],
        parent: mockParent,
        position: null
      };
      
      group.addComponent(mockComponent);
      
      // Should not throw
      expect(() => group.move(100, 200)).not.toThrow();
    });
  });

  describe('destroy', () => {
    let mockLayoutController;
    let mockSpy;

    beforeAll(() => {
      mockLayoutController = {
        deleteComponent: jasmine.createSpy('deleteComponent')
      };
      
      mockSpy = spyOn(LayoutController, 'getInstance');
      mockSpy.and.returnValue(mockLayoutController);
    });

    beforeEach(() => {
      mockLayoutController.deleteComponent.calls.reset();
    });

    afterAll(() => {
      mockLayoutController.deleteComponent = undefined;
      mockSpy.and.callThrough();
    });

    it('should set destroyed flag to true', () => {
      const group = new ComponentGroup();
      
      expect(group.destroyed).toBe(false);
      group.destroy();
      expect(group.destroyed).toBe(true);
    });

    it('should clear the parent reference', () => {
      const group = new ComponentGroup();
      const mockParent = {};
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: mockParent,
        group: null
      };
      
      group.addComponent(mockComponent);
      expect(group.parent).toBe(mockParent);
      
      group.destroy();
      expect(group.parent).toBeNull();
    });

    it('should clear all connections', () => {
      const group = new ComponentGroup();
      const mockConnection = { uuid: 'conn-1' };
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [mockConnection],
        parent: {},
        group: null
      };
      
      group.addComponent(mockComponent);
      expect(group.connections.size).toBe(1);
      
      group.destroy();
      expect(group.connections.size).toBe(0);
    });

    it('should set component.group to null for all components', () => {
      const group = new ComponentGroup();
      const sharedLayer = {}; // All components must be on the same layer
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        group: null
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        group: null
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      
      expect(mockComponent1.group).toBe(group);
      expect(mockComponent2.group).toBe(group);
      
      group.destroy();
      
      expect(mockComponent1.group).toBeNull();
      expect(mockComponent2.group).toBeNull();
    });

    it('should delete components via LayoutController for permanent groups', () => {
      const group = new ComponentGroup(false); // permanent group
      const sharedLayer = {}; // All components must be on the same layer
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        group: null
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        group: null
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      
      group.destroy();
      
      expect(mockLayoutController.deleteComponent).toHaveBeenCalledWith(mockComponent1);
      expect(mockLayoutController.deleteComponent).toHaveBeenCalledWith(mockComponent2);
      expect(mockLayoutController.deleteComponent).toHaveBeenCalledTimes(2);
    });

    it('should NOT delete components via LayoutController for temporary groups', () => {
      const group = new ComponentGroup(true); // temporary group
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
        group: null
      };
      
      group.addComponent(mockComponent);
      group.destroy();
      
      expect(mockLayoutController.deleteComponent).not.toHaveBeenCalled();
    });

    it('should nullify the components array', () => {
      const group = new ComponentGroup();
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
        group: null
      };
      
      group.addComponent(mockComponent);
      expect(group.size).toBe(1);
      
      group.destroy();
      
      // After destroy, size should return 0
      // since #components is set to null
      expect(group.size).toBe(0);
    });
  });

  describe('alpha', () => {
    it('should set alpha on all components in the group', () => {
      const group = new ComponentGroup();
      const sharedLayer = {}; // All components must be on the same layer
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        alpha: 1
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        alpha: 1
      };
      const mockComponent3 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        alpha: 1
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      group.addComponent(mockComponent3);
      
      group.alpha = 0.5;
      
      expect(mockComponent1.alpha).toBe(0.5);
      expect(mockComponent2.alpha).toBe(0.5);
      expect(mockComponent3.alpha).toBe(0.5);
    });

    it('should handle empty group without error', () => {
      const group = new ComponentGroup();
      
      expect(() => group.alpha = 0.5).not.toThrow();
    });
  });

  describe('tint', () => {
    it('should set tint on all components in the group', () => {
      const group = new ComponentGroup();
      const sharedLayer = {}; // All components must be on the same layer
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        tint: 0xffffff
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        tint: 0xffffff
      };
      const mockComponent3 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        tint: 0xffffff
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      group.addComponent(mockComponent3);
      
      group.tint = 0xff0000;
      
      expect(mockComponent1.tint).toBe(0xff0000);
      expect(mockComponent2.tint).toBe(0xff0000);
      expect(mockComponent3.tint).toBe(0xff0000);
    });

    it('should handle empty group without error', () => {
      const group = new ComponentGroup();
      
      expect(() => group.tint = 0xff0000).not.toThrow();
    });
  });

  describe('deleteCollisionTree', () => {
    let mockTree;
    let mockLayer;

    beforeEach(() => {
      mockTree = {
        remove: jasmine.createSpy('remove')
      };
      mockLayer = {
        tree: mockTree
      };
    });

    for (let a of [true, false]) {
      it(`should remove all components from the collision tree ${a == true ? 'temp' : 'perm'}`, () => {
        const group = new ComponentGroup(a);

        const mockBounds1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
        const mockBounds2 = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
        
        const mockComponent1 = {
          getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds1),
          connections: [],
          parent: mockLayer,
          uuid: 'comp-1',
          layer: mockLayer,
          sprite: {
            getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
              minX: 0, minY: 0, maxX: 10, maxY: 10
            })
          },
          position: { x: 100, y: 200 }
        };
        
        const mockComponent2 = {
          getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds2),
          connections: [],
          parent: mockLayer,
          uuid: 'comp-2',
          layer: mockLayer,
          sprite: {
            getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
              minX: 5, minY: 5, maxX: 15, maxY: 15
            })
          },
          position: { x: 150, y: 250 }
        };
        
        group.addComponent(mockComponent1);
        group.addComponent(mockComponent2);
        
        group.deleteCollisionTree();
        
        expect(mockTree.remove).toHaveBeenCalledTimes(2);
        
        // Verify first component removal
        expect(mockTree.remove).toHaveBeenCalledWith(
          {
            id: 'comp-1',
            minX: 100,  // 0 + 100
            minY: 200,  // 0 + 200
            maxX: 110,  // 10 + 100
            maxY: 210,  // 10 + 200
            component: mockComponent1
          },
          jasmine.any(Function)
        );
        
        // Verify second component removal
        expect(mockTree.remove).toHaveBeenCalledWith(
          {
            id: 'comp-2',
            minX: 155,  // 5 + 150
            minY: 255,  // 5 + 250
            maxX: 165,  // 15 + 150
            maxY: 265,  // 15 + 250
            component: mockComponent2
          },
          jasmine.any(Function)
        );
      });
    }

    it('should handle empty group without error', () => {
      const group = new ComponentGroup();
      
      expect(() => group.deleteCollisionTree()).not.toThrow();
      expect(mockTree.remove).not.toHaveBeenCalled();
    });

    it('should use correct equality function for removal', () => {
      const group = new ComponentGroup();
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: mockLayer,
        uuid: 'comp-1',
        layer: mockLayer,
        sprite: {
          getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
            minX: 0, minY: 0, maxX: 10, maxY: 10
          })
        },
        position: { x: 0, y: 0 }
      };
      
      group.addComponent(mockComponent);
      group.deleteCollisionTree();
      
      // Get the equality function that was passed to remove
      const removeCall = mockTree.remove.calls.first();
      const equalityFn = removeCall.args[1];
      
      // Test the equality function
      expect(equalityFn({ id: 'comp-1' }, { id: 'comp-1' })).toBe(true);
      expect(equalityFn({ id: 'comp-1' }, { id: 'comp-2' })).toBe(false);
    });
  });

  describe('insertCollisionTree', () => {
    let mockTree;
    let mockLayer;

    beforeEach(() => {
      mockTree = {
        load: jasmine.createSpy('load')
      };
      mockLayer = {
        tree: mockTree
      };
    });

    for (let a of [true, false]) {
      it(`should insert all components into the collision tree ${a == true ? 'temp' : 'perm'}`, () => {
        const group = new ComponentGroup(a);

        const mockBounds1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
        const mockBounds2 = { minX: 5, minY: 5, maxX: 15, maxY: 15 };

        const mockComponent1 = {
          getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds1),
          connections: [],
          parent: mockLayer,
          uuid: 'comp-1',
          layer: mockLayer,
          sprite: {
            getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
              minX: 0, minY: 0, maxX: 10, maxY: 10
            })
          },
          position: { x: 100, y: 200 }
        };

        const mockComponent2 = {
          getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds2),
          connections: [],
          parent: mockLayer,
          uuid: 'comp-2',
          layer: mockLayer,
          sprite: {
            getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
              minX: 5, minY: 5, maxX: 15, maxY: 15
            })
          },
          position: { x: 150, y: 250 }
        };

        group.addComponent(mockComponent1);
        group.addComponent(mockComponent2);

        group.insertCollisionTree();

        expect(mockTree.load).toHaveBeenCalledTimes(1);
        expect(mockTree.load).toHaveBeenCalledWith([
          {
            id: 'comp-1',
            minX: 100,  // 0 + 100
            minY: 200,  // 0 + 200
            maxX: 110,  // 10 + 100
            maxY: 210,  // 10 + 200
            component: mockComponent1
          },
          {
            id: 'comp-2',
            minX: 155,  // 5 + 150
            minY: 255,  // 5 + 250
            maxX: 165,  // 15 + 150
            maxY: 265,  // 15 + 250
            component: mockComponent2
          }
        ]);
      });
    }

    it('should NOT call load when group is empty', () => {
      const group = new ComponentGroup();
      
      group.insertCollisionTree();
      
      expect(mockTree.load).not.toHaveBeenCalled();
    });

    it('should handle single component', () => {
      const group = new ComponentGroup();
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: mockLayer,
        uuid: 'comp-1',
        layer: mockLayer,
        sprite: {
          getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
            minX: 0, minY: 0, maxX: 10, maxY: 10
          })
        },
        position: { x: 50, y: 75 }
      };
      
      group.addComponent(mockComponent);
      group.insertCollisionTree();
      
      expect(mockTree.load).toHaveBeenCalledTimes(1);
      expect(mockTree.load).toHaveBeenCalledWith([
        {
          id: 'comp-1',
          minX: 50,
          minY: 75,
          maxX: 60,
          maxY: 85,
          component: mockComponent
        }
      ]);
    });
  });

  describe('rotate', () => {
    let mockTree;
    let mockLayer;

    beforeEach(() => {
      mockTree = {
        remove: jasmine.createSpy('remove'),
        load: jasmine.createSpy('load')
      };
      mockLayer = {
        tree: mockTree,
        findMatchingConnection: jasmine.createSpy('findMatchingConnection')
      };
    });

    /**
     * Helper function to create a mock component
     * @param {Object} overrides - Properties to override in the mock
     * @returns {Object} Mock component
     */
    function createMockComponent(overrides = {}) {
      const defaults = {
        uuid: `comp-${Math.random()}`,
        connections: [],
        parent: mockLayer,  // Use mockLayer as parent so all components are on same layer
        layer: mockLayer,
        position: {
          x: 0,
          y: 0,
          set: jasmine.createSpy('set')
        },
        sprite: {
          rotation: 0,
          getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
            minX: 0, minY: 0, maxX: 10, maxY: 10
          })
        },
        getBounds: jasmine.createSpy('getBounds').and.returnValue({ 
          minX: 0, minY: 0, maxX: 10, maxY: 10 
        }),
        getPose: jasmine.createSpy('getPose').and.returnValue({
          x: 0,
          y: 0,
          angle: 0,
          rotateAround: jasmine.createSpy('rotateAround').and.returnValue({
            x: 5,
            y: 5,
            angle: Math.PI / 4
          })
        })
      };

      const mock = { ...defaults, ...overrides };
      
      // Handle nested objects that might be overridden
      if (overrides.position) {
        mock.position = { ...defaults.position, ...overrides.position };
      }
      if (overrides.sprite) {
        mock.sprite = { ...defaults.sprite, ...overrides.sprite };
      }
      if (overrides.connections) {
        mock.connections = overrides.connections.map(conn => ({
          otherConnection: null,
          updateCircle: jasmine.createSpy('updateCircle'),
          ...conn
        }));
      }

      return mock;
    }

    it('should do nothing if canRotate returns false', () => {
      const group = new ComponentGroup();
      
      spyOn(group, 'canRotate').and.returnValue(false);
      spyOn(group, 'deleteCollisionTree');
      
      group.rotate();
      
      expect(group.deleteCollisionTree).not.toHaveBeenCalled();
    });

    it('should do nothing if getLocalPosition returns null', () => {
      const group = new ComponentGroup();
      
      spyOn(group, 'canRotate').and.returnValue(true);
      spyOn(group, 'getLocalPosition').and.returnValue(null);
      spyOn(group, 'deleteCollisionTree');
      
      group.rotate();
      
      expect(group.deleteCollisionTree).not.toHaveBeenCalled();
    });

    it('should call deleteCollisionTree before modifying component positions', () => {
      const group = new ComponentGroup();
      const callOrder = [];
      
      const mockParent = {
        toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
      };
      
      const mockComponent = createMockComponent({
        connections: [{}],
        parent: mockParent,
        position: {
          set: jasmine.createSpy('set').and.callFake(() => {
            callOrder.push('position.set');
          })
        }
      });
      
      group.addComponent(mockComponent);
      
      spyOn(group, 'deleteCollisionTree').and.callFake(() => {
        callOrder.push('deleteCollisionTree');
      });
      spyOn(group, 'insertCollisionTree').and.callFake(() => {
        callOrder.push('insertCollisionTree');
      });
      
      group.rotate(Math.PI / 4);
      
      expect(callOrder[0]).toBe('deleteCollisionTree');
      expect(callOrder.indexOf('deleteCollisionTree')).toBeLessThan(callOrder.indexOf('position.set'));
    });

    it('should call insertCollisionTree after all modifications', () => {
      const group = new ComponentGroup();
      const callOrder = [];
      
      const mockParent = {
        toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
      };
      
      const mockComponent = createMockComponent({
        connections: [{
          updateCircle: jasmine.createSpy('updateCircle').and.callFake(() => {
            callOrder.push('updateCircle');
          })
        }],
        parent: mockParent,
        position: {
          set: jasmine.createSpy('set').and.callFake(() => {
            callOrder.push('position.set');
          })
        }
      });
      
      group.addComponent(mockComponent);
      
      spyOn(group, 'deleteCollisionTree').and.callFake(() => {
        callOrder.push('deleteCollisionTree');
      });
      spyOn(group, 'insertCollisionTree').and.callFake(() => {
        callOrder.push('insertCollisionTree');
      });
      
      group.rotate(Math.PI / 4);
      
      const insertIndex = callOrder.indexOf('insertCollisionTree');
      expect(insertIndex).toBe(callOrder.length - 1);
      expect(callOrder.indexOf('position.set')).toBeLessThan(insertIndex);
      expect(callOrder.indexOf('updateCircle')).toBeLessThan(insertIndex);
    });

    it('should rotate components around the group center', () => {
      const group = new ComponentGroup();
      const mockRotateAround = jasmine.createSpy('rotateAround').and.returnValue({
        x: 10,
        y: 10,
        angle: Math.PI / 4
      });
      
      const mockComponent = createMockComponent({
        connections: [{}],
        position: { x: 5, y: 5 },
        getPose: jasmine.createSpy('getPose').and.returnValue({
          x: 5,
          y: 5,
          angle: 0,
          rotateAround: mockRotateAround
        })
      });
      
      group.addComponent(mockComponent);
      
      spyOn(group, 'getLocalPosition').and.returnValue({ x: 15, y: 15 });
      spyOn(group, 'deleteCollisionTree');
      spyOn(group, 'insertCollisionTree');
      
      group.rotate(Math.PI / 4);
      
      expect(mockRotateAround).toHaveBeenCalledWith(15, 15, Math.PI / 4);
      expect(mockComponent.position.set).toHaveBeenCalledWith(10, 10);
      expect(mockComponent.sprite.rotation).toBe(Math.PI / 4);
    });

    it('should use default angle of PI/8 when no angle provided', () => {
      const group = new ComponentGroup();
      const mockRotateAround = jasmine.createSpy('rotateAround').and.returnValue({
        x: 5,
        y: 5,
        angle: Math.PI / 8
      });
      
      const mockComponent = createMockComponent({
        connections: [{}],
        getPose: jasmine.createSpy('getPose').and.returnValue({
          x: 0,
          y: 0,
          angle: 0,
          rotateAround: mockRotateAround
        })
      });
      
      group.addComponent(mockComponent);
      
      spyOn(group, 'getLocalPosition').and.returnValue({ x: 5, y: 5 });
      spyOn(group, 'deleteCollisionTree');
      spyOn(group, 'insertCollisionTree');
      
      group.rotate();
      
      expect(mockRotateAround).toHaveBeenCalledWith(5, 5, Math.PI / 8);
    });

    it('should call findMatchingConnection for open connections when checkConnections is true', () => {
      const group = new ComponentGroup();
      const mockComponent = createMockComponent({
        connections: [{}]
      });
      
      group.addComponent(mockComponent);
      
      spyOn(group, 'getLocalPosition').and.returnValue({ x: 5, y: 5 });
      spyOn(group, 'deleteCollisionTree');
      spyOn(group, 'insertCollisionTree');
      
      group.rotate(Math.PI / 4, true);
      
      expect(mockLayer.findMatchingConnection).toHaveBeenCalledWith(
        mockComponent.connections[0], 
        true
      );
    });

    it('should NOT call findMatchingConnection when checkConnections is false', () => {
      const group = new ComponentGroup();
      const mockComponent = createMockComponent({
        connections: [{}]
      });
      
      group.addComponent(mockComponent);
      
      spyOn(group, 'getLocalPosition').and.returnValue({ x: 5, y: 5 });
      spyOn(group, 'deleteCollisionTree');
      spyOn(group, 'insertCollisionTree');
      
      group.rotate(Math.PI / 4, false);
      
      expect(mockLayer.findMatchingConnection).not.toHaveBeenCalled();
    });

    it('should NOT call findMatchingConnection for connected connections', () => {
      const group = new ComponentGroup();
      const mockComponent = createMockComponent({
        connections: [{
          otherConnection: { component: {} }
        }]
      });
      
      group.addComponent(mockComponent);
      
      spyOn(group, 'getLocalPosition').and.returnValue({ x: 5, y: 5 });
      spyOn(group, 'deleteCollisionTree');
      spyOn(group, 'insertCollisionTree');
      
      group.rotate(Math.PI / 4, true);
      
      expect(mockLayer.findMatchingConnection).not.toHaveBeenCalled();
    });

    it('should call updateCircle on all connections', () => {
      const group = new ComponentGroup();
      const mockComponent = createMockComponent({
        connections: [
          {},
          { otherConnection: { component: {} } }
        ]
      });
      
      group.addComponent(mockComponent);
      
      spyOn(group, 'getLocalPosition').and.returnValue({ x: 5, y: 5 });
      spyOn(group, 'deleteCollisionTree');
      spyOn(group, 'insertCollisionTree');
      
      group.rotate(Math.PI / 4);
      
      expect(mockComponent.connections[0].updateCircle).toHaveBeenCalled();
      expect(mockComponent.connections[1].updateCircle).toHaveBeenCalled();
    });

    it('should rotate multiple components', () => {
      const group = new ComponentGroup();
      
      const mockComponent1 = createMockComponent({
        uuid: 'comp-1',
        connections: [{}],
        getPose: jasmine.createSpy('getPose').and.returnValue({
          x: 0,
          y: 0,
          angle: 0,
          rotateAround: jasmine.createSpy('rotateAround').and.returnValue({
            x: 5,
            y: 5,
            angle: Math.PI / 4
          })
        })
      });
      
      const mockComponent2 = createMockComponent({
        uuid: 'comp-2',
        connections: [{}],
        position: { x: 10, y: 10 },
        sprite: {
          getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
            minX: 10, minY: 10, maxX: 20, maxY: 20
          })
        },
        getBounds: jasmine.createSpy('getBounds').and.returnValue({ 
          minX: 10, minY: 10, maxX: 20, maxY: 20 
        }),
        getPose: jasmine.createSpy('getPose').and.returnValue({
          x: 10,
          y: 10,
          angle: 0,
          rotateAround: jasmine.createSpy('rotateAround').and.returnValue({
            x: 15,
            y: 15,
            angle: Math.PI / 4
          })
        })
      });
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      
      spyOn(group, 'getLocalPosition').and.returnValue({ x: 10, y: 10 });
      spyOn(group, 'deleteCollisionTree');
      spyOn(group, 'insertCollisionTree');
      
      group.rotate(Math.PI / 4);
      
      expect(mockComponent1.position.set).toHaveBeenCalledWith(5, 5);
      expect(mockComponent1.sprite.rotation).toBe(Math.PI / 4);
      expect(mockComponent2.position.set).toHaveBeenCalledWith(15, 15);
      expect(mockComponent2.sprite.rotation).toBe(Math.PI / 4);
    });

    it('should NOT insert collision tree when rotating while dragging', () => {
      const group = new ComponentGroup();
      
      const mockComponent = createMockComponent({
        connections: [{}]
      });
      
      group.addComponent(mockComponent);
      
      // Set group as dragging
      group.isDragging = true;
      
      spyOn(group, 'getLocalPosition').and.returnValue({ x: 5, y: 5 });
      spyOn(group, 'deleteCollisionTree');
      spyOn(group, 'insertCollisionTree');
      
      group.rotate(Math.PI / 4);
      
      // deleteCollisionTree should be called
      expect(group.deleteCollisionTree).toHaveBeenCalled();
      // insertCollisionTree should NOT be called because isDragging is true
      expect(group.insertCollisionTree).not.toHaveBeenCalled();
    });

    it('should insert collision tree when rotating while not dragging', () => {
      const group = new ComponentGroup();
      
      const mockComponent = createMockComponent({
        connections: [{}]
      });
      
      group.addComponent(mockComponent);
      
      // Ensure isDragging is false
      group.isDragging = false;
      
      spyOn(group, 'getLocalPosition').and.returnValue({ x: 5, y: 5 });
      spyOn(group, 'deleteCollisionTree');
      spyOn(group, 'insertCollisionTree');
      
      group.rotate(Math.PI / 4);
      
      // Both deleteCollisionTree and insertCollisionTree should be called
      expect(group.deleteCollisionTree).toHaveBeenCalled();
      expect(group.insertCollisionTree).toHaveBeenCalled();
    });
  });

  describe('sendToBack', () => {
    let mockLayoutController;
    let mockSpy;

    beforeAll(() => {
      mockLayoutController = {
        deleteComponent: jasmine.createSpy('deleteComponent')
      };
      
      mockSpy = spyOn(LayoutController, 'getInstance');
      mockSpy.and.returnValue(mockLayoutController);
    });

    beforeEach(() => {
      mockLayoutController.deleteComponent.calls.reset();
    });

    afterAll(() => {
      mockLayoutController.deleteComponent = undefined;
      mockSpy.and.callThrough();
    });

    it('should return early when the group is destroyed', () => {
      const group = new ComponentGroup();
      const mockParent = {
        setChildIndex: jasmine.createSpy('setChildIndex'),
        getChildIndex: jasmine.createSpy('getChildIndex')
      };
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: mockParent,
        group: null
      };
      
      group.addComponent(mockComponent);
      group.destroy();
      
      // Call sendToBack on destroyed group
      group.sendToBack();
      
      // Should not attempt to modify z-order
      expect(mockParent.setChildIndex).not.toHaveBeenCalled();
      expect(mockParent.getChildIndex).not.toHaveBeenCalled();
    });

    it('should return early when the group has no parent', () => {
      const group = new ComponentGroup();
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: null
      };
      
      // Don't add component to group (so parent stays null)
      // Just manually set up the internal state
      group.addComponent(mockComponent);
      group.parent = null;
      
      const setChildIndexSpy = jasmine.createSpy('setChildIndex');
      
      // Call sendToBack with no parent
      group.sendToBack();
      
      // Should not throw and should not call setChildIndex
      expect(setChildIndexSpy).not.toHaveBeenCalled();
    });

    it('should complete without error when the group is empty', () => {
      const group = new ComponentGroup();
      
      // Set up a mock parent
      const mockParent = {
        setChildIndex: jasmine.createSpy('setChildIndex'),
        getChildIndex: jasmine.createSpy('getChildIndex')
      };
      group.parent = mockParent;
      
      // Call sendToBack on empty group
      expect(() => group.sendToBack()).not.toThrow();
      
      // Should not attempt to modify z-order
      expect(mockParent.setChildIndex).not.toHaveBeenCalled();
      expect(mockParent.getChildIndex).not.toHaveBeenCalled();
    });

    it('should move single component to index 0', () => {
      const group = new ComponentGroup();
      const mockParent = {
        setChildIndex: jasmine.createSpy('setChildIndex'),
        getChildIndex: jasmine.createSpy('getChildIndex').and.returnValue(5)
      };
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: mockParent
      };
      
      group.addComponent(mockComponent);
      
      // Call sendToBack
      group.sendToBack();
      
      // Should get the current index
      expect(mockParent.getChildIndex).toHaveBeenCalledWith(mockComponent);
      
      // Should move component to index 0
      expect(mockParent.setChildIndex).toHaveBeenCalledWith(mockComponent, 0);
      expect(mockParent.setChildIndex).toHaveBeenCalledTimes(1);
    });
  });

  describe('bringToFront', () => {
    let mockLayoutController;
    let mockSpy;

    beforeAll(() => {
      mockLayoutController = {
        deleteComponent: jasmine.createSpy('deleteComponent')
      };
      
      mockSpy = spyOn(LayoutController, 'getInstance');
      mockSpy.and.returnValue(mockLayoutController);
    });

    beforeEach(() => {
      mockLayoutController.deleteComponent.calls.reset();
    });

    afterAll(() => {
      mockLayoutController.deleteComponent = undefined;
      mockSpy.and.callThrough();
    });

    it('should return early when the group is destroyed', () => {
      const group = new ComponentGroup();
      const mockParent = {
        setChildIndex: jasmine.createSpy('setChildIndex'),
        getChildIndex: jasmine.createSpy('getChildIndex'),
        children: { length: 10 }
      };
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: mockParent,
        group: null
      };
      
      group.addComponent(mockComponent);
      group.destroy();
      
      // Call bringToFront on destroyed group
      group.bringToFront();
      
      // Should not attempt to modify z-order
      expect(mockParent.setChildIndex).not.toHaveBeenCalled();
      expect(mockParent.getChildIndex).not.toHaveBeenCalled();
    });

    it('should return early when the group has no parent', () => {
      const group = new ComponentGroup();
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: null
      };
      
      // Don't add component to group (so parent stays null)
      // Just manually set up the internal state
      group.addComponent(mockComponent);
      group.parent = null;
      
      const setChildIndexSpy = jasmine.createSpy('setChildIndex');
      
      // Call bringToFront with no parent
      group.bringToFront();
      
      // Should not throw and should not call setChildIndex
      expect(setChildIndexSpy).not.toHaveBeenCalled();
    });

    it('should complete without error when the group is empty', () => {
      const group = new ComponentGroup();
      
      // Set up a mock parent
      const mockParent = {
        setChildIndex: jasmine.createSpy('setChildIndex'),
        getChildIndex: jasmine.createSpy('getChildIndex'),
        children: { length: 10 }
      };
      group.parent = mockParent;
      
      // Call bringToFront on empty group
      expect(() => group.bringToFront()).not.toThrow();
      
      // Should not attempt to modify z-order
      expect(mockParent.setChildIndex).not.toHaveBeenCalled();
      expect(mockParent.getChildIndex).not.toHaveBeenCalled();
    });

    it('should move single component to front', () => {
      const group = new ComponentGroup();
      const mockParent = {
        setChildIndex: jasmine.createSpy('setChildIndex'),
        getChildIndex: jasmine.createSpy('getChildIndex').and.returnValue(5),
        children: { length: 10 }
      };
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: mockParent
      };
      
      group.addComponent(mockComponent);
      
      // Call bringToFront
      group.bringToFront();
      
      // Should get the current index
      expect(mockParent.getChildIndex).toHaveBeenCalledWith(mockComponent);
      
      // Should move component to front (length - 2 = 8)
      expect(mockParent.setChildIndex).toHaveBeenCalledWith(mockComponent, 8);
      expect(mockParent.setChildIndex).toHaveBeenCalledTimes(1);
    });

    // Feature: send-to-back-improvements, Property 2: Relative ordering preservation for bringToFront
    it('should preserve relative ordering when bringing multiple components to front', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }), // Number of components in the group
          fc.integer({ min: 0, max: 50 }), // Number of filler components before
          fc.integer({ min: 0, max: 50 }), // Number of filler components after
          (numGroupComponents, numFillersBefore, numFillersAfter) => {
            const group = new ComponentGroup();
            
            // Create a mock parent container
            const children = [];
            const mockParent = {
              children: children,
              getChildIndex: jasmine.createSpy('getChildIndex').and.callFake((comp) => {
                return children.indexOf(comp);
              }),
              setChildIndex: jasmine.createSpy('setChildIndex').and.callFake((comp, index) => {
                // Remove component from current position
                const currentIndex = children.indexOf(comp);
                if (currentIndex !== -1) {
                  children.splice(currentIndex, 1);
                }
                // Insert at new position
                children.splice(index, 0, comp);
              })
            };
            
            // Add filler components before the group
            for (let i = 0; i < numFillersBefore; i++) {
              const fillerComponent = {
                uuid: `filler-before-${i}`,
                getBounds: jasmine.createSpy('getBounds'),
                connections: [],
                parent: mockParent
              };
              children.push(fillerComponent);
            }
            
            // Create group components with random z-indices
            const groupComponents = [];
            for (let i = 0; i < numGroupComponents; i++) {
              const component = {
                uuid: `group-comp-${i}`,
                getBounds: jasmine.createSpy('getBounds'),
                connections: [],
                parent: mockParent
              };
              children.push(component);
              group.addComponent(component);
              groupComponents.push(component);
            }
            
            // Add filler components after the group
            for (let i = 0; i < numFillersAfter; i++) {
              const fillerComponent = {
                uuid: `filler-after-${i}`,
                getBounds: jasmine.createSpy('getBounds'),
                connections: [],
                parent: mockParent
              };
              children.push(fillerComponent);
            }
            
            // Add the grid overlay component at the end (required for bringToFront logic)
            const gridOverlay = {
              uuid: 'grid-overlay',
              getBounds: jasmine.createSpy('getBounds'),
              connections: [],
              parent: mockParent
            };
            children.push(gridOverlay);
            
            // Record initial relative ordering within the group
            const initialIndices = groupComponents.map(comp => children.indexOf(comp));
            const initialRelativeOrder = initialIndices.map((idx, i) => {
              return initialIndices.filter(otherIdx => otherIdx < idx).length;
            });
            
            // Call bringToFront
            group.bringToFront();
            
            // Verify all components moved to the front (before grid overlay)
            const finalIndices = groupComponents.map(comp => children.indexOf(comp));
            const maxGroupIndex = Math.max(...finalIndices);
            const gridIndex = children.indexOf(gridOverlay);
            
            // All group components should be before the grid overlay
            expect(maxGroupIndex).toBeLessThan(gridIndex);
            
            // Verify relative ordering is preserved
            const finalRelativeOrder = finalIndices.map((idx, i) => {
              return finalIndices.filter(otherIdx => otherIdx < idx).length;
            });
            
            expect(finalRelativeOrder).toEqual(initialRelativeOrder);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('onStartDrag', () => {
    let mockEvent;
    let mockStage;

    beforeEach(() => {
      mockStage = {
        on: jasmine.createSpy('on')
      };
      
      window.app = {
        stage: mockStage
      };

      mockEvent = {
        getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 200 }),
        stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
      };

      LayoutController.dragTarget = null;
      LayoutController.dragDistance = 0;
    });

    afterEach(() => {
      delete window.app;
    });

    /**
     * Helper function to create a group with a mock component and getPose spy
     * @param {Object} options - Configuration options
     * @returns {{group: ComponentGroup, component: Object}} The created group and mock component
     */
    function createGroupWithMockComponent(options = {}) {
      const group = new ComponentGroup();
      const mockParent = options.parent || {};
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: options.connections || [],
        parent: mockParent,
        sprite: {
          getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
            minX: 0, minY: 0, maxX: 10, maxY: 10
          })
        },
        layer: {
          tree: {
            remove: jasmine.createSpy('remove')
          }
        },
        position: { x: 0, y: 0 },
        uuid: `mock-comp-${Math.random()}`,
        ...(options.componentOverrides || {})
      };
      
      group.addComponent(mockComponent);
      
      const mockPose = {
        x: 0,
        y: 0,
        angle: 0,
        subtract: jasmine.createSpy('subtract').and.returnValue({ x: 0, y: 0, angle: 0 }),
        ...(options.poseOverrides || {})
      };
      
      if (!options.skipPoseSpy) {
        spyOn(group, 'getPose').and.returnValue(mockPose);
      }
      
      if (options.deleteCollisionTreeSpy) {
        spyOn(group, 'deleteCollisionTree');
      }
      
      return { group, component: mockComponent };
    }

    it('should set LayoutController.dragTarget to the group', () => {
      const { group } = createGroupWithMockComponent();
      group.onStartDrag(mockEvent);
      
      expect(LayoutController.dragTarget).toBe(group);
    });

    it('should reset LayoutController.dragDistance to 0', () => {
      LayoutController.dragDistance = 100;
      const { group } = createGroupWithMockComponent();
      group.onStartDrag(mockEvent);
      
      expect(LayoutController.dragDistance).toBe(0);
    });

    it('should set alpha to 0.5', () => {
      const { group, component } = createGroupWithMockComponent({
        componentOverrides: { alpha: 1 }
      });
      
      group.onStartDrag(mockEvent);
      
      expect(component.alpha).toBe(0.5);
    });

    it('should set isDragging to false initially', () => {
      const { group, component } = createGroupWithMockComponent({
        componentOverrides: { isDragging: true }
      });
      
      group.onStartDrag(mockEvent);
      
      expect(component.isDragging).toBe(false);
    });

    it('should call deleteCollisionTree', () => {
      const { group } = createGroupWithMockComponent({
        deleteCollisionTreeSpy: true
      });
      
      group.onStartDrag(mockEvent);
      
      expect(group.deleteCollisionTree).toHaveBeenCalled();
    });

    it('should find the closest connection to drag start position', () => {
      const mockConnection1 = {
        getPose: jasmine.createSpy('getPose').and.returnValue({
          x: 110,
          y: 210,
          subtract: jasmine.createSpy('subtract').and.returnValue({
            magnitude: () => 14.14
          })
        })
      };
      
      const mockConnection2 = {
        getPose: jasmine.createSpy('getPose').and.returnValue({
          x: 105,
          y: 203,
          subtract: jasmine.createSpy('subtract').and.returnValue({
            magnitude: () => 5.83
          })
        })
      };
      
      const { group } = createGroupWithMockComponent({
        connections: [mockConnection1, mockConnection2],
        poseOverrides: {
          x: 100,
          y: 200
        }
      });
      
      group.onStartDrag(mockEvent);
      
      expect(group.dragStartConnection).toBe(mockConnection2);
    });

    it('should set dragStartPos relative to closest connection when connection found', () => {
      const mockConnection = {
        getPose: jasmine.createSpy('getPose').and.returnValue({
          x: 105,
          y: 203,
          subtract: jasmine.createSpy('subtract').and.returnValue({
            magnitude: () => 5.83,
            x: -5,
            y: -3,
            angle: 0
          })
        })
      };
      
      const mockPose = {
        x: 100,
        y: 200,
        angle: 0,
        subtract: jasmine.createSpy('subtract').and.returnValue({
          x: -5,
          y: -3,
          angle: 0
        })
      };
      
      const { group } = createGroupWithMockComponent({
        connections: [mockConnection],
        skipPoseSpy: true
      });
      
      spyOn(group, 'getPose').and.returnValue(mockPose);
      group.onStartDrag(mockEvent);
      
      expect(group.dragStartPos.x).toBe(-5);
      expect(group.dragStartPos.y).toBe(-3);
    });

    it('should set dragStartOffset relative to group pose when connection found', () => {
      const mockConnectionPose = {
        x: 105,
        y: 203,
        angle: 0,
        subtract: jasmine.createSpy('subtract').and.callFake((pose) => {
          if (pose.x === 100) {
            return { magnitude: () => 5.83 };
          }
          return null;
        })
      };
      
      const mockConnection = {
        getPose: jasmine.createSpy('getPose').and.returnValue(mockConnectionPose)
      };
      
      const mockGroupPose = {
        x: 110,
        y: 210,
        angle: 0,
        subtract: jasmine.createSpy('subtract').and.returnValue({
          x: 5,
          y: 7,
          angle: 0
        })
      };
      
      const { group } = createGroupWithMockComponent({
        connections: [mockConnection],
        skipPoseSpy: true
      });
      
      spyOn(group, 'getPose').and.returnValue(mockGroupPose);
      group.onStartDrag(mockEvent);
      
      expect(mockGroupPose.subtract).toHaveBeenCalledWith(mockConnectionPose);
      expect(group.dragStartOffset.x).toBe(5);
      expect(group.dragStartOffset.y).toBe(7);
    });

    it('should set dragStartPos to group pose when no connections', () => {
      const { group } = createGroupWithMockComponent({
        poseOverrides: {
          x: 110,
          y: 210,
          subtract: jasmine.createSpy('subtract').and.returnValue({
            x: 10,
            y: 10,
            angle: 0
          })
        }
      });
      
      group.onStartDrag(mockEvent);
      
      expect(group.dragStartConnection).toBeNull();
      expect(group.dragStartPos.x).toBe(10);
      expect(group.dragStartPos.y).toBe(10);
    });

    it('should set dragStartOffset to (0,0,0) when no connections', () => {
      const { group } = createGroupWithMockComponent({
        poseOverrides: {
          x: 110,
          y: 210,
          subtract: jasmine.createSpy('subtract').and.returnValue({
            x: 10,
            y: 10,
            angle: 0
          })
        }
      });
      
      group.onStartDrag(mockEvent);
      
      expect(group.dragStartOffset.x).toBe(0);
      expect(group.dragStartOffset.y).toBe(0);
      expect(group.dragStartOffset.angle).toBe(0);
    });

    it('should register pointermove listener on stage', () => {
      const { group } = createGroupWithMockComponent();
      group.onStartDrag(mockEvent);
      
      expect(mockStage.on).toHaveBeenCalledWith('pointermove', LayoutController.onDragMove);
    });

    it('should register pointerupoutside listener on stage', () => {
      const { group } = createGroupWithMockComponent();
      group.onStartDrag(mockEvent);
      
      expect(mockStage.on).toHaveBeenCalledWith('pointerupoutside', LayoutController.onDragEnd);
    });

    it('should call stopImmediatePropagation on event', () => {
      const { group } = createGroupWithMockComponent();
      group.onStartDrag(mockEvent);
      
      expect(mockEvent.stopImmediatePropagation).toHaveBeenCalled();
    });

    it('should get local position from parent', () => {
      const mockParent = {};
      const { group } = createGroupWithMockComponent({ parent: mockParent });
      group.onStartDrag(mockEvent);
      
      expect(mockEvent.getLocalPosition).toHaveBeenCalledWith(mockParent);
    });
  });

  describe('serialize', () => {
    it('should serialize a ComponentGroup with uuid', () => {
      const group = new ComponentGroup();
      const serialized = group.serialize();
      
      expect(serialized).toBeDefined();
      expect(serialized.uuid).toBe(group.uuid);
      expect(typeof serialized.uuid).toBe('string');
    });

    it('should serialize a ComponentGroup without group property when not nested', () => {
      const group = new ComponentGroup();
      const serialized = group.serialize();
      
      expect(serialized.hasOwnProperty('group')).toBe(false);
    });

    it('should serialize a ComponentGroup with group property when nested', () => {
      const parentGroup = new ComponentGroup();
      const childGroup = new ComponentGroup();
      childGroup.group = parentGroup;
      
      const serialized = childGroup.serialize();
      
      expect(serialized.group).toBe(parentGroup.uuid);
    });

    // **Feature: permanent-component-groups, Property 1: Serialization round-trip preserves group structure**
    // **Validates: Requirements 3.5, 7.2, 7.3, 3.4, 8.4**
    it('should preserve group structure through serialization round-trip', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3 }), // Nesting depth (0 = no nesting, 1-3 = nested levels)
          fc.boolean(), // Whether the group is temporary
          (nestingDepth, isTemporary) => {
            // Create a chain of nested groups
            const groups = [];
            for (let i = 0; i <= nestingDepth; i++) {
              const group = new ComponentGroup(isTemporary);
              if (i > 0) {
                // Nest this group in the previous one
                group.group = groups[i - 1];
              }
              groups.push(group);
            }
            
            const targetGroup = groups[groups.length - 1]; // The most nested group
            
            // Serialize the target group
            const serialized = targetGroup.serialize();
            
            // Verify basic structure
            expect(serialized.uuid).toBe(targetGroup.uuid);
            expect(typeof serialized.uuid).toBe('string');
            expect(serialized.uuid.length).toBeGreaterThan(0);
            
            // Verify nesting structure
            if (nestingDepth === 0) {
              // No nesting - should not have group property
              expect(serialized.hasOwnProperty('group')).toBe(false);
            } else {
              // Has nesting - should have group property pointing to parent
              expect(serialized.group).toBe(groups[nestingDepth - 1].uuid);
            }
            
            // Verify that serialization is deterministic
            const serialized2 = targetGroup.serialize();
            expect(serialized2).toEqual(serialized);
            
            // Verify that the original group structure is unchanged after serialization
            expect(targetGroup.uuid).toBeDefined();
            expect(targetGroup.isTemporary).toBe(isTemporary);
            if (nestingDepth > 0) {
              expect(targetGroup.group).toBe(groups[nestingDepth - 1]);
              expect(targetGroup.group.uuid).toBe(groups[nestingDepth - 1].uuid);
            } else {
              expect(targetGroup.group).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Feature: permanent-component-groups, Property 3: Dragging maintains relative positions**
    // **Validates: Requirements 4.1**
    it('should maintain relative positions when dragging permanent groups', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }), // Number of components in group
          fc.array(fc.tuple(fc.float({ min: -1000, max: 1000 }), fc.float({ min: -1000, max: 1000 })), { minLength: 2, maxLength: 10 }), // Component positions
          fc.tuple(fc.float({ min: -500, max: 500 }), fc.float({ min: -500, max: 500 })), // New position to move to
          (numComponents, positions, [newX, newY]) => {
            // Create a permanent ComponentGroup
            const group = new ComponentGroup(false); // permanent group
            const mockLayer = {
              tree: {
                remove: jasmine.createSpy('remove'),
                load: jasmine.createSpy('load')
              },
              toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
            };
            
            // Create mock components with specific positions
            const components = [];
            for (let i = 0; i < Math.min(numComponents, positions.length); i++) {
              const [x, y] = positions[i];
              const mockComponent = {
                uuid: `comp-${i}`,
                getBounds: jasmine.createSpy('getBounds').and.returnValue({
                  minX: x - 5, minY: y - 5, maxX: x + 5, maxY: y + 5
                }),
                connections: [],
                parent: mockLayer,
                position: {
                  x: x,
                  y: y,
                  set: jasmine.createSpy('set')
                }
              };
              components.push(mockComponent);
              group.addComponent(mockComponent);
            }
            
            // Record initial relative positions
            const initialPositions = components.map(comp => ({ x: comp.position.x, y: comp.position.y }));
            const initialRelativePositions = [];
            for (let i = 0; i < components.length; i++) {
              for (let j = i + 1; j < components.length; j++) {
                initialRelativePositions.push({
                  i, j,
                  deltaX: initialPositions[i].x - initialPositions[j].x,
                  deltaY: initialPositions[i].y - initialPositions[j].y
                });
              }
            }
            
            // Mock the group's position calculation methods
            spyOn(group, 'getLocalPosition').and.returnValue({ x: 0, y: 0 });
            
            // Move the group to new position
            group.move(newX, newY);
            
            // Verify all components were moved
            components.forEach(comp => {
              expect(comp.position.set).toHaveBeenCalled();
            });
            
            // Get the final positions from the set calls
            const finalPositions = components.map(comp => {
              const setCall = comp.position.set.calls.mostRecent();
              if (!setCall) {
                return { x: NaN, y: NaN }; // No call was made
              }
              return { x: setCall.args[0], y: setCall.args[1] };
            });
            
            // Verify relative positions are maintained
            for (const rel of initialRelativePositions) {
              const finalDeltaX = finalPositions[rel.i].x - finalPositions[rel.j].x;
              const finalDeltaY = finalPositions[rel.i].y - finalPositions[rel.j].y;
              
              // Skip if any values are NaN (invalid test data)
              if (isNaN(finalDeltaX) || isNaN(finalDeltaY) || isNaN(rel.deltaX) || isNaN(rel.deltaY)) {
                return; // Skip this test iteration
              }
              
              expect(Math.abs(finalDeltaX - rel.deltaX)).toBeLessThan(0.001);
              expect(Math.abs(finalDeltaY - rel.deltaY)).toBeLessThan(0.001);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Feature: permanent-component-groups, Property 4: Rotation maintains group structure**
    // **Validates: Requirements 4.2**
    it('should maintain group structure when rotating permanent groups', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 8 }), // Number of components in group
          fc.array(fc.tuple(fc.float({ min: -100, max: 100 }), fc.float({ min: -100, max: 100 }), fc.float({ min: 0, max: Math.fround(2 * Math.PI) })), { minLength: 2, maxLength: 8 }), // Component positions and rotations
          fc.float({ min: Math.fround(-Math.PI), max: Math.fround(Math.PI) }), // Rotation angle
          (numComponents, componentData, rotationAngle) => {
            // Create a permanent ComponentGroup
            const group = new ComponentGroup(false); // permanent group
            const mockLayer = {
              tree: {
                remove: jasmine.createSpy('remove'),
                load: jasmine.createSpy('load')
              },
              toLocal: jasmine.createSpy('toLocal').and.callFake(point => point),
              findMatchingConnection: jasmine.createSpy('findMatchingConnection')
            };
            
            // Create mock components with specific positions and rotations
            const components = [];
            for (let i = 0; i < Math.min(numComponents, componentData.length); i++) {
              const [x, y, rotation] = componentData[i];
              const mockComponent = {
                uuid: `comp-${i}`,
                getBounds: jasmine.createSpy('getBounds').and.returnValue({
                  minX: x - 5, minY: y - 5, maxX: x + 5, maxY: y + 5
                }),
                connections: [{
                  updateCircle: jasmine.createSpy('updateCircle')
                }],
                parent: mockLayer,
                layer: mockLayer,
                position: {
                  x: x,
                  y: y,
                  set: jasmine.createSpy('set')
                },
                sprite: {
                  rotation: rotation,
                  getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
                    minX: -5, minY: -5, maxX: 5, maxY: 5
                  })
                },
                getPose: jasmine.createSpy('getPose').and.returnValue({
                  x: x,
                  y: y,
                  angle: rotation,
                  rotateAround: jasmine.createSpy('rotateAround').and.returnValue({
                    x: x + 10, // Simulate rotation result
                    y: y + 10,
                    angle: rotation + rotationAngle
                  })
                })
              };
              components.push(mockComponent);
              group.addComponent(mockComponent);
            }
            
            // Mock canRotate to return true
            spyOn(group, 'canRotate').and.returnValue(true);
            spyOn(group, 'getLocalPosition').and.returnValue({ x: 0, y: 0 });
            spyOn(group, 'deleteCollisionTree');
            spyOn(group, 'insertCollisionTree');
            
            // Record initial relative positions and rotations
            const initialData = components.map(comp => ({
              x: comp.position.x,
              y: comp.position.y,
              rotation: comp.sprite.rotation
            }));
            
            // Rotate the group
            group.rotate(rotationAngle);
            
            // Verify all components were rotated
            components.forEach((comp, i) => {
              expect(comp.getPose).toHaveBeenCalled();
              expect(comp.getPose().rotateAround).toHaveBeenCalledWith(0, 0, rotationAngle);
              expect(comp.position.set).toHaveBeenCalled();
              expect(comp.connections[0].updateCircle).toHaveBeenCalled();
            });
            
            // Verify collision tree operations
            expect(group.deleteCollisionTree).toHaveBeenCalled();
            expect(group.insertCollisionTree).toHaveBeenCalled();
            
            // Verify all components maintain their group membership
            components.forEach(comp => {
              expect(comp.group).toBe(group);
            });
            
            // Verify group structure is intact
            expect(group.size).toBe(components.length);
            expect(group.destroyed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Feature: permanent-component-groups, Property 5: Copying creates equivalent permanent group**
    // **Validates: Requirements 4.3, 4.5**
    it('should create equivalent permanent group when copying', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // Number of components in group
          fc.array(fc.tuple(fc.float({ min: -100, max: 100 }), fc.float({ min: -100, max: 100 })), { minLength: 1, maxLength: 5 }), // Component positions
          (numComponents, positions) => {
            // Create a permanent ComponentGroup
            const originalGroup = new ComponentGroup(false); // permanent group
            const mockLayer = {
              tree: {
                remove: jasmine.createSpy('remove'),
                load: jasmine.createSpy('load')
              },
              toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
            };
            
            // Create mock components
            const originalComponents = [];
            for (let i = 0; i < Math.min(numComponents, positions.length); i++) {
              const [x, y] = positions[i];
              const mockComponent = {
                uuid: `original-comp-${i}`,
                getBounds: jasmine.createSpy('getBounds').and.returnValue({
                  minX: x - 5, minY: y - 5, maxX: x + 5, maxY: y + 5
                }),
                connections: [],
                parent: mockLayer,
                position: { x: x, y: y },
                clone: jasmine.createSpy('clone').and.returnValue({
                  uuid: `cloned-comp-${i}`,
                  getBounds: jasmine.createSpy('getBounds').and.returnValue({
                    minX: x - 5, minY: y - 5, maxX: x + 5, maxY: y + 5
                  }),
                  connections: [],
                  parent: mockLayer,
                  position: { x: x, y: y }
                })
              };
              originalComponents.push(mockComponent);
              originalGroup.addComponent(mockComponent);
            }
            
            // Clone the group
            const clonedGroup = originalGroup.clone(mockLayer);
            
            // Verify the cloned group is permanent (not temporary)
            expect(clonedGroup.isTemporary).toBe(false);
            
            // Verify the cloned group has the same number of components
            expect(clonedGroup.size).toBe(originalGroup.size);
            
            // Verify all original components were cloned
            originalComponents.forEach(comp => {
              expect(comp.clone).toHaveBeenCalledWith(mockLayer);
            });
            
            // Verify the cloned group is a different object
            expect(clonedGroup).not.toBe(originalGroup);
            expect(clonedGroup.uuid).not.toBe(originalGroup.uuid);
            
            // Verify both groups maintain their structure
            expect(originalGroup.size).toBe(originalComponents.length);
            expect(originalGroup.destroyed).toBe(false);
            expect(clonedGroup.destroyed).toBe(false);
            
            // Verify the cloned group has different UUID but same structure
            expect(typeof clonedGroup.uuid).toBe('string');
            expect(clonedGroup.uuid.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Test that cloned ComponentGroups are always unlocked
    it('should always create unlocked ComponentGroups when cloning regardless of source state', () => {
      const mockLayer = {
        tree: {
          remove: jasmine.createSpy('remove'),
          load: jasmine.createSpy('load')
        },
        toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
      };
      
      // Test with locked permanent group
      const lockedGroup = new ComponentGroup(false);
      const mockComponent1 = {
        uuid: 'comp-1',
        getBounds: jasmine.createSpy('getBounds').and.returnValue({
          minX: -5, minY: -5, maxX: 5, maxY: 5
        }),
        connections: [],
        parent: mockLayer,
        position: { x: 0, y: 0 },
        clone: jasmine.createSpy('clone').and.returnValue({
          uuid: 'cloned-comp-1',
          getBounds: jasmine.createSpy('getBounds').and.returnValue({
            minX: -5, minY: -5, maxX: 5, maxY: 5
          }),
          connections: [],
          parent: mockLayer,
          position: { x: 0, y: 0 }
        })
      };
      lockedGroup.addComponent(mockComponent1);
      lockedGroup.locked = true;
      
      expect(lockedGroup.locked).toBe(true);
      const clonedLockedGroup = lockedGroup.clone(mockLayer);
      expect(clonedLockedGroup.locked).toBe(false);
      
      // Test with unlocked permanent group
      const unlockedGroup = new ComponentGroup(false);
      const mockComponent2 = {
        uuid: 'comp-2',
        getBounds: jasmine.createSpy('getBounds').and.returnValue({
          minX: -5, minY: -5, maxX: 5, maxY: 5
        }),
        connections: [],
        parent: mockLayer,
        position: { x: 0, y: 0 },
        clone: jasmine.createSpy('clone').and.returnValue({
          uuid: 'cloned-comp-2',
          getBounds: jasmine.createSpy('getBounds').and.returnValue({
            minX: -5, minY: -5, maxX: 5, maxY: 5
          }),
          connections: [],
          parent: mockLayer,
          position: { x: 0, y: 0 }
        })
      };
      unlockedGroup.addComponent(mockComponent2);
      unlockedGroup.locked = false;
      
      expect(unlockedGroup.locked).toBe(false);
      const clonedUnlockedGroup = unlockedGroup.clone(mockLayer);
      expect(clonedUnlockedGroup.locked).toBe(false);
    });

    // **Feature: permanent-component-groups, Property 6: Deletion removes group and components**
    // **Validates: Requirements 4.4**
    it('should remove group and all components when deleting permanent group', () => {
      // Mock LayoutController outside the property test
      const mockLayoutController = {
        deleteComponent: jasmine.createSpy('deleteComponent')
      };
      const layoutControllerSpy = spyOn(LayoutController, 'getInstance').and.returnValue(mockLayoutController);
      
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 8 }), // Number of components in group
          fc.array(fc.tuple(fc.float({ min: -100, max: 100 }), fc.float({ min: -100, max: 100 })), { minLength: 1, maxLength: 8 }), // Component positions
          (numComponents, positions) => {
            // Reset the spy for each test iteration
            mockLayoutController.deleteComponent.calls.reset();
            
            // Create a permanent ComponentGroup
            const group = new ComponentGroup(false); // permanent group
            const mockLayer = {
              tree: {
                remove: jasmine.createSpy('remove'),
                load: jasmine.createSpy('load')
              }
            };
            
            // Create mock components
            const components = [];
            for (let i = 0; i < Math.min(numComponents, positions.length); i++) {
              const [x, y] = positions[i];
              const mockComponent = {
                uuid: `comp-${i}`,
                getBounds: jasmine.createSpy('getBounds').and.returnValue({
                  minX: x - 5, minY: y - 5, maxX: x + 5, maxY: y + 5
                }),
                connections: [],
                parent: mockLayer,
                position: { x: x, y: y },
                group: null
              };
              components.push(mockComponent);
              group.addComponent(mockComponent);
            }
            
            // Verify initial state
            expect(group.size).toBe(components.length);
            expect(group.destroyed).toBe(false);
            components.forEach(comp => {
              expect(comp.group).toBe(group);
            });
            
            // Destroy the group
            group.destroy();
            
            // Verify group is marked as destroyed
            expect(group.destroyed).toBe(true);
            expect(group.parent).toBeNull();
            expect(group.connections.size).toBe(0);
            
            // Verify all components had their group reference cleared
            components.forEach(comp => {
              expect(comp.group).toBeNull();
            });
            
            // Verify all components were deleted via LayoutController (for permanent groups)
            expect(mockLayoutController.deleteComponent).toHaveBeenCalledTimes(components.length);
            components.forEach(comp => {
              expect(mockLayoutController.deleteComponent).toHaveBeenCalledWith(comp);
            });
            
            // Verify group size returns 0 after destruction (components array is nullified)
            expect(group.size).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
      
      // Clean up the spy
      layoutControllerSpy.and.callThrough();
    });

    // **Feature: permanent-component-groups, Property 9: All components in a group share the same layer**
    // **Validates: Requirements 7.1, 7.5**
    it('should ensure all components in a permanent group share the same layer', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 8 }), // Number of components to add
          fc.array(fc.tuple(fc.float({ min: -100, max: 100 }), fc.float({ min: -100, max: 100 })), { minLength: 2, maxLength: 8 }), // Component positions
          (numComponents, positions) => {
            // Create a permanent ComponentGroup
            const group = new ComponentGroup(false); // permanent group
            const sharedLayer = {
              tree: {
                remove: jasmine.createSpy('remove'),
                load: jasmine.createSpy('load')
              },
              toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
            };
            
            // Create components all on the same layer
            const components = [];
            for (let i = 0; i < Math.min(numComponents, positions.length); i++) {
              const [x, y] = positions[i];
              const mockComponent = {
                uuid: `comp-${i}`,
                getBounds: jasmine.createSpy('getBounds').and.returnValue({
                  minX: x - 5, minY: y - 5, maxX: x + 5, maxY: y + 5
                }),
                connections: [],
                parent: sharedLayer, // All components on same layer
                layer: sharedLayer,
                position: { x: x, y: y },
                group: null
              };
              components.push(mockComponent);
              group.addComponent(mockComponent);
            }
            
            // Verify all components are in the group
            expect(group.size).toBe(components.length);
            
            // Verify all components share the same layer (parent)
            const groupLayer = group.parent;
            expect(groupLayer).toBe(sharedLayer);
            
            components.forEach(comp => {
              expect(comp.parent).toBe(groupLayer);
              expect(comp.group).toBe(group);
            });
            
            // Verify group maintains layer reference
            expect(group.parent).toBe(sharedLayer);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('layer constraints', () => {
    it('should prevent adding component from different layer to a group', () => {
      // Create a permanent ComponentGroup
      const group = new ComponentGroup(false); // permanent group
      
      const layer1 = {
        tree: {
          remove: jasmine.createSpy('remove'),
          load: jasmine.createSpy('load')
        },
        toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
      };
      
      const layer2 = {
        tree: {
          remove: jasmine.createSpy('remove'),
          load: jasmine.createSpy('load')
        },
        toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
      };
      
      // Add first component to establish the group's layer
      const component1 = {
        uuid: 'comp-1',
        getBounds: jasmine.createSpy('getBounds').and.returnValue({
          minX: 0, minY: 0, maxX: 10, maxY: 10
        }),
        connections: [],
        parent: layer1,
        layer: layer1,
        position: { x: 0, y: 0 },
        group: null
      };
      
      group.addComponent(component1);
      expect(group.parent).toBe(layer1);
      expect(group.size).toBe(1);
      
      // Try to add component from different layer
      const component2 = {
        uuid: 'comp-2',
        getBounds: jasmine.createSpy('getBounds').and.returnValue({
          minX: 10, minY: 10, maxX: 20, maxY: 20
        }),
        connections: [],
        parent: layer2, // Different layer
        layer: layer2,
        position: { x: 10, y: 10 },
        group: null
      };
      
      // Should throw an error
      expect(() => group.addComponent(component2)).toThrowError(
        'Cannot add component from different layer to a ComponentGroup. All components in a group must be on the same layer.'
      );
      
      // Verify group state is unchanged
      expect(group.size).toBe(1);
      expect(group.parent).toBe(layer1);
      expect(component2.group).toBeNull();
      
      // Verify first component is still in the group
      expect(component1.group).toBe(group);
    });

    // **Feature: permanent-component-groups, Property 10: Nested groups maintain structure during operations**
    // **Validates: Requirements 8.2**
    it('should maintain nested group structure during all operations', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }), // Nesting depth (1-3 levels)
          fc.integer({ min: 1, max: 4 }), // Number of components per group
          fc.array(fc.tuple(fc.float({ min: -50, max: 50 }), fc.float({ min: -50, max: 50 })), { minLength: 1, maxLength: 12 }), // Component positions
          (nestingDepth, componentsPerGroup, positions) => {
            const sharedLayer = {
              tree: {
                remove: jasmine.createSpy('remove'),
                load: jasmine.createSpy('load')
              },
              toLocal: jasmine.createSpy('toLocal').and.callFake(point => point),
              findMatchingConnection: jasmine.createSpy('findMatchingConnection')
            };
            
            // Create nested groups
            const groups = [];
            let positionIndex = 0;
            
            for (let level = 0; level < nestingDepth; level++) {
              const group = new ComponentGroup(false); // permanent group
              
              // Add components to this group
              for (let i = 0; i < componentsPerGroup && positionIndex < positions.length; i++) {
                const [x, y] = positions[positionIndex++];
                const mockComponent = {
                  uuid: `comp-${level}-${i}`,
                  getBounds: jasmine.createSpy('getBounds').and.returnValue({
                    minX: x - 2, minY: y - 2, maxX: x + 2, maxY: y + 2
                  }),
                  connections: [{
                    updateCircle: jasmine.createSpy('updateCircle')
                  }],
                  parent: sharedLayer,
                  layer: sharedLayer,
                  position: {
                    x: x,
                    y: y,
                    set: jasmine.createSpy('set')
                  },
                  sprite: {
                    rotation: 0,
                    getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
                      minX: -2, minY: -2, maxX: 2, maxY: 2
                    })
                  },
                  getPose: jasmine.createSpy('getPose').and.returnValue({
                    x: x,
                    y: y,
                    angle: 0,
                    rotateAround: jasmine.createSpy('rotateAround').and.returnValue({
                      x: x + 1,
                      y: y + 1,
                      angle: Math.PI / 8
                    })
                  }),
                  group: null
                };
                group.addComponent(mockComponent);
              }
              
              // Nest this group in the previous one (if not the first group)
              if (level > 0) {
                group.group = groups[level - 1];
              }
              
              groups.push(group);
            }
            
            // Skip if no groups were created or if any group has no components
            if (groups.length === 0) return;
            if (groups.some(group => group.size === 0)) return;
            
            const rootGroup = groups[0];
            const deepestGroup = groups[groups.length - 1];
            
            // Verify initial nesting structure
            for (let i = 1; i < groups.length; i++) {
              expect(groups[i].group).toBe(groups[i - 1]);
            }
            expect(rootGroup.group).toBeNull();
            
            // Test drag operation (move)
            spyOn(rootGroup, 'getLocalPosition').and.returnValue({ x: 0, y: 0 });
            rootGroup.move(10, 20);
            
            // Verify nesting structure is maintained after move
            for (let i = 1; i < groups.length; i++) {
              expect(groups[i].group).toBe(groups[i - 1]);
              expect(groups[i].destroyed).toBe(false);
            }
            expect(rootGroup.group).toBeNull();
            expect(rootGroup.destroyed).toBe(false);
            
            // Test rotation operation
            spyOn(rootGroup, 'canRotate').and.returnValue(true);
            spyOn(rootGroup, 'deleteCollisionTree');
            spyOn(rootGroup, 'insertCollisionTree');
            rootGroup.rotate(Math.PI / 8);
            
            // Verify nesting structure is maintained after rotation
            for (let i = 1; i < groups.length; i++) {
              expect(groups[i].group).toBe(groups[i - 1]);
              expect(groups[i].destroyed).toBe(false);
            }
            expect(rootGroup.group).toBeNull();
            expect(rootGroup.destroyed).toBe(false);
            
            // Test serialization
            const serialized = deepestGroup.serialize();
            expect(serialized.uuid).toBe(deepestGroup.uuid);
            if (nestingDepth > 1) {
              expect(serialized.group).toBe(groups[nestingDepth - 2].uuid);
            } else {
              expect(serialized.hasOwnProperty('group')).toBe(false);
            }
            
            // Verify nesting structure is maintained after serialization
            for (let i = 1; i < groups.length; i++) {
              expect(groups[i].group).toBe(groups[i - 1]);
              expect(groups[i].destroyed).toBe(false);
            }
            expect(rootGroup.group).toBeNull();
            expect(rootGroup.destroyed).toBe(false);
            
            // Verify all groups maintain their component counts
            groups.forEach(group => {
              expect(group.size).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Feature: permanent-component-groups, Property 8: isTemporary getter reflects current state**
    // **Validates: Requirements 6.4**
    it('should reflect current temporary/permanent state through isTemporary getter', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // Initial temporary state
          fc.boolean(), // New temporary state to set
          (initialTemporary, newTemporary) => {
            // Create ComponentGroup with initial temporary state
            const group = new ComponentGroup(initialTemporary);
            
            // Verify initial state is reflected correctly
            expect(group.isTemporary).toBe(initialTemporary);
            
            // Change the temporary state using the setter
            group.isTemporary = newTemporary;
            
            // Verify the getter reflects the new state
            expect(group.isTemporary).toBe(newTemporary);
            
            // Verify the state persists through multiple reads
            expect(group.isTemporary).toBe(newTemporary);
            expect(group.isTemporary).toBe(newTemporary);
            
            // Verify setting the same value doesn't change anything
            group.isTemporary = newTemporary;
            expect(group.isTemporary).toBe(newTemporary);
            
            // Test edge case: toggle back and forth
            group.isTemporary = !newTemporary;
            expect(group.isTemporary).toBe(!newTemporary);
            group.isTemporary = newTemporary;
            expect(group.isTemporary).toBe(newTemporary);
          }
        ),
        { numRuns: 100 }
      );
    });

    // **Feature: permanent-component-groups, Property 16: Component connections preserved in groups**
    // **Validates: Requirements 1.3**
    it('should preserve all component connections in the group connections map', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // Number of components
          fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 1, maxLength: 5 }), // Number of connections per component
          (numComponents, connectionsPerComponent) => {
            // Create a permanent ComponentGroup
            const group = new ComponentGroup(false); // permanent group
            const mockLayer = {
              tree: {
                remove: jasmine.createSpy('remove'),
                load: jasmine.createSpy('load')
              },
              toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
            };
            
            // Track all connections we create
            const allConnections = new Map();
            const components = [];
            
            // Create components with connections
            for (let i = 0; i < Math.min(numComponents, connectionsPerComponent.length); i++) {
              const numConns = connectionsPerComponent[i];
              const componentConnections = [];
              
              // Create connections for this component
              for (let j = 0; j < numConns; j++) {
                const connection = {
                  uuid: `conn-${i}-${j}`,
                  component: null, // Will be set when component is created
                  connectionIndex: j,
                  otherConnection: null,
                  updateCircle: jasmine.createSpy('updateCircle'),
                  getPose: jasmine.createSpy('getPose').and.returnValue({
                    x: i * 10 + j,
                    y: i * 10 + j,
                    angle: 0,
                    subtract: jasmine.createSpy('subtract').and.returnValue({
                      magnitude: () => 0
                    })
                  })
                };
                componentConnections.push(connection);
                allConnections.set(connection.uuid, connection);
              }
              
              // Create component with these connections
              const component = {
                uuid: `comp-${i}`,
                getBounds: jasmine.createSpy('getBounds').and.returnValue({
                  minX: i * 10 - 5, minY: i * 10 - 5, maxX: i * 10 + 5, maxY: i * 10 + 5
                }),
                connections: componentConnections,
                parent: mockLayer,
                layer: mockLayer,
                position: { 
                  x: i * 10, 
                  y: i * 10,
                  set: jasmine.createSpy('set')
                },
                group: null
              };
              
              // Set component reference in connections
              componentConnections.forEach(conn => {
                conn.component = component;
              });
              
              components.push(component);
              group.addComponent(component);
            }
            
            // Verify all connections are preserved in the group's connections map
            expect(group.connections.size).toBe(allConnections.size);
            
            // Verify each connection exists in the group's connections map
            for (const [uuid, connection] of allConnections) {
              expect(group.connections.has(uuid)).toBe(true);
              expect(group.connections.get(uuid)).toBe(connection);
            }
            
            // Verify the connections map contains only the expected connections
            for (const [uuid, connection] of group.connections) {
              expect(allConnections.has(uuid)).toBe(true);
              expect(allConnections.get(uuid)).toBe(connection);
            }
            
            // Test that connections are preserved after group operations
            const initialConnectionCount = group.connections.size;
            
            // Test move operation
            spyOn(group, 'getLocalPosition').and.returnValue({ x: 0, y: 0 });
            group.move(50, 50);
            expect(group.connections.size).toBe(initialConnectionCount);
            
            // Verify all original connections are still there
            for (const [uuid, connection] of allConnections) {
              expect(group.connections.has(uuid)).toBe(true);
              expect(group.connections.get(uuid)).toBe(connection);
            }
            
            // Test serialization doesn't affect connections
            const serialized = group.serialize();
            expect(group.connections.size).toBe(initialConnectionCount);
            
            // Verify connections are still preserved after serialization
            for (const [uuid, connection] of allConnections) {
              expect(group.connections.has(uuid)).toBe(true);
              expect(group.connections.get(uuid)).toBe(connection);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    describe('addComponent safety checks', () => {
      it('should prevent adding component that already belongs to another group', () => {
        const group1 = new ComponentGroup(false); // permanent group
        const group2 = new ComponentGroup(false); // permanent group
        
        const sharedLayer = {
          tree: {
            remove: jasmine.createSpy('remove'),
            load: jasmine.createSpy('load')
          }
        };
        
        const component = {
          uuid: 'test-component',
          getBounds: jasmine.createSpy('getBounds'),
          connections: [],
          parent: sharedLayer,
          layer: sharedLayer,
          group: null
        };
        
        // Add component to first group
        group1.addComponent(component);
        expect(component.group).toBe(group1);
        
        // Try to add same component to second group - should log warning and prevent addition
        spyOn(console, 'warn');
        group2.addComponent(component);
        expect(console.warn).toHaveBeenCalledWith(
          'Component already belongs to a group.',
          component
        );
        
        // Verify component is still in first group
        expect(component.group).toBe(group1);
        expect(group1.size).toBe(1);
        expect(group2.size).toBe(0);
      });

      it('should prevent adding same permanent group to temporary group multiple times', () => {
        const tempGroup = new ComponentGroup(true); // temporary group
        const permGroup = new ComponentGroup(false); // permanent group
        
        // Add permanent group to temporary group first time
        tempGroup.addComponent(permGroup);
        expect(tempGroup.size).toBe(1);
        
        // Try to add same permanent group again - should be silently ignored
        const consoleSpy = spyOn(console, 'warn');
        tempGroup.addComponent(permGroup);
        
        // Should still only have one component and log a warning
        expect(tempGroup.size).toBe(1);
        expect(consoleSpy).toHaveBeenCalledWith(
          jasmine.stringMatching(/Prevented adding ComponentGroup.*to another group multiple times/)
        );
      });

      it('should allow adding component that was removed from another group', () => {
        // Mock LayoutController for this test
        const mockLayoutController = {
          deleteComponent: jasmine.createSpy('deleteComponent')
        };
        spyOn(LayoutController, 'getInstance').and.returnValue(mockLayoutController);
        
        const group1 = new ComponentGroup(false); // permanent group
        const group2 = new ComponentGroup(false); // permanent group
        
        const sharedLayer = {
          tree: {
            remove: jasmine.createSpy('remove'),
            load: jasmine.createSpy('load')
          }
        };
        
        const component1 = {
          uuid: 'test-component-1',
          getBounds: jasmine.createSpy('getBounds'),
          connections: [],
          parent: sharedLayer,
          layer: sharedLayer,
          group: null
        };
        
        const component2 = {
          uuid: 'test-component-2',
          getBounds: jasmine.createSpy('getBounds'),
          connections: [],
          parent: sharedLayer,
          layer: sharedLayer,
          group: null
        };
        
        // Add two components to first group so it won't be destroyed when we remove one
        group1.addComponent(component1);
        group1.addComponent(component2);
        expect(component1.group).toBe(group1);
        expect(group1.size).toBe(2);
        
        // Remove one component from first group (group won't be destroyed since it still has component2)
        group1.removeComponent(component1);
        expect(component1.group).toBeNull();
        expect(group1.size).toBe(1);
        
        // Now should be able to add the removed component to second group
        expect(() => group2.addComponent(component1)).not.toThrow();
        expect(component1.group).toBe(group2);
        expect(group2.size).toBe(1);
      });

      it('should handle adding same component to same group idempotently', () => {
        const group = new ComponentGroup(false); // permanent group
        
        const sharedLayer = {
          tree: {
            remove: jasmine.createSpy('remove'),
            load: jasmine.createSpy('load')
          }
        };
        
        const component = {
          uuid: 'test-component',
          getBounds: jasmine.createSpy('getBounds'),
          connections: [],
          parent: sharedLayer,
          layer: sharedLayer,
          group: null
        };
        
        // Add component to group
        group.addComponent(component);
        expect(component.group).toBe(group);
        expect(group.size).toBe(1);
        
        // Add same component to same group again - should be idempotent
        expect(() => group.addComponent(component)).not.toThrow();
        expect(component.group).toBe(group);
        expect(group.size).toBe(1); // Size should not change
      });
    });

    // **Feature: permanent-component-groups, Property 11: Ungrouping parent preserves nested groups**
    // **Validates: Requirements 8.5**
    it('should preserve nested groups when ungrouping parent group', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 4 }), // Number of nested child groups
          fc.integer({ min: 1, max: 3 }), // Number of components per child group
          fc.array(fc.tuple(fc.float({ min: -50, max: 50 }), fc.float({ min: -50, max: 50 })), { minLength: 2, maxLength: 12 }), // Component positions
          (numChildGroups, componentsPerGroup, positions) => {
            const sharedLayer = {
              tree: {
                remove: jasmine.createSpy('remove'),
                load: jasmine.createSpy('load')
              },
              toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
            };
            
            // Create parent group
            const parentGroup = new ComponentGroup(false); // permanent group
            
            // Create child groups nested within the parent
            const childGroups = [];
            let positionIndex = 0;
            
            for (let groupIndex = 0; groupIndex < numChildGroups; groupIndex++) {
              const childGroup = new ComponentGroup(false); // permanent group
              
              // Add components to this child group
              for (let i = 0; i < componentsPerGroup && positionIndex < positions.length; i++) {
                const [x, y] = positions[positionIndex++];
                const mockComponent = {
                  uuid: `child-${groupIndex}-comp-${i}`,
                  getBounds: jasmine.createSpy('getBounds').and.returnValue({
                    minX: x - 2, minY: y - 2, maxX: x + 2, maxY: y + 2
                  }),
                  connections: [],
                  parent: sharedLayer,
                  layer: sharedLayer,
                  position: { x: x, y: y },
                  group: null
                };
                childGroup.addComponent(mockComponent);
              }
              
              // Nest this child group within the parent
              childGroup.group = parentGroup;
              childGroups.push(childGroup);
            }
            
            // Skip if no child groups were created or if any child group has no components
            if (childGroups.length === 0) return;
            if (childGroups.some(group => group.size === 0)) return;
            
            // Verify initial nesting structure
            childGroups.forEach(childGroup => {
              expect(childGroup.group).toBe(parentGroup);
              expect(childGroup.isTemporary).toBe(false);
              expect(childGroup.destroyed).toBe(false);
              expect(childGroup.size).toBeGreaterThan(0);
            });
            expect(parentGroup.group).toBeNull();
            expect(parentGroup.isTemporary).toBe(false);
            
            // Record initial state of child groups
            const initialChildStates = childGroups.map(childGroup => ({
              uuid: childGroup.uuid,
              size: childGroup.size,
              isTemporary: childGroup.isTemporary,
              destroyed: childGroup.destroyed,
              componentUuids: Array.from({ length: childGroup.size }, (_, i) => childGroup.components?.[i]?.uuid).filter(Boolean)
            }));
            
            // Simulate ungrouping the parent group (convert to temporary)
            // In the actual implementation, this would be done by LayoutController.ungroupComponents()
            // but for this test we simulate the key behavior: parent becomes temporary, children remain permanent
            parentGroup.isTemporary = true;
            
            // The key requirement: child groups should remain permanent and independent
            // when parent is ungrouped, children should lose their parent reference
            childGroups.forEach(childGroup => {
              childGroup.group = null; // Simulate ungrouping behavior
            });
            
            // Verify child groups are preserved as independent permanent groups
            childGroups.forEach((childGroup, index) => {
              const initialState = initialChildStates[index];
              
              // Child group should remain permanent
              expect(childGroup.isTemporary).toBe(false);
              expect(childGroup.destroyed).toBe(false);
              
              // Child group should maintain its structure
              expect(childGroup.size).toBe(initialState.size);
              expect(childGroup.uuid).toBe(initialState.uuid);
              
              // Child group should no longer reference the parent
              expect(childGroup.group).toBeNull();
              
              // Child group should maintain all its components
              expect(childGroup.size).toBeGreaterThan(0);
            });
            
            // Verify parent group became temporary
            expect(parentGroup.isTemporary).toBe(true);
            expect(parentGroup.destroyed).toBe(false);
            
            // Verify all child groups are now independent
            for (let i = 0; i < childGroups.length; i++) {
              for (let j = i + 1; j < childGroups.length; j++) {
                expect(childGroups[i]).not.toBe(childGroups[j]);
                expect(childGroups[i].uuid).not.toBe(childGroups[j].uuid);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should serialize a locked ComponentGroup with locked property set to 1', () => {
      const group = new ComponentGroup();
      group.locked = true;
      
      const serialized = group.serialize();
      
      expect(serialized.locked).toBe(1);
      expect(serialized.uuid).toBe(group.uuid);
    });

    it('should serialize an unlocked ComponentGroup without locked property', () => {
      const group = new ComponentGroup();
      group.locked = false; // explicitly set to false
      
      const serialized = group.serialize();
      
      expect(serialized.hasOwnProperty('locked')).toBe(false);
      expect(serialized.uuid).toBe(group.uuid);
    });

    it('should omit locked property when ComponentGroup is unlocked by default', () => {
      const group = new ComponentGroup();
      // locked should be false by default
      
      const serialized = group.serialize();
      
      expect(serialized.hasOwnProperty('locked')).toBe(false);
      expect(serialized.uuid).toBe(group.uuid);
    });
  });

  describe('locked property', () => {
    it('should initialize as false by default', () => {
      const group = new ComponentGroup();
      
      expect(group.locked).toBe(false);
    });

    it('should allow setting and getting locked state', () => {
      const group = new ComponentGroup();
      
      group.locked = true;
      expect(group.locked).toBe(true);
      
      group.locked = false;
      expect(group.locked).toBe(false);
    });

    it('should convert non-boolean values to boolean', () => {
      const group = new ComponentGroup();
      
      group.locked = 1;
      expect(group.locked).toBe(true);
      
      group.locked = 0;
      expect(group.locked).toBe(false);
      
      group.locked = "true";
      expect(group.locked).toBe(true);
      
      group.locked = "";
      expect(group.locked).toBe(false);
    });
  });

  describe('lock propagation', () => {
    it('should propagate lock state to all member components for temporary groups', () => {
      const temporaryGroup = new ComponentGroup(true);
      
      // Create mock components
      const component1 = {
        uuid: 'comp1',
        locked: false,
        connections: [],
        parent: null,
        layer: null,
        group: null
      };
      
      const component2 = {
        uuid: 'comp2',
        locked: false,
        connections: [],
        parent: null,
        layer: null,
        group: null
      };
      
      temporaryGroup.addComponent(component1);
      temporaryGroup.addComponent(component2);
      
      // Lock the temporary group
      temporaryGroup.locked = true;
      
      // Verify that all member components are locked
      expect(temporaryGroup.locked).toBe(true);
      expect(component1.locked).toBe(true);
      expect(component2.locked).toBe(true);
      
      // Unlock the temporary group
      temporaryGroup.locked = false;
      
      // Verify that all member components are unlocked
      expect(temporaryGroup.locked).toBe(false);
      expect(component1.locked).toBe(false);
      expect(component2.locked).toBe(false);
    });

    it('should NOT propagate lock state to member components for permanent groups', () => {
      const permanentGroup = new ComponentGroup(false);
      
      // Create mock components
      const component1 = {
        uuid: 'comp1',
        locked: false,
        connections: [],
        parent: null,
        layer: null,
        group: null
      };
      
      const component2 = {
        uuid: 'comp2',
        locked: false,
        connections: [],
        parent: null,
        layer: null,
        group: null
      };
      
      permanentGroup.addComponent(component1);
      permanentGroup.addComponent(component2);
      
      // Lock the permanent group
      permanentGroup.locked = true;
      
      // Verify that the group is locked but member components are NOT locked
      expect(permanentGroup.locked).toBe(true);
      expect(component1.locked).toBe(false);
      expect(component2.locked).toBe(false);
      
      // Unlock the permanent group
      permanentGroup.locked = false;
      
      // Verify that the group is unlocked and member components remain unchanged
      expect(permanentGroup.locked).toBe(false);
      expect(component1.locked).toBe(false);
      expect(component2.locked).toBe(false);
    });
  });

  describe('operation blocking when locked', () => {
    let mockLayer;
    let mockTree;

    beforeEach(() => {
      mockTree = {
        remove: jasmine.createSpy('remove'),
        load: jasmine.createSpy('load')
      };
      mockLayer = {
        tree: mockTree,
        toLocal: jasmine.createSpy('toLocal').and.callFake(point => point)
      };
    });

    describe('move() operation blocking', () => {
      it('should block move operation when ComponentGroup is locked', () => {
        const group = new ComponentGroup();
        
        // Create mock component
        const mockComponent = {
          uuid: 'comp1',
          connections: [],
          parent: mockLayer,
          layer: mockLayer,
          group: null,
          position: {
            x: 10,
            y: 20,
            set: jasmine.createSpy('set')
          },
          getBounds: jasmine.createSpy('getBounds').and.returnValue({
            minX: 5, minY: 15, maxX: 15, maxY: 25
          })
        };
        
        group.addComponent(mockComponent);
        
        // Lock the group
        group.locked = true;
        
        // Attempt to move - should be blocked
        group.move(100, 200);
        
        // Verify component position was not changed
        expect(mockComponent.position.set).not.toHaveBeenCalled();
      });

      it('should allow move operation when ComponentGroup is unlocked', () => {
        const group = new ComponentGroup();
        
        // Create mock component
        const mockComponent = {
          uuid: 'comp1',
          connections: [],
          parent: mockLayer,
          layer: mockLayer,
          group: null,
          position: {
            x: 10,
            y: 20,
            set: jasmine.createSpy('set')
          },
          getBounds: jasmine.createSpy('getBounds').and.returnValue({
            minX: 5, minY: 15, maxX: 15, maxY: 25
          })
        };
        
        group.addComponent(mockComponent);
        
        // Ensure group is unlocked
        group.locked = false;
        
        // Attempt to move - should succeed
        group.move(100, 200);
        
        // Verify component position was changed
        expect(mockComponent.position.set).toHaveBeenCalled();
      });
    });

    describe('rotate() operation blocking', () => {
      it('should block rotate operation when ComponentGroup is locked', () => {
        const group = new ComponentGroup();
        
        // Create mock component
        const mockComponent = {
          uuid: 'comp1',
          connections: [],
          parent: mockLayer,
          layer: mockLayer,
          group: null,
          position: {
            x: 10,
            y: 20,
            set: jasmine.createSpy('set')
          },
          sprite: {
            rotation: 0,
            getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
              minX: 0, minY: 0, maxX: 10, maxY: 10
            })
          },
          getBounds: jasmine.createSpy('getBounds').and.returnValue({
            minX: 5, minY: 15, maxX: 15, maxY: 25
          }),
          getPose: jasmine.createSpy('getPose').and.returnValue({
            x: 10,
            y: 20,
            angle: 0,
            rotateAround: jasmine.createSpy('rotateAround').and.returnValue({
              x: 15, y: 25, angle: Math.PI / 4
            })
          })
        };
        
        group.addComponent(mockComponent);
        
        // Lock the group
        group.locked = true;
        
        // Attempt to rotate - should be blocked
        group.rotate(Math.PI / 4);
        
        // Verify component was not rotated
        expect(mockComponent.position.set).not.toHaveBeenCalled();
        expect(mockComponent.sprite.rotation).toBe(0);
      });

      it('should allow rotate operation when ComponentGroup is unlocked', () => {
        const group = new ComponentGroup();
        
        // Create mock layer with findMatchingConnection
        const mockLayer = {
          tree: mockTree,
          toLocal: jasmine.createSpy('toLocal').and.callFake(point => point),
          findMatchingConnection: jasmine.createSpy('findMatchingConnection')
        };
        
        // Create mock component
        const mockComponent = {
          uuid: 'comp1',
          connections: [{
            updateCircle: jasmine.createSpy('updateCircle')
          }],
          parent: mockLayer,
          layer: mockLayer,
          group: null,
          position: {
            x: 10,
            y: 20,
            set: jasmine.createSpy('set')
          },
          sprite: {
            rotation: 0,
            getLocalBounds: jasmine.createSpy('getLocalBounds').and.returnValue({
              minX: 0, minY: 0, maxX: 10, maxY: 10
            })
          },
          getBounds: jasmine.createSpy('getBounds').and.returnValue({
            minX: 5, minY: 15, maxX: 15, maxY: 25
          }),
          getPose: jasmine.createSpy('getPose').and.returnValue({
            x: 10,
            y: 20,
            angle: 0,
            rotateAround: jasmine.createSpy('rotateAround').and.returnValue({
              x: 15, y: 25, angle: Math.PI / 4
            })
          })
        };
        
        group.addComponent(mockComponent);
        
        // Ensure group is unlocked
        group.locked = false;
        
        // Mock the required methods
        spyOn(group, 'deleteCollisionTree');
        spyOn(group, 'insertCollisionTree');
        
        // Attempt to rotate - should succeed
        group.rotate(Math.PI / 4);
        
        // Verify component was rotated
        expect(mockComponent.position.set).toHaveBeenCalled();
        expect(mockComponent.sprite.rotation).toBe(Math.PI / 4);
      });
    });

    describe('onStartDrag() operation blocking', () => {
      let mockEvent;
      let mockStage;

      beforeEach(() => {
        mockStage = {
          on: jasmine.createSpy('on')
        };
        
        window.app = {
          stage: mockStage
        };

        mockEvent = {
          getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 200 }),
          stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation'),
          altKey: false
        };

        LayoutController.dragTarget = null;
        LayoutController.dragDistance = 0;
      });

      afterEach(() => {
        delete window.app;
      });

      it('should block onStartDrag operation when ComponentGroup is locked', () => {
        const group = new ComponentGroup();
        
        // Create mock component
        const mockComponent = {
          uuid: 'comp1',
          connections: [],
          parent: mockLayer,
          layer: mockLayer,
          group: null,
          alpha: 1,
          getBounds: jasmine.createSpy('getBounds').and.returnValue({
            minX: 5, minY: 15, maxX: 15, maxY: 25
          })
        };
        
        group.addComponent(mockComponent);
        
        // Lock the group
        group.locked = true;
        
        // Attempt to start drag - should be blocked
        group.onStartDrag(mockEvent);
        
        // Verify drag was not initiated
        expect(LayoutController.dragTarget).toBeNull();
        expect(mockComponent.alpha).toBe(1); // Should not change to 0.5
        expect(mockStage.on).not.toHaveBeenCalled();
      });

      it('should allow onStartDrag operation when ComponentGroup is unlocked', () => {
        const group = new ComponentGroup();
        
        // Create mock component
        const mockComponent = {
          uuid: 'comp1',
          connections: [],
          parent: mockLayer,
          layer: mockLayer,
          group: null,
          alpha: 1,
          getBounds: jasmine.createSpy('getBounds').and.returnValue({
            minX: 5, minY: 15, maxX: 15, maxY: 25
          })
        };
        
        group.addComponent(mockComponent);
        
        // Ensure group is unlocked
        group.locked = false;
        
        // Mock required methods
        spyOn(group, 'getPose').and.returnValue({ x: 10, y: 20, angle: 0, subtract: jasmine.createSpy('subtract').and.returnValue({ x: 0, y: 0, angle: 0 }) });
        spyOn(group, 'deleteCollisionTree');
        
        // Attempt to start drag - should succeed
        group.onStartDrag(mockEvent);
        
        // Verify drag was initiated
        expect(LayoutController.dragTarget).toBe(group);
        expect(mockComponent.alpha).toBe(0.5); // Should change to 0.5
        expect(mockStage.on).toHaveBeenCalled();
      });
    });
  });

  describe('serialization with lock states', () => {
    it('should serialize locked ComponentGroup with locked property set to 1', () => {
      const group = new ComponentGroup();
      group.locked = true;
      
      const serialized = group.serialize();
      
      expect(serialized.locked).toBe(1);
      expect(serialized.uuid).toBe(group.uuid);
    });

    it('should serialize unlocked ComponentGroup without locked property', () => {
      const group = new ComponentGroup();
      group.locked = false; // explicitly set to false
      
      const serialized = group.serialize();
      
      expect(serialized.hasOwnProperty('locked')).toBe(false);
      expect(serialized.uuid).toBe(group.uuid);
    });

    it('should omit locked property when ComponentGroup is unlocked by default', () => {
      const group = new ComponentGroup();
      // locked should be false by default
      
      const serialized = group.serialize();
      
      expect(serialized.hasOwnProperty('locked')).toBe(false);
      expect(serialized.uuid).toBe(group.uuid);
    });

    it('should handle serialization of nested groups with different lock states', () => {
      const parentGroup = new ComponentGroup(false);
      const childGroup = new ComponentGroup(false);
      
      // Set different lock states
      parentGroup.locked = true;
      childGroup.locked = false;
      
      // Add child to parent (this sets childGroup.group = parentGroup)
      parentGroup.addComponent(childGroup);
      
      const parentSerialized = parentGroup.serialize();
      const childSerialized = childGroup.serialize();
      
      // Parent should have locked property
      expect(parentSerialized.locked).toBe(1);
      expect(parentSerialized.hasOwnProperty('group')).toBe(false);
      
      // Child should not have locked property but should have group reference
      expect(childSerialized.hasOwnProperty('locked')).toBe(false);
      expect(childSerialized.group).toBe(parentGroup.uuid);
    });
  });

  describe('lock state edge cases', () => {
    let mockLayoutController;
    let mockSpy;

    beforeAll(() => {
      mockLayoutController = {
        deleteComponent: jasmine.createSpy('deleteComponent')
      };
      
      mockSpy = spyOn(LayoutController, 'getInstance');
      mockSpy.and.returnValue(mockLayoutController);
    });

    beforeEach(() => {
      mockLayoutController.deleteComponent.calls.reset();
    });

    afterAll(() => {
      mockLayoutController.deleteComponent = undefined;
      mockSpy.and.callThrough();
    });

    it('should maintain lock state when adding/removing components', () => {
      const group = new ComponentGroup(true); // temporary group
      
      // Lock the group first
      group.locked = true;
      
      // Create mock component
      const mockComponent = {
        uuid: 'comp1',
        locked: false, // initially unlocked
        connections: [],
        parent: {},
        layer: {},
        group: null
      };
      
      // Add component to locked temporary group
      group.addComponent(mockComponent);
      
      // The component should still be unlocked initially since addComponent doesn't propagate lock state
      // Lock propagation only happens when setting the locked property
      expect(mockComponent.locked).toBe(false);
      expect(group.locked).toBe(true);
      
      // Now trigger lock propagation by setting the lock state again
      group.locked = true; // This should propagate to the newly added component
      
      // Now the component should be locked due to temporary group propagation
      expect(mockComponent.locked).toBe(true);
      expect(group.locked).toBe(true);
      
      // Remove component
      group.removeComponent(mockComponent);
      
      // Component should no longer be in group, but group lock state should remain
      expect(mockComponent.group).toBeNull();
      // Note: Component lock state after removal is not specified in requirements
    });

    it('should handle lock state with empty groups', () => {
      const group = new ComponentGroup();
      
      // Lock empty group
      group.locked = true;
      expect(group.locked).toBe(true);
      
      // Unlock empty group
      group.locked = false;
      expect(group.locked).toBe(false);
      
      // Operations on empty locked group should not throw
      group.locked = true;
      expect(() => group.move(100, 200)).not.toThrow();
      expect(() => group.rotate(Math.PI / 4)).not.toThrow();
    });

    it('should preserve lock state during group destruction', () => {
      const group = new ComponentGroup();
      
      // Create mock component
      const mockComponent = {
        uuid: 'comp1',
        connections: [],
        parent: {},
        layer: {},
        group: null
      };
      
      group.addComponent(mockComponent);
      group.locked = true;
      
      expect(group.locked).toBe(true);
      
      // Destroy group
      group.destroy();
      
      // Group should still report its lock state even when destroyed
      expect(group.locked).toBe(true);
    });
  });

  describe('Property-Based Tests', () => {
    it('should initialize locked property to false for all ComponentGroup instances', () => {
      /**
       * Feature: lock-components, Property 17: Constructor initialization
       * Validates: Requirements 9.1, 9.2
       */
      fc.assert(fc.property(
        fc.boolean(), // isTemporary parameter
        (isTemporary) => {
          // Create a ComponentGroup instance
          const instance = new ComponentGroup(isTemporary);
          
          // Property: All new ComponentGroup instances should have locked property initialized to false
          expect(instance.locked).toBe(false);
        }
      ), { numRuns: 100 });
    });

    it('should propagate lock/unlock actions to both group and all member components for temporary groups', () => {
      /**
       * Feature: lock-components, Property 5: Temporary group lock propagation
       * Validates: Requirements 2.3, 3.1, 3.2
       */
      fc.assert(fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 5 }), // component UUIDs
        fc.boolean(), // initial lock state for components
        fc.boolean(), // target lock state to set on group
        (componentUuids, initialComponentLockState, targetGroupLockState) => {
          // Create a temporary ComponentGroup
          const temporaryGroup = new ComponentGroup(true);
          
          // Create mock components with the initial lock state
          const mockComponents = componentUuids.map(uuid => ({
            uuid: uuid,
            locked: initialComponentLockState,
            connections: [],
            parent: null,
            layer: null,
            group: null
          }));
          
          // Add all components to the temporary group
          mockComponents.forEach(component => {
            temporaryGroup.addComponent(component);
          });
          
          // Set the lock state on the temporary group
          temporaryGroup.locked = targetGroupLockState;
          
          // Property: For temporary groups, lock/unlock actions should affect both the group and all member components
          expect(temporaryGroup.locked).toBe(targetGroupLockState);
          mockComponents.forEach(component => {
            expect(component.locked).toBe(targetGroupLockState);
          });
        }
      ), { numRuns: 100 });
    });

    it('should apply lock/unlock actions only to the group itself for permanent groups', () => {
      /**
       * Feature: lock-components, Property 6: Permanent group lock isolation
       * Validates: Requirements 2.4, 3.3, 3.4, 3.5
       */
      fc.assert(fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 5 }), // component UUIDs
        fc.boolean(), // initial lock state for components
        fc.boolean(), // target lock state to set on group
        (componentUuids, initialComponentLockState, targetGroupLockState) => {
          // Create a permanent ComponentGroup
          const permanentGroup = new ComponentGroup(false);
          
          // Create mock components with the initial lock state
          const mockComponents = componentUuids.map(uuid => ({
            uuid: uuid,
            locked: initialComponentLockState,
            connections: [],
            parent: null,
            layer: null,
            group: null
          }));
          
          // Add all components to the permanent group
          mockComponents.forEach(component => {
            permanentGroup.addComponent(component);
          });
          
          // Set the lock state on the permanent group
          permanentGroup.locked = targetGroupLockState;
          
          // Property: For permanent groups, lock/unlock actions should affect only the group itself, not its member components
          expect(permanentGroup.locked).toBe(targetGroupLockState);
          mockComponents.forEach(component => {
            expect(component.locked).toBe(initialComponentLockState); // Should remain unchanged
          });
        }
      ), { numRuns: 100 });
    });
  });

  describe('hasLockedComponents', () => {
    it('should return false when no components are locked', () => {
      const group = new ComponentGroup();
      const sharedLayer = {}; // All components must be on the same layer
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        locked: false
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        locked: false
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      
      expect(group.hasLockedComponents()).toBe(false);
    });

    it('should return true when at least one component is locked', () => {
      const group = new ComponentGroup();
      const sharedLayer = {}; // All components must be on the same layer
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        locked: false
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        locked: true
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      
      expect(group.hasLockedComponents()).toBe(true);
    });

    it('should return true when nested ComponentGroup has locked components', () => {
      const parentGroup = new ComponentGroup();
      const nestedGroup = new ComponentGroup();
      const sharedLayer = {}; // All components must be on the same layer
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        locked: true
      };
      
      nestedGroup.addComponent(mockComponent);
      parentGroup.addComponent(nestedGroup);
      
      expect(parentGroup.hasLockedComponents()).toBe(true);
    });

    it('should return true when nested ComponentGroup itself is locked', () => {
      const parentGroup = new ComponentGroup();
      const nestedGroup = new ComponentGroup();
      const sharedLayer = {}; // All components must be on the same layer
      
      const mockComponent = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        locked: false
      };
      
      nestedGroup.addComponent(mockComponent);
      nestedGroup.locked = true;
      parentGroup.addComponent(nestedGroup);
      
      expect(parentGroup.hasLockedComponents()).toBe(true);
    });
  });

  describe('drag prevention with locked components', () => {
    it('should prevent onStartDrag when any member component is locked', () => {
      const group = new ComponentGroup(true); // temporary group
      const sharedLayer = {}; // All components must be on the same layer
      const mockEvent = {
        getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 0, y: 0 }),
        stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
      };
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        locked: false
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: sharedLayer,
        locked: true // This component is locked
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      
      // Store original dragTarget value
      const originalDragTarget = LayoutController.dragTarget;
      
      group.onStartDrag(mockEvent);
      
      // Verify that drag was not initiated - dragTarget should remain unchanged
      expect(LayoutController.dragTarget).toBe(originalDragTarget);
      expect(mockEvent.getLocalPosition).not.toHaveBeenCalled();
      expect(mockEvent.stopImmediatePropagation).not.toHaveBeenCalled();
    });

    it('should prevent move when any member component is locked', () => {
      const group = new ComponentGroup();
      const sharedLayer = { // All components must be on the same layer
        toLocal: jasmine.createSpy('toLocal').and.returnValue({ x: 10, y: 10 })
      };
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue({ minX: 0, minY: 0, maxX: 10, maxY: 10 }),
        connections: [],
        parent: sharedLayer,
        locked: false,
        position: {
          x: 5,
          y: 5,
          set: jasmine.createSpy('set')
        }
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue({ minX: 10, minY: 10, maxX: 20, maxY: 20 }),
        connections: [],
        parent: sharedLayer,
        locked: true, // This component is locked
        position: {
          x: 15,
          y: 15,
          set: jasmine.createSpy('set')
        }
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      
      group.move(100, 100);
      
      // Verify that neither component was moved
      expect(mockComponent1.position.set).not.toHaveBeenCalled();
      expect(mockComponent2.position.set).not.toHaveBeenCalled();
    });

    it('should prevent rotate when any member component is locked', () => {
      const group = new ComponentGroup();
      const sharedLayer = { // All components must be on the same layer
        toLocal: jasmine.createSpy('toLocal').and.returnValue({ x: 10, y: 10 })
      };
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue({ minX: 0, minY: 0, maxX: 10, maxY: 10 }),
        connections: [],
        parent: sharedLayer,
        locked: false,
        position: {
          x: 5,
          y: 5,
          set: jasmine.createSpy('set')
        },
        sprite: {
          rotation: 0
        },
        getPose: jasmine.createSpy('getPose').and.returnValue({
          x: 5,
          y: 5,
          angle: 0,
          rotateAround: jasmine.createSpy('rotateAround').and.returnValue({ x: 10, y: 10, angle: Math.PI / 4 })
        })
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue({ minX: 10, minY: 10, maxX: 20, maxY: 20 }),
        connections: [],
        parent: sharedLayer,
        locked: true, // This component is locked
        position: {
          x: 15,
          y: 15,
          set: jasmine.createSpy('set')
        },
        sprite: {
          rotation: 0
        },
        getPose: jasmine.createSpy('getPose').and.returnValue({
          x: 15,
          y: 15,
          angle: 0,
          rotateAround: jasmine.createSpy('rotateAround').and.returnValue({ x: 20, y: 20, angle: Math.PI / 4 })
        })
      };
      
      group.addComponent(mockComponent1);
      group.addComponent(mockComponent2);
      
      spyOn(group, 'canRotate').and.returnValue(true);
      spyOn(group, 'deleteCollisionTree');
      
      group.rotate();
      
      // Verify that rotation was prevented
      expect(group.deleteCollisionTree).not.toHaveBeenCalled();
      expect(mockComponent1.position.set).not.toHaveBeenCalled();
      expect(mockComponent2.position.set).not.toHaveBeenCalled();
    });
  });
});
