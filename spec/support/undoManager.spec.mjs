import { UndoManager, UNDO_BUFFER_SIZE } from '../../src/controller/undoManager.js';
import { Component } from '../../src/model/component.js';
import { ComponentGroup } from '../../src/model/componentGroup.js';
import { LayoutController } from '../../src/controller/layoutController.js';
import { LayoutLayer } from '../../src/model/layoutLayer.js';

describe('UndoManager', () => {
  let undoManager;
  let mockController;

  beforeEach(() => {
    LayoutController.selectedComponent = null;
    spyOn(LayoutController, 'selectComponent');
    mockController = {
      readOnly: false,
      layers: [],
      workspace: {
        removeChild: jasmine.createSpy('removeChild'),
        addChildAt: jasmine.createSpy('addChildAt'),
        setChildIndex: jasmine.createSpy('setChildIndex')
      },
      trackData: {
        bundles: [{ assets: [] }]
      },
      findComponentByUuid: jasmine.createSpy('findComponentByUuid'),
      findLayerByUuid: jasmine.createSpy('findLayerByUuid'),
      deleteComponent: jasmine.createSpy('deleteComponent'),
      updateLayerList: jasmine.createSpy('updateLayerList'),
      _positionSelectionToolbar: jasmine.createSpy('_positionSelectionToolbar'),
      _showSelectionToolbar: jasmine.createSpy('_showSelectionToolbar')
    };
    undoManager = new UndoManager(mockController);
  });

  describe('record', () => {
    it('adds an entry to the stack', () => {
      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: '456' } });
      expect(undoManager.length).toBe(1);
    });

    it('evicts oldest entry when buffer exceeds UNDO_BUFFER_SIZE', () => {
      for (let i = 0; i < UNDO_BUFFER_SIZE + 2; i++) {
        undoManager.record({ type: 'add', data: { componentUuid: `id-${i}`, layerUuid: '456' } });
      }
      expect(undoManager.length).toBe(UNDO_BUFFER_SIZE);
    });

    it('is a no-op when readOnly is true', () => {
      mockController.readOnly = true;
      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: '456' } });
      expect(undoManager.length).toBe(0);
    });

    it('is a no-op when suppressed', () => {
      undoManager.suppress();
      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: '456' } });
      expect(undoManager.length).toBe(0);
    });

    it('resumes recording after unsuppress', () => {
      undoManager.suppress();
      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: '456' } });
      undoManager.unsuppress();
      undoManager.record({ type: 'add', data: { componentUuid: '456', layerUuid: '789' } });
      expect(undoManager.length).toBe(1);
    });
  });

  describe('clear', () => {
    it('empties the stack', () => {
      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: '456' } });
      undoManager.record({ type: 'add', data: { componentUuid: '456', layerUuid: '789' } });
      undoManager.clear();
      expect(undoManager.length).toBe(0);
    });
  });

  describe('undo', () => {
    it('is a no-op when stack is empty', () => {
      expect(() => undoManager.undo()).not.toThrow();
    });

    it('does not record new entries during undo execution', () => {
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.returnValue({ uuid: '123' }),
        children: []
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);
      mockController.deleteComponent = jasmine.createSpy('deleteComponent').and.callFake(() => {
        undoManager.record({ type: 'add', data: { componentUuid: 'nested', layerUuid: '456' } });
      });

      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: '456' } });
      undoManager.undo();
      expect(undoManager.length).toBe(0);
    });

    it('calls deleteComponent for undo-add', () => {
      const mockComp = { uuid: '123' };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.returnValue(mockComp)
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: '456' } });
      undoManager.undo();
      expect(mockController.deleteComponent).toHaveBeenCalledWith(mockComp);
    });

    it('calls deleteComponent for undo-duplicate', () => {
      const mockComp = { uuid: '123' };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.returnValue(mockComp)
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({ type: 'duplicate', data: { componentUuid: '123', layerUuid: '456' } });
      undoManager.undo();
      expect(mockController.deleteComponent).toHaveBeenCalledWith(mockComp);
    });

    it('destroys permanent group for undo-duplicate_group', () => {
      const mockGroup = {
        uuid: 'g1',
        isTemporary: false,
        group: null,
        destroyed: false,
        destroy: jasmine.createSpy('destroy').and.callFake(function () { this.destroyed = true; }),
        getAllComponents: () => [mockCompA, mockCompB]
      };
      const mockCompA = { uuid: 'a', group: mockGroup, destroyed: false };
      const mockCompB = { uuid: 'b', group: mockGroup, destroyed: false };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'b') return mockCompB;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'duplicate_group',
        data: { componentUuids: ['a', 'b'], layerUuid: '456' }
      });
      undoManager.undo();
      expect(mockGroup.destroy).toHaveBeenCalledTimes(1);
    });

    it('deletes orphaned components for undo-duplicate_group when temp group was destroyed', () => {
      const mockCompA = { uuid: 'a', group: null, destroyed: false };
      const mockCompB = { uuid: 'b', group: null, destroyed: false };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'b') return mockCompB;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'duplicate_group',
        data: { componentUuids: ['a', 'b'], layerUuid: '456' }
      });
      undoManager.undo();
      expect(mockController.deleteComponent).toHaveBeenCalledWith(mockCompA);
      expect(mockController.deleteComponent).toHaveBeenCalledWith(mockCompB);
    });

    it('destroys temp group and deletes its components for undo-duplicate_group', () => {
      const mockCompA = { uuid: 'a', group: null, destroyed: false };
      const mockCompB = { uuid: 'b', group: null, destroyed: false };
      const mockGroup = {
        uuid: 'g1',
        isTemporary: true,
        group: null,
        destroyed: false,
        destroy: jasmine.createSpy('destroy').and.callFake(function () {
          this.destroyed = true;
          mockCompA.group = null;
          mockCompB.group = null;
        }),
        getAllComponents: () => [mockCompA, mockCompB]
      };
      mockCompA.group = mockGroup;
      mockCompB.group = mockGroup;
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'b') return mockCompB;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'duplicate_group',
        data: { componentUuids: ['a', 'b'], layerUuid: '456' }
      });
      undoManager.undo();
      expect(mockGroup.destroy).toHaveBeenCalledTimes(1);
      expect(mockController.deleteComponent).toHaveBeenCalledWith(mockCompA);
      expect(mockController.deleteComponent).toHaveBeenCalledWith(mockCompB);
    });

    it('deselects group before destroying for undo-duplicate_group', () => {
      const mockGroup = {
        uuid: 'g1',
        isTemporary: false,
        group: null,
        destroyed: false,
        destroy: jasmine.createSpy('destroy').and.callFake(function () { this.destroyed = true; }),
        getAllComponents: () => [mockCompA]
      };
      const mockCompA = { uuid: 'a', group: mockGroup, destroyed: false };
      LayoutController.selectedComponent = mockGroup;
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'duplicate_group',
        data: { componentUuids: ['a'], layerUuid: '456' }
      });
      undoManager.undo();
      expect(LayoutController.selectComponent).toHaveBeenCalledWith(null);
      expect(mockGroup.destroy).toHaveBeenCalled();
    });

    it('traverses to top-level group for undo-duplicate_group with nested groups', () => {
      const outerGroup = {
        uuid: 'outer',
        isTemporary: false,
        group: null,
        destroyed: false,
        destroy: jasmine.createSpy('destroy').and.callFake(function () { this.destroyed = true; }),
        getAllComponents: () => [mockComp]
      };
      const innerGroup = { uuid: 'inner', group: outerGroup };
      const mockComp = { uuid: 'c1', group: innerGroup, destroyed: false };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'c1') return mockComp;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'duplicate_group',
        data: { componentUuids: ['c1'], layerUuid: '456' }
      });
      undoManager.undo();
      expect(outerGroup.destroy).toHaveBeenCalledTimes(1);
    });

    it('restores position for undo-move', () => {
      const mockComp = {
        uuid: '123',
        position: { set: jasmine.createSpy('set') },
        sprite: { rotation: 0 },
        deleteCollisionTree: jasmine.createSpy('deleteCollisionTree'),
        insertCollisionTree: jasmine.createSpy('insertCollisionTree'),
        closeConnections: jasmine.createSpy('closeConnections'),
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
      };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.returnValue(mockComp),
        findMatchingConnection: jasmine.createSpy('findMatchingConnection')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'move',
        data: { componentUuid: '123', layerUuid: '456', previousPose: { x: 10, y: 20, angle: 0.5 } }
      });
      undoManager.undo();
      expect(mockComp.deleteCollisionTree).toHaveBeenCalled();
      expect(mockComp.closeConnections).toHaveBeenCalled();
      expect(mockComp.position.set).toHaveBeenCalledWith(10, 20);
      expect(mockComp.sprite.rotation).toBe(0.5);
      expect(mockComp.insertCollisionTree).toHaveBeenCalled();
    });

    it('restores positions of all components for undo-move_group', () => {
      const mockCompA = {
        uuid: 'a',
        position: { set: jasmine.createSpy('set') },
        sprite: { rotation: 0 },
        deleteCollisionTree: jasmine.createSpy('deleteCollisionTree'),
        insertCollisionTree: jasmine.createSpy('insertCollisionTree'),
        closeConnections: jasmine.createSpy('closeConnections'),
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
      };
      const mockCompB = {
        uuid: 'b',
        position: { set: jasmine.createSpy('set') },
        sprite: { rotation: 0.3 },
        deleteCollisionTree: jasmine.createSpy('deleteCollisionTree'),
        insertCollisionTree: jasmine.createSpy('insertCollisionTree'),
        closeConnections: jasmine.createSpy('closeConnections'),
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
      };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'b') return mockCompB;
          return null;
        }),
        findMatchingConnection: jasmine.createSpy('findMatchingConnection')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'move_group',
        data: {
          layerUuid: '456',
          components: [
            { componentUuid: 'a', previousPose: { x: 10, y: 20, angle: 0 } },
            { componentUuid: 'b', previousPose: { x: 30, y: 40, angle: 0.5 } }
          ]
        }
      });
      undoManager.undo();
      expect(mockCompA.deleteCollisionTree).toHaveBeenCalled();
      expect(mockCompA.closeConnections).toHaveBeenCalled();
      expect(mockCompA.position.set).toHaveBeenCalledWith(10, 20);
      expect(mockCompA.sprite.rotation).toBe(0);
      expect(mockCompA.insertCollisionTree).toHaveBeenCalled();
      expect(mockCompB.position.set).toHaveBeenCalledWith(30, 40);
      expect(mockCompB.sprite.rotation).toBe(0.5);
    });

    it('restores connections after all positions are set for undo-move_group', () => {
      const openConA = { uuid: 'oc-a' };
      const openConB = { uuid: 'oc-b' };
      const mockCompA = {
        uuid: 'a',
        position: { set: jasmine.createSpy('set') },
        sprite: { rotation: 0 },
        deleteCollisionTree: jasmine.createSpy('deleteCollisionTree'),
        insertCollisionTree: jasmine.createSpy('insertCollisionTree'),
        closeConnections: jasmine.createSpy('closeConnections'),
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([openConA])
      };
      const mockCompB = {
        uuid: 'b',
        position: { set: jasmine.createSpy('set') },
        sprite: { rotation: 0 },
        deleteCollisionTree: jasmine.createSpy('deleteCollisionTree'),
        insertCollisionTree: jasmine.createSpy('insertCollisionTree'),
        closeConnections: jasmine.createSpy('closeConnections'),
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([openConB])
      };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'b') return mockCompB;
          return null;
        }),
        findMatchingConnection: jasmine.createSpy('findMatchingConnection')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'move_group',
        data: {
          layerUuid: '456',
          components: [
            { componentUuid: 'a', previousPose: { x: 0, y: 0, angle: 0 } },
            { componentUuid: 'b', previousPose: { x: 5, y: 5, angle: 0 } }
          ]
        }
      });
      undoManager.undo();
      expect(mockLayer.findMatchingConnection).toHaveBeenCalledWith(openConA, true);
      expect(mockLayer.findMatchingConnection).toHaveBeenCalledWith(openConB, true);
    });

    it('restores positions and rotations for undo-rotate_group', () => {
      const mockConnA = { uuid: 'conn-a', updateCircle: jasmine.createSpy('updateCircle') };
      const mockCompA = {
        uuid: 'a',
        position: { set: jasmine.createSpy('set') },
        sprite: { rotation: 0.5 },
        deleteCollisionTree: jasmine.createSpy('deleteCollisionTree'),
        insertCollisionTree: jasmine.createSpy('insertCollisionTree'),
        closeConnections: jasmine.createSpy('closeConnections'),
        connections: new Map([['conn-a', mockConnA]]),
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
      };
      const mockCompB = {
        uuid: 'b',
        position: { set: jasmine.createSpy('set') },
        sprite: { rotation: 1.2 },
        deleteCollisionTree: jasmine.createSpy('deleteCollisionTree'),
        insertCollisionTree: jasmine.createSpy('insertCollisionTree'),
        closeConnections: jasmine.createSpy('closeConnections'),
        connections: new Map(),
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
      };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'b') return mockCompB;
          return null;
        }),
        findMatchingConnection: jasmine.createSpy('findMatchingConnection')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'rotate_group',
        data: {
          layerUuid: '456',
          components: [
            { componentUuid: 'a', previousPose: { x: 10, y: 20, angle: 0 } },
            { componentUuid: 'b', previousPose: { x: 30, y: 40, angle: 0.5 } }
          ]
        }
      });
      undoManager.undo();
      expect(mockCompA.position.set).toHaveBeenCalledWith(10, 20);
      expect(mockCompA.sprite.rotation).toBe(0);
      expect(mockCompB.position.set).toHaveBeenCalledWith(30, 40);
      expect(mockCompB.sprite.rotation).toBe(0.5);
      expect(mockConnA.updateCircle).toHaveBeenCalled();
    });

    it('restores locked state for undo-lock', () => {
      const mockComp = { uuid: '123', locked: true };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.returnValue(mockComp)
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'lock',
        data: { componentUuid: '123', layerUuid: '456', wasLocked: false }
      });
      undoManager.undo();
      expect(mockComp.locked).toBe(false);
    });

    it('restores locked state on a permanent group for undo-lock_perm_group', () => {
      const mockGroup = { uuid: 'g1', locked: true, group: null };
      const mockComp = { uuid: 'c1', group: mockGroup };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'c1') return mockComp;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'lock_perm_group',
        data: { groupUuid: 'g1', layerUuid: '456', memberComponentUuid: 'c1', wasLocked: false }
      });
      undoManager.undo();
      expect(mockGroup.locked).toBe(false);
    });

    it('restores locked state on individual components for undo-lock_temp_group', () => {
      const mockCompA = { uuid: 'a', locked: true };
      const mockCompB = { uuid: 'b', locked: true };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'b') return mockCompB;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'lock_temp_group',
        data: {
          layerUuid: '456',
          members: [
            { type: 'component', componentUuid: 'a', wasLocked: false },
            { type: 'component', componentUuid: 'b', wasLocked: true }
          ]
        }
      });
      undoManager.undo();
      expect(mockCompA.locked).toBe(false);
      expect(mockCompB.locked).toBe(true);
    });

    it('restores locked state on nested permanent group for undo-lock_temp_group', () => {
      const nestedGroup = { uuid: 'ng1', locked: true, group: null };
      const nestedComp = { uuid: 'nc1', group: nestedGroup };
      const mockCompA = { uuid: 'a', locked: true };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'nc1') return nestedComp;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'lock_temp_group',
        data: {
          layerUuid: '456',
          members: [
            { type: 'component', componentUuid: 'a', wasLocked: false },
            { type: 'group', memberComponentUuid: 'nc1', groupUuid: 'ng1', wasLocked: false }
          ]
        }
      });
      undoManager.undo();
      expect(mockCompA.locked).toBe(false);
      expect(nestedGroup.locked).toBe(false);
    });

    it('restores child index for undo-zorder', () => {
      const mockComp = { uuid: '123' };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.returnValue(mockComp),
        children: [mockComp, {}, {}],
        setChildIndex: jasmine.createSpy('setChildIndex')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'zorder',
        data: { componentUuid: '123', layerUuid: '456', previousIndex: 1 }
      });
      undoManager.undo();
      expect(mockLayer.setChildIndex).toHaveBeenCalledWith(mockComp, 1);
    });

    it('restores child indices for all components in undo-zorder_group', () => {
      const mockCompA = { uuid: 'a' };
      const mockCompB = { uuid: 'b' };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'b') return mockCompB;
          return null;
        }),
        children: [{}, {}, mockCompA, mockCompB, {}, {}],
        setChildIndex: jasmine.createSpy('setChildIndex')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'zorder_group',
        data: {
          layerUuid: '456',
          components: [
            { componentUuid: 'a', previousIndex: 1 },
            { componentUuid: 'b', previousIndex: 3 }
          ]
        }
      });
      undoManager.undo();
      expect(mockLayer.setChildIndex).toHaveBeenCalledWith(mockCompA, 1);
      expect(mockLayer.setChildIndex).toHaveBeenCalledWith(mockCompB, 3);
    });

    it('restores group components in ascending index order for undo-zorder_group', () => {
      const mockCompA = { uuid: 'a' };
      const mockCompB = { uuid: 'b' };
      const callOrder = [];
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'b') return mockCompB;
          return null;
        }),
        children: [{}, {}, mockCompA, mockCompB, {}, {}],
        setChildIndex: jasmine.createSpy('setChildIndex').and.callFake((comp, idx) => {
          callOrder.push(comp.uuid);
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'zorder_group',
        data: {
          layerUuid: '456',
          components: [
            { componentUuid: 'b', previousIndex: 5 },
            { componentUuid: 'a', previousIndex: 2 }
          ]
        }
      });
      undoManager.undo();
      expect(callOrder).toEqual(['a', 'b']);
    });

    it('clamps indices to layer bounds for undo-zorder_group', () => {
      const mockComp = { uuid: 'a' };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.returnValue(mockComp),
        children: [mockComp, {}],
        setChildIndex: jasmine.createSpy('setChildIndex')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'zorder_group',
        data: {
          layerUuid: '456',
          components: [{ componentUuid: 'a', previousIndex: 99 }]
        }
      });
      undoManager.undo();
      expect(mockLayer.setChildIndex).toHaveBeenCalledWith(mockComp, 1);
    });

    it('sets group back to temporary for undo-group', () => {
      const mockGroup = { uuid: 'g1', isTemporary: false, group: null };
      const mockComp = { uuid: 'c1', group: mockGroup };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'c1') return mockComp;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'group',
        data: { groupUuid: 'g1', layerUuid: '456', memberComponentUuid: 'c1' }
      });
      undoManager.undo();
      expect(mockGroup.isTemporary).toBe(true);
    });

    it('finds group through nested group chain for undo-group', () => {
      const outerGroup = { uuid: 'outer', isTemporary: false, group: null };
      const innerGroup = { uuid: 'inner', group: outerGroup };
      const mockComp = { uuid: 'c1', group: innerGroup };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'c1') return mockComp;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'group',
        data: { groupUuid: 'outer', layerUuid: '456', memberComponentUuid: 'c1' }
      });
      undoManager.undo();
      expect(outerGroup.isTemporary).toBe(true);
    });

    it('restores group to permanent for undo-ungroup when group still exists', () => {
      const mockGroup = { uuid: 'g1', isTemporary: true, group: null };
      const mockComp = { uuid: 'c1', group: mockGroup };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'c1') return mockComp;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'ungroup',
        data: { groupUuid: 'g1', layerUuid: '456', componentUuids: ['c1', 'c2'] }
      });
      undoManager.undo();
      expect(mockGroup.isTemporary).toBe(false);
    });

    it('recreates group from component UUIDs for undo-ungroup when group was destroyed', () => {
      const mockCompA = { uuid: 'a', group: null, parent: 'layer', connections: new Map() };
      const mockCompB = { uuid: 'b', group: null, parent: 'layer', connections: new Map() };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === 'a') return mockCompA;
          if (uuid === 'b') return mockCompB;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'ungroup',
        data: { groupUuid: 'g1', layerUuid: '456', componentUuids: ['a', 'b'] }
      });
      undoManager.undo();
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selectedGroup = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selectedGroup).toBeInstanceOf(ComponentGroup);
      expect(selectedGroup.isTemporary).toBe(false);
      expect(selectedGroup.components.length).toBe(2);
    });

    it('restores a deleted permanent group with components via undo-delete_group', () => {
      const mockBaseData = { alias: 'straight' };
      const mockComp = {
        uuid: 'c1',
        group: null,
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
      };
      spyOn(Component, 'deserialize').and.returnValue(mockComp);
      const mockLayer = {
        children: [{}, {}],
        addChild: jasmine.createSpy('addChild'),
        setChildIndex: jasmine.createSpy('setChildIndex'),
        findMatchingConnection: jasmine.createSpy('findMatchingConnection'),
        _reconstructGroups: jasmine.createSpy('_reconstructGroups'),
        getGroupLookupMap: jasmine.createSpy('getGroupLookupMap').and.callFake(() => {
          const topGroup = new ComponentGroup(false);
          topGroup.uuid = 'g1';
          topGroup.parent = mockLayer;
          return new Map([['g1', topGroup]]);
        }),
        cleanupGroupDeserialization: jasmine.createSpy('cleanupGroupDeserialization')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);
      mockController.trackData = { bundles: [{ assets: [mockBaseData] }] };

      undoManager.record({
        type: 'delete_group',
        data: {
          layerUuid: 'l1',
          temporary: false,
          parentGroupUuid: null,
          components: [
            { baseDataAlias: 'straight', serialized: { pose: {} }, childIndex: 1 }
          ],
          groups: [{ uuid: 'g1' }]
        }
      });
      undoManager.undo();
      expect(mockLayer._reconstructGroups).toHaveBeenCalledWith([{ uuid: 'g1' }]);
      expect(Component.deserialize).toHaveBeenCalledTimes(1);
      expect(mockLayer.addChild).toHaveBeenCalledWith(mockComp);
      expect(LayoutController.selectComponent).toHaveBeenCalled();
      const selected = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selected).toBeInstanceOf(ComponentGroup);
      expect(selected.isTemporary).toBe(false);
    });

    it('restores a deleted temporary group and marks it temporary via undo-delete_group', () => {
      const mockBaseData = { alias: 'curve' };
      const mockComp = {
        uuid: 'c1',
        group: null,
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
      };
      spyOn(Component, 'deserialize').and.returnValue(mockComp);
      const mockLayer = {
        children: [],
        addChild: jasmine.createSpy('addChild'),
        setChildIndex: jasmine.createSpy('setChildIndex'),
        findMatchingConnection: jasmine.createSpy('findMatchingConnection'),
        _reconstructGroups: jasmine.createSpy('_reconstructGroups'),
        getGroupLookupMap: jasmine.createSpy('getGroupLookupMap').and.callFake(() => {
          const topGroup = new ComponentGroup(false);
          topGroup.uuid = 'g2';
          topGroup.parent = mockLayer;
          return new Map([['g2', topGroup]]);
        }),
        cleanupGroupDeserialization: jasmine.createSpy('cleanupGroupDeserialization')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);
      mockController.trackData = { bundles: [{ assets: [mockBaseData] }] };

      undoManager.record({
        type: 'delete_group',
        data: {
          layerUuid: 'l1',
          temporary: true,
          parentGroupUuid: null,
          components: [
            { baseDataAlias: 'curve', serialized: { pose: {} }, childIndex: 0 }
          ],
          groups: [{ uuid: 'g2' }]
        }
      });
      undoManager.undo();
      const selected = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selected).toBeInstanceOf(ComponentGroup);
      expect(selected.isTemporary).toBe(true);
    });

    it('restores a deleted group with nested groups and multiple components via undo-delete_group', () => {
      const mockBaseData1 = { alias: 'straight' };
      const mockBaseData2 = { alias: 'curve' };
      let deserializeCount = 0;
      const mockComps = [];
      spyOn(Component, 'deserialize').and.callFake(() => {
        const comp = {
          uuid: `c${deserializeCount}`,
          group: null,
          getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
        };
        deserializeCount++;
        mockComps.push(comp);
        return comp;
      });
      const mockLayer = {
        children: [{}, {}, {}],
        addChild: jasmine.createSpy('addChild'),
        setChildIndex: jasmine.createSpy('setChildIndex'),
        findMatchingConnection: jasmine.createSpy('findMatchingConnection'),
        _reconstructGroups: jasmine.createSpy('_reconstructGroups'),
        getGroupLookupMap: jasmine.createSpy('getGroupLookupMap').and.callFake(() => {
          const outerGroup = new ComponentGroup(false);
          outerGroup.uuid = 'outer';
          outerGroup.parent = mockLayer;
          const innerGroup = new ComponentGroup(false);
          innerGroup.uuid = 'inner';
          innerGroup.parent = mockLayer;
          innerGroup.group = outerGroup;
          return new Map([['outer', outerGroup], ['inner', innerGroup]]);
        }),
        cleanupGroupDeserialization: jasmine.createSpy('cleanupGroupDeserialization')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);
      mockController.trackData = { bundles: [{ assets: [mockBaseData1, mockBaseData2] }] };

      undoManager.record({
        type: 'delete_group',
        data: {
          layerUuid: 'l1',
          temporary: false,
          parentGroupUuid: null,
          components: [
            { baseDataAlias: 'straight', serialized: { pose: {}, group: 'outer' }, childIndex: 0 },
            { baseDataAlias: 'curve', serialized: { pose: {}, group: 'inner' }, childIndex: 2 },
            { baseDataAlias: 'straight', serialized: { pose: {}, group: 'inner' }, childIndex: 1 }
          ],
          groups: [
            { uuid: 'outer' },
            { uuid: 'inner', group: 'outer', locked: 1 }
          ]
        }
      });
      undoManager.undo();
      expect(mockLayer._reconstructGroups).toHaveBeenCalledWith([
        { uuid: 'outer' },
        { uuid: 'inner', group: 'outer', locked: 1 }
      ]);
      expect(Component.deserialize).toHaveBeenCalledTimes(3);
      expect(mockLayer.addChild).toHaveBeenCalledTimes(3);
      const selected = LayoutController.selectComponent.calls.mostRecent().args[0];
      expect(selected).toBeInstanceOf(ComponentGroup);
      expect(selected.uuid).toBe('outer');
    });

    it('restores z-ordering when undoing a group delete', () => {
      const mockBaseData = { alias: 'straight' };
      const mockComps = [];
      spyOn(Component, 'deserialize').and.callFake(() => {
        const comp = {
          uuid: `c${mockComps.length}`,
          group: null,
          getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
        };
        mockComps.push(comp);
        return comp;
      });
      const mockLayer = {
        children: [{}, {}, {}, {}, {}],
        addChild: jasmine.createSpy('addChild').and.callFake(() => {
          mockLayer.children.push({});
        }),
        setChildIndex: jasmine.createSpy('setChildIndex'),
        findMatchingConnection: jasmine.createSpy('findMatchingConnection'),
        _reconstructGroups: jasmine.createSpy('_reconstructGroups'),
        getGroupLookupMap: jasmine.createSpy('getGroupLookupMap').and.callFake(() => {
          const group = new ComponentGroup(false);
          group.uuid = 'g1';
          group.parent = mockLayer;
          return new Map([['g1', group]]);
        }),
        cleanupGroupDeserialization: jasmine.createSpy('cleanupGroupDeserialization')
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);
      mockController.trackData = { bundles: [{ assets: [mockBaseData] }] };

      undoManager.record({
        type: 'delete_group',
        data: {
          layerUuid: 'l1',
          temporary: false,
          parentGroupUuid: null,
          components: [
            { baseDataAlias: 'straight', serialized: { pose: {} }, childIndex: 1 },
            { baseDataAlias: 'straight', serialized: { pose: {} }, childIndex: 3 }
          ],
          groups: [{ uuid: 'g1' }]
        }
      });
      undoManager.undo();
      expect(mockLayer.setChildIndex).toHaveBeenCalledWith(mockComps[0], 1);
      expect(mockLayer.setChildIndex).toHaveBeenCalledWith(mockComps[1], 3);
    });

    it('restores layer name and opacity for undo-layer_edit', () => {
      const mockLayer = {
        uuid: 'l1',
        label: 'New Name',
        alpha: 0.5
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'layer_edit',
        data: { layerUuid: 'l1', previousName: 'Old Name', previousOpacity: 1.0 }
      });
      undoManager.undo();
      expect(mockLayer.label).toBe('Old Name');
      expect(mockLayer.alpha).toBe(1.0);
      expect(mockController.updateLayerList).toHaveBeenCalled();
    });

    it('handles undo when layer not found gracefully', () => {
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(null);
      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: 'missing' } });
      expect(() => undoManager.undo()).not.toThrow();
    });

    it('handles undo when component not found gracefully', () => {
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.returnValue(null)
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);
      undoManager.record({ type: 'add', data: { componentUuid: 'missing', layerUuid: '456' } });
      expect(() => undoManager.undo()).not.toThrow();
    });

    it('pops entries in LIFO order', () => {
      const mockComp1 = { uuid: '1' };
      const mockComp2 = { uuid: '2' };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.callFake(uuid => {
          if (uuid === '1') return mockComp1;
          if (uuid === '2') return mockComp2;
          return null;
        })
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({ type: 'add', data: { componentUuid: '1', layerUuid: '456' } });
      undoManager.record({ type: 'add', data: { componentUuid: '2', layerUuid: '456' } });
      undoManager.undo();
      expect(mockController.deleteComponent).toHaveBeenCalledWith(mockComp2);
    });

    it('restores a deleted layer using deserialize and cleanupGroupDeserialization', () => {
      const serializedLayer = {
        name: 'Test Layer',
        visible: false,
        opacity: 75,
        components: [
          { type: 'straight', pose: { x: 0, y: 0, angle: 0 }, connections: [] }
        ],
        groups: [{ uuid: 'g1', components: ['c1', 'c2'] }]
      };

      const mockBaseData = { alias: 'straight' };
      const mockComp = {
        uuid: 'c1',
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
      };

      spyOn(LayoutLayer.prototype, 'deserialize').and.stub();
      spyOn(LayoutLayer.prototype, 'addChild').and.stub();
      spyOn(LayoutLayer.prototype, 'cleanupGroupDeserialization').and.stub();
      spyOn(Component, 'deserialize').and.returnValue(mockComp);

      mockController.trackData = { bundles: [{ assets: [mockBaseData] }] };
      mockController.layers = [{}];

      undoManager.record({
        type: 'layer_delete',
        data: { layerUuid: 'l1', layerIndex: 1, serializedLayer }
      });
      undoManager.undo();

      expect(LayoutLayer.prototype.deserialize).toHaveBeenCalledWith(serializedLayer);
      expect(Component.deserialize).toHaveBeenCalledTimes(1);
      expect(LayoutLayer.prototype.cleanupGroupDeserialization).toHaveBeenCalled();
      expect(mockController.layers.length).toBe(2);
      expect(mockController.updateLayerList).toHaveBeenCalled();
    });
  });

  describe('suppress/unsuppress', () => {
    it('prevents recording when suppressed', () => {
      undoManager.suppress();
      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: '456' } });
      undoManager.record({ type: 'add', data: { componentUuid: '456', layerUuid: '789' } });
      undoManager.unsuppress();
      expect(undoManager.length).toBe(0);
    });

    it('supports nested suppression', () => {
      undoManager.suppress();
      undoManager.suppress();
      undoManager.unsuppress();
      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: '456' } });
      expect(undoManager.length).toBe(0);
      undoManager.unsuppress();
      undoManager.record({ type: 'add', data: { componentUuid: '456', layerUuid: '789' } });
      expect(undoManager.length).toBe(1);
    });

    it('does not go below zero depth on extra unsuppress calls', () => {
      undoManager.unsuppress();
      undoManager.record({ type: 'add', data: { componentUuid: '123', layerUuid: '456' } });
      expect(undoManager.length).toBe(1);
    });
  });

  describe('component UUID update after recreate', () => {
    let components;
    let mockLayer;
    let deserializeCount;

    beforeEach(() => {
      components = new Map();
      deserializeCount = 0;

      spyOn(Component, 'deserialize').and.callFake(() => {
        deserializeCount++;
        const newUuid = `restored-${deserializeCount}`;
        const newComp = makeMockComp(newUuid);
        components.set(newUuid, newComp);
        return newComp;
      });

      mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid')
          .and.callFake(uuid => components.get(uuid) || null),
        addChild: jasmine.createSpy('addChild'),
        children: [{}, {}],
        setChildIndex: jasmine.createSpy('setChildIndex'),
        findMatchingConnection: jasmine.createSpy('findMatchingConnection')
      };

      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid')
        .and.returnValue(mockLayer);
    });

    function makeMockComp(uuid) {
      return {
        uuid,
        baseData: { alias: 'test-track' },
        destroy: jasmine.createSpy('destroy').and.callFake(() => {
          components.delete(uuid);
        }),
        getOpenConnections: jasmine.createSpy('getOpenConnections').and.returnValue([])
      };
    }

    it('updates remaining stack entries when undo-rotate recreates a component', () => {
      const comp = makeMockComp('orig');
      components.set('orig', comp);

      undoManager.record({
        type: 'rotate',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousPose: { x: 0, y: 0, angle: 0 },
          previousState: { pose: {} }, childIndex: 0
        }
      });
      undoManager.record({
        type: 'rotate',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousPose: { x: 0, y: 0, angle: 0.5 },
          previousState: { pose: {} }, childIndex: 0
        }
      });

      undoManager.undo();
      expect(Component.deserialize).toHaveBeenCalledTimes(1);

      undoManager.undo();
      expect(Component.deserialize).toHaveBeenCalledTimes(2);
      expect(undoManager.length).toBe(0);
    });

    it('updates remaining stack entries when undo-edit recreates a component', () => {
      const comp = makeMockComp('orig');
      components.set('orig', comp);

      undoManager.record({
        type: 'edit',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousState: { pose: {} }, childIndex: 0
        }
      });
      undoManager.record({
        type: 'edit',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousState: { pose: {} }, childIndex: 0
        }
      });

      undoManager.undo();
      expect(Component.deserialize).toHaveBeenCalledTimes(1);

      undoManager.undo();
      expect(Component.deserialize).toHaveBeenCalledTimes(2);
      expect(undoManager.length).toBe(0);
    });

    it('does not update UUIDs when undo-rotate uses the simple pose path', () => {
      const comp = makeMockComp('orig');
      comp.position = { set: jasmine.createSpy('set') };
      comp.sprite = { rotation: 0 };
      comp.deleteCollisionTree = jasmine.createSpy('deleteCollisionTree');
      comp.insertCollisionTree = jasmine.createSpy('insertCollisionTree');
      comp.closeConnections = jasmine.createSpy('closeConnections');
      comp.connections = [];
      components.set('orig', comp);

      undoManager.record({
        type: 'rotate',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousPose: { x: 0, y: 0, angle: 0 },
          previousState: null, childIndex: -1
        }
      });
      undoManager.record({
        type: 'rotate',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousPose: { x: 1, y: 2, angle: 0.5 },
          previousState: null, childIndex: -1
        }
      });

      undoManager.undo();
      expect(Component.deserialize).not.toHaveBeenCalled();

      undoManager.undo();
      expect(Component.deserialize).not.toHaveBeenCalled();
      expect(undoManager.length).toBe(0);
    });

    it('updates UUIDs across mixed entry types for the same component', () => {
      const comp = makeMockComp('orig');
      components.set('orig', comp);

      undoManager.record({
        type: 'rotate',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousPose: { x: 0, y: 0, angle: 0 },
          previousState: { pose: {} }, childIndex: 0
        }
      });
      undoManager.record({
        type: 'edit',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousState: { pose: {} }, childIndex: 0
        }
      });

      undoManager.undo();
      expect(Component.deserialize).toHaveBeenCalledTimes(1);

      undoManager.undo();
      expect(Component.deserialize).toHaveBeenCalledTimes(2);
      expect(undoManager.length).toBe(0);
    });

    it('consecutive rotations with 1 connection can be undone 3 times', () => {
      const comp = makeMockComp('orig');
      components.set('orig', comp);

      undoManager.record({
        type: 'rotate',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousPose: { x: 0, y: 0, angle: 0 },
          previousState: { pose: {} }, childIndex: 0
        }
      });
      undoManager.record({
        type: 'rotate',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousPose: { x: 5, y: 10, angle: 0.5 },
          previousState: { pose: {} }, childIndex: 0
        }
      });
      undoManager.record({
        type: 'rotate',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousPose: { x: 10, y: 20, angle: 1.0 },
          previousState: { pose: {} }, childIndex: 0
        }
      });

      expect(undoManager.length).toBe(3);

      undoManager.undo();
      expect(Component.deserialize).toHaveBeenCalledTimes(1);
      expect(undoManager.length).toBe(2);

      undoManager.undo();
      expect(Component.deserialize).toHaveBeenCalledTimes(2);
      expect(undoManager.length).toBe(1);

      undoManager.undo();
      expect(Component.deserialize).toHaveBeenCalledTimes(3);
      expect(undoManager.length).toBe(0);
    });

    it('updates componentUuid inside move_group entries when a component is recreated', () => {
      const comp = makeMockComp('orig');
      comp.position = { set: jasmine.createSpy('set') };
      comp.sprite = { rotation: 0 };
      comp.deleteCollisionTree = jasmine.createSpy('deleteCollisionTree');
      comp.insertCollisionTree = jasmine.createSpy('insertCollisionTree');
      comp.closeConnections = jasmine.createSpy('closeConnections');
      components.set('orig', comp);

      undoManager.record({
        type: 'move_group',
        data: {
          layerUuid: 'l1',
          components: [
            { componentUuid: 'orig', previousPose: { x: 0, y: 0, angle: 0 } }
          ]
        }
      });
      undoManager.record({
        type: 'edit',
        data: {
          componentUuid: 'orig', layerUuid: 'l1',
          previousState: { pose: {} }, childIndex: 0
        }
      });

      undoManager.undo();
      expect(Component.deserialize).toHaveBeenCalledTimes(1);

      const restoredComp = components.get('restored-1');
      restoredComp.position = { set: jasmine.createSpy('set') };
      restoredComp.sprite = { rotation: 0 };
      restoredComp.deleteCollisionTree = jasmine.createSpy('deleteCollisionTree');
      restoredComp.insertCollisionTree = jasmine.createSpy('insertCollisionTree');
      restoredComp.closeConnections = jasmine.createSpy('closeConnections');

      undoManager.undo();
      expect(restoredComp.position.set).toHaveBeenCalledWith(0, 0);
    });
  });
});
