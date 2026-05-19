import { UndoManager, UNDO_BUFFER_SIZE } from '../../src/controller/undoManager.js';
import { Component } from '../../src/model/component.js';
import { LayoutController } from '../../src/controller/layoutController.js';

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

    it('sets group back to temporary for undo-group', () => {
      const mockGroup = { uuid: 'g1', isTemporary: false };
      const mockLayer = {
        findComponentByUuid: jasmine.createSpy('findComponentByUuid').and.returnValue(mockGroup)
      };
      mockController.findLayerByUuid = jasmine.createSpy('findLayerByUuid').and.returnValue(mockLayer);

      undoManager.record({
        type: 'group',
        data: { groupUuid: 'g1', layerUuid: '456' }
      });
      undoManager.undo();
      expect(mockGroup.isTemporary).toBe(true);
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
  });
});
