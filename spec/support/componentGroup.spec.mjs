import { ComponentGroup } from '../../src/model/componentGroup.js';
import { LayoutController } from '../../src/controller/layoutController.js';
import { Pose } from '../../src/model/pose.js';
import { PolarVector } from '../../src/model/polarVector.js';

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
        parent: mockParent2
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
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
        group: null
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
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
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
        group: null
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
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
      
      // After destroy, size should throw or be unusable
      // since #components is set to null
      expect(() => group.size).toThrow();
    });
  });

  describe('alpha', () => {
    it('should set alpha on all components in the group', () => {
      const group = new ComponentGroup();
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
        alpha: 1
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
        alpha: 1
      };
      const mockComponent3 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
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
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
        tint: 0xffffff
      };
      const mockComponent2 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
        tint: 0xffffff
      };
      const mockComponent3 = {
        getBounds: jasmine.createSpy('getBounds'),
        connections: [],
        parent: {},
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

    it('should remove all components from the collision tree', () => {
      const group = new ComponentGroup();
      
      const mockBounds1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const mockBounds2 = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds1),
        connections: [],
        parent: {},
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
        parent: {},
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
        parent: {},
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

    it('should insert all components into the collision tree', () => {
      const group = new ComponentGroup();
      
      const mockBounds1 = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const mockBounds2 = { minX: 5, minY: 5, maxX: 15, maxY: 15 };
      
      const mockComponent1 = {
        getBounds: jasmine.createSpy('getBounds').and.returnValue(mockBounds1),
        connections: [],
        parent: {},
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
        parent: {},
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
        parent: {},
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
        parent: {},
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
});
