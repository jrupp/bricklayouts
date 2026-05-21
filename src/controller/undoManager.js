import { Component } from '../model/component.js';
import { ComponentGroup } from '../model/componentGroup.js';
import { Connection } from '../model/connection.js';
import { LayoutController } from './layoutController.js';
import { LayoutLayer } from '../model/layoutLayer.js';

/**
 * Maximum number of undo entries to retain. Older entries are discarded.
 * @type {Number}
 */
export let UNDO_BUFFER_SIZE = 3;

/**
 * @typedef {Object} UndoEntry
 * @property {String} type
 * @property {Object} data
 */

/**
 * Manages undo operations for layout editing.
 * The controller records undo entries describing inverse operations for each user action, and executes them when requested.
 */
export class UndoManager {
  /** @type {Array<UndoEntry>} */
  #stack = [];

  /** @type {LayoutController} */
  #controller;

  #isUndoing = false;
  #suppressDepth = 0;

  /**
   * @param {LayoutController} controller
   */
  constructor(controller) {
    this.#controller = controller;
  }

  /**
   * Record an undo entry. No-op when readOnly, during undo execution, or while suppressed.
   * @param {UndoEntry} entry
   */
  record(entry) {
    if (this.#controller.readOnly || this.#isUndoing || this.#suppressDepth > 0) return;
    this.#stack.push(entry);
    if (this.#stack.length > UNDO_BUFFER_SIZE) {
      this.#stack.shift();
    }
  }

  /**
   * Pop the most recent entry and execute its inverse operation.
   */
  undo() {
    if (this.#stack.length === 0) return;
    const entry = this.#stack.pop();
    this.#isUndoing = true;
    try {
      this.#execute(entry);
    } finally {
      this.#isUndoing = false;
    }
  }

  /**
   * Remove all entries from the undo stack.
   */
  clear() {
    this.#stack = [];
  }

  /**
   * Increment the suppression depth. While depth > 0, record() is a no-op.
   * Calls must be balanced with {@link unsuppress}.
   */
  suppress() {
    this.#suppressDepth++;
  }

  /**
   * Decrement the suppression depth. Recording resumes when depth reaches 0.
   */
  unsuppress() {
    if (this.#suppressDepth > 0) {
      this.#suppressDepth--;
    }
  }

  /**
   * @returns {Number} The number of entries in the undo stack.
   */
  get length() {
    return this.#stack.length;
  }

  /**
   * Dispatch an undo entry to the appropriate handler.
   * @param {UndoEntry} entry
   */
  #execute(entry) {
    switch (entry.type) {
      case 'add':
      case 'duplicate':
        this.#undoAdd(entry.data);
        break;
      case 'duplicate_group':
        this.#undoDuplicateGroup(entry.data);
        break;
      case 'delete':
        this.#undoDelete(entry.data);
        break;
      case 'delete_group':
        this.#undoDeleteGroup(entry.data);
        break;
      case 'move':
        this.#undoMove(entry.data);
        break;
      case 'move_group':
        this.#undoMoveGroup(entry.data);
        break;
      case 'rotate':
        this.#undoRotate(entry.data);
        break;
      case 'rotate_group':
        this.#undoRotateGroup(entry.data);
        break;
      case 'edit':
        this.#undoEdit(entry.data);
        break;
      case 'lock':
        this.#undoLock(entry.data);
        break;
      case 'lock_perm_group':
        this.#undoLockPermGroup(entry.data);
        break;
      case 'lock_temp_group':
        this.#undoLockTempGroup(entry.data);
        break;
      case 'zorder':
        this.#undoZOrder(entry.data);
        break;
      case 'zorder_group':
        this.#undoZOrderGroup(entry.data);
        break;
      case 'group':
        this.#undoGroup(entry.data);
        break;
      case 'ungroup':
        this.#undoUngroup(entry.data);
        break;
      case 'layer_add':
        this.#undoLayerAdd(entry.data);
        break;
      case 'layer_delete':
        this.#undoLayerDelete(entry.data);
        break;
      case 'layer_edit':
        this.#undoLayerEdit(entry.data);
        break;
      case 'layer_reorder':
        this.#undoLayerReorder(entry.data);
        break;
    }
  }

  /**
   * @param {{componentUuid: String, layerUuid: String}} data
   */
  #undoAdd(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const comp = layer.findComponentByUuid(data.componentUuid);
    if (!comp) return;
    if (LayoutController.selectedComponent === comp) {
      let nextComp = LayoutController.selectedComponent.getAdjacentComponent();
      LayoutController.selectComponent(nextComp);
    }
    this.#controller.deleteComponent(comp);
  }

  /**
   * @param {{componentUuids: Array<String>, layerUuid: String}} data
   */
  #undoDuplicateGroup(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const destroyedGroups = new Set();
    const componentsToDelete = [];
    for (const uuid of data.componentUuids) {
      const comp = layer.findComponentByUuid(uuid);
      if (!comp || comp.destroyed) continue;
      let topGroup = null;
      let current = comp.group;
      while (current) {
        topGroup = current;
        current = current.group;
      }
      if (topGroup && !destroyedGroups.has(topGroup.uuid)) {
        destroyedGroups.add(topGroup.uuid);
        if (!topGroup.isTemporary) {
          if (LayoutController.selectedComponent === topGroup) {
            LayoutController.selectComponent(null);
          }
          topGroup.destroy();
        } else {
          const groupComps = topGroup.getAllComponents();
          if (LayoutController.selectedComponent === topGroup) {
            LayoutController.selectComponent(null);
          }
          if (!topGroup.destroyed) {
            topGroup.destroy();
          }
          componentsToDelete.push(...groupComps);
        }
      } else if (!topGroup) {
        componentsToDelete.push(comp);
      }
    }
    for (const comp of componentsToDelete) {
      if (comp.destroyed) continue;
      if (LayoutController.selectedComponent === comp) {
        LayoutController.selectComponent(null);
      }
      this.#controller.deleteComponent(comp);
    }
  }

  /**
   * @param {{baseDataAlias: String, serialized: Object, childIndex: Number, layerUuid: String}} data
   */
  #undoDelete(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const baseData = this.#controller.trackData.bundles[0].assets.find(
      a => a.alias === data.baseDataAlias
    );
    if (!baseData) return;
    const comp = Component.deserialize(baseData, data.serialized, layer);
    if (!comp) return;
    const index = Math.min(data.childIndex, layer.children.length - 1);
    layer.addChild(comp);
    if (index >= 0 && index < layer.children.length - 1) {
      layer.setChildIndex(comp, index);
    }
    const openConnections = comp.getOpenConnections();
    openConnections.forEach((openCon) => {
      layer.findMatchingConnection(openCon, true);
    });
  }

  #undoDeleteGroup(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    layer._reconstructGroups(data.groups);
    for (const entry of data.components) {
      for (const conn of entry.serialized.connections || []) {
        Connection.connectionDB.delete(conn.uuid);
      }
    }
    const restored = [];
    for (const entry of data.components) {
      const baseData = this.#controller.trackData.bundles[0].assets.find(
        a => a.alias === entry.baseDataAlias
      );
      if (!baseData) continue;
      const comp = Component.deserialize(baseData, entry.serialized, layer);
      if (!comp) continue;
      layer.addChild(comp);
      restored.push({ comp, childIndex: entry.childIndex });
    }
    restored.sort((a, b) => a.childIndex - b.childIndex);
    for (const { comp, childIndex } of restored) {
      const index = Math.min(childIndex, layer.children.length - 1);
      if (index >= 0 && index < layer.children.length - 1) {
        layer.setChildIndex(comp, index);
      }
    }
    for (const { comp } of restored) {
      const openConnections = comp.getOpenConnections();
      openConnections.forEach((openCon) => {
        layer.findMatchingConnection(openCon, true);
      });
    }
    const groupMap = layer.getGroupLookupMap();
    if (!groupMap) return;
    const topGroupUuid = data.groups[0]?.uuid;
    const topGroup = groupMap.get(topGroupUuid);
    layer.cleanupGroupDeserialization();
    if (!topGroup) return;
    if (data.temporary) {
      topGroup.isTemporary = true;
    }
    LayoutController.selectComponent(topGroup);
  }

  /**
   * @param {{componentUuid: String, layerUuid: String, previousPose: {x: Number, y: Number, angle: Number}}} data
   */
  #undoMove(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const comp = layer.findComponentByUuid(data.componentUuid);
    if (!comp) return;
    comp.deleteCollisionTree();
    comp.closeConnections();
    comp.position.set(data.previousPose.x, data.previousPose.y);
    comp.sprite.rotation = data.previousPose.angle;
    comp.insertCollisionTree();
    const openConnections = comp.getOpenConnections();
    openConnections.forEach((openCon) => {
      layer.findMatchingConnection(openCon, true);
    });
    if (LayoutController.selectedComponent === comp) {
      this.#controller._positionSelectionToolbar();
    }
  }

  /**
   * @param {{layerUuid: String, components: Array<{componentUuid: String, previousPose: {x: Number, y: Number, angle: Number}}>}} data
   */
  #undoMoveGroup(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const allOpenConnections = [];
    for (const entry of data.components) {
      const comp = layer.findComponentByUuid(entry.componentUuid);
      if (!comp) continue;
      comp.deleteCollisionTree();
      comp.closeConnections();
      comp.position.set(entry.previousPose.x, entry.previousPose.y);
      comp.sprite.rotation = entry.previousPose.angle;
      comp.insertCollisionTree();
      allOpenConnections.push(...comp.getOpenConnections());
    }
    for (const openCon of allOpenConnections) {
      layer.findMatchingConnection(openCon, true);
    }
    allOpenConnections.length = 0;
    this.#controller._positionSelectionToolbar();
  }

  /**
   * @param {{componentUuid: String, layerUuid: String, previousPose: {x: Number, y: Number, angle: Number}, previousState: ?Object, childIndex: Number}} data
   */
  #undoRotate(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const comp = layer.findComponentByUuid(data.componentUuid);
    if (!comp) return;
    if (data.previousState) {
      const baseData = comp.baseData;
      const childIndex = data.childIndex;
      const wasSelected = LayoutController.selectedComponent === comp;
      if (wasSelected) {
        LayoutController.selectComponent(null);
      }
      comp.destroy();
      const restored = Component.deserialize(baseData, data.previousState, layer);
      if (!restored) return;
      layer.addChild(restored);
      if (childIndex >= 0 && childIndex < layer.children.length - 1) {
        layer.setChildIndex(restored, childIndex);
      }
      const openConnections = restored.getOpenConnections();
      openConnections.forEach((openCon) => {
        layer.findMatchingConnection(openCon, true);
      });
      this.#updateComponentUuid(data.componentUuid, restored.uuid);
      if (wasSelected) {
        LayoutController.selectComponent(restored);
      }
    } else {
      comp.deleteCollisionTree();
      comp.closeConnections();
      comp.position.set(data.previousPose.x, data.previousPose.y);
      comp.sprite.rotation = data.previousPose.angle;
      comp.insertCollisionTree();
      comp.connections.forEach((connection) => {
        connection.updateCircle();
        if (!connection.otherConnection) {
          layer.findMatchingConnection(connection, true);
        }
      });
      if (LayoutController.selectedComponent === comp) {
        this.#controller._positionSelectionToolbar();
      }
    }
  }

  /**
   * @param {{layerUuid: String, components: Array<{componentUuid: String, previousPose: {x: Number, y: Number, angle: Number}}>}} data
   */
  #undoRotateGroup(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const allOpenConnections = [];
    for (const entry of data.components) {
      const comp = layer.findComponentByUuid(entry.componentUuid);
      if (!comp) continue;
      comp.deleteCollisionTree();
      comp.closeConnections();
      comp.position.set(entry.previousPose.x, entry.previousPose.y);
      comp.sprite.rotation = entry.previousPose.angle;
      comp.insertCollisionTree();
      comp.connections.forEach((connection) => {
        connection.updateCircle();
        if (!connection.otherConnection) {
          layer.findMatchingConnection(connection, true);
        }
      });
      allOpenConnections.push(...comp.getOpenConnections());
    }
    for (const openCon of allOpenConnections) {
      layer.findMatchingConnection(openCon, true);
    }
    this.#controller._positionSelectionToolbar();
  }

  /**
   * @param {{componentUuid: String, layerUuid: String, previousState: Object, childIndex: Number}} data
   */
  #undoEdit(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const comp = layer.findComponentByUuid(data.componentUuid);
    if (!comp) return;
    const baseData = comp.baseData;
    const childIndex = layer.children.indexOf(comp);
    const wasSelected = LayoutController.selectedComponent === comp;
    if (wasSelected) {
      LayoutController.selectComponent(null);
    }
    comp.destroy();
    const restored = Component.deserialize(baseData, data.previousState, layer);
    if (!restored) return;
    layer.addChild(restored);
    if (childIndex >= 0 && childIndex < layer.children.length - 1) {
      layer.setChildIndex(restored, childIndex);
    }
    const openConnections = restored.getOpenConnections();
    openConnections.forEach((openCon) => {
      layer.findMatchingConnection(openCon, true);
    });
    this.#updateComponentUuid(data.componentUuid, restored.uuid);
    if (wasSelected) {
      LayoutController.selectComponent(restored);
    }
  }

  /**
   * @param {{componentUuid: String, layerUuid: String, wasLocked: Boolean}} data
   */
  #undoLock(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const comp = layer.findComponentByUuid(data.componentUuid);
    if (!comp) return;
    comp.locked = data.wasLocked;
    if (LayoutController.selectedComponent === comp) {
      this.#controller._showSelectionToolbar();
      this.#controller._positionSelectionToolbar();
    }
  }

  /**
   * @param {{groupUuid: String, memberComponentUuid: String, layerUuid: String, wasLocked: Boolean}} data
   */
  #undoLockPermGroup(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const group = this.#findGroupByUuid(layer, data.memberComponentUuid, data.groupUuid);
    if (!group) return;
    group.locked = data.wasLocked;
    if (LayoutController.selectedComponent === group) {
      this.#controller._showSelectionToolbar();
      this.#controller._positionSelectionToolbar();
    }
  }

  /**
   * @param {{layerUuid: String, members: Array<{type: String, componentUuid: ?String, memberComponentUuid: ?String, groupUuid: ?String, wasLocked: Boolean}>}} data
   */
  #undoLockTempGroup(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    for (const member of data.members) {
      if (member.type === 'group') {
        const group = this.#findGroupByUuid(layer, member.memberComponentUuid, member.groupUuid);
        if (group) group.locked = member.wasLocked;
      } else {
        const comp = layer.findComponentByUuid(member.componentUuid);
        if (comp) comp.locked = member.wasLocked;
      }
    }
  }

  /**
   * @param {{componentUuid: String, layerUuid: String, previousIndex: Number}} data
   */
  #undoZOrder(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const comp = layer.findComponentByUuid(data.componentUuid);
    if (!comp) return;
    const index = Math.min(data.previousIndex, layer.children.length - 1);
    layer.setChildIndex(comp, Math.max(0, index));
  }

  /**
   * @param {{layerUuid: String, components: Array<{componentUuid: String, previousIndex: Number}>}} data
   */
  #undoZOrderGroup(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const sorted = [...data.components].sort((a, b) => a.previousIndex - b.previousIndex);
    for (const entry of sorted) {
      const comp = layer.findComponentByUuid(entry.componentUuid);
      if (!comp) continue;
      const index = Math.min(entry.previousIndex, layer.children.length - 1);
      layer.setChildIndex(comp, Math.max(0, index));
    }
  }

  /**
   * @param {{groupUuid: String, memberComponentUuid: String, layerUuid: String}} data
   */
  #undoGroup(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const group = this.#findGroupByUuid(layer, data.memberComponentUuid, data.groupUuid);
    if (!group) return;
    group.isTemporary = true;
    if (LayoutController.selectedComponent === group) {
      this.#controller._showSelectionToolbar();
    } else {
      LayoutController.selectComponent(group);
    }
  }

  /**
   * @param {{groupUuid: String, componentUuids: Array<String>, layerUuid: String}} data
   */
  #undoUngroup(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const existing = this.#findGroupByUuid(layer, data.componentUuids[0], data.groupUuid);
    if (existing) {
      existing.isTemporary = false;
      if (LayoutController.selectedComponent === existing) {
        this.#controller._showSelectionToolbar();
      }
      return;
    }
    LayoutController.selectComponent(null);
    const newGroup = new ComponentGroup(false);
    for (const uuid of data.componentUuids) {
      const comp = layer.findComponentByUuid(uuid);
      if (!comp) continue;
      if (comp.group) {
        if (!comp.group.group) {
          newGroup.addComponent(comp.group);
        }
      } else {
        newGroup.addComponent(comp);
      }
    }
    if (newGroup.components.length > 0) {
      LayoutController.selectComponent(newGroup);
    }
  }

  /**
   * @param {{layerUuid: String}} data
   */
  #undoLayerAdd(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    const index = this.#controller.layers.indexOf(layer);
    if (index === -1) return;
    if (this.#controller.layers.length <= 1) return;
    this.#controller.layers.splice(index, 1);
    if (this.#controller.currentLayer === layer) {
      this.#controller.currentLayer = this.#controller.layers[0];
    }
    if (LayoutController.selectedComponent && LayoutController.selectedComponent.layer === layer) {
      LayoutController.selectComponent(null);
    }
    this.#controller.workspace.removeChild(layer);
    layer.destroy();
    this.#controller.updateLayerList();
  }

  /**
   * @param {{layerUuid: String, layerIndex: Number, serializedLayer: Object}} data
   */
  #undoLayerDelete(data) {
    Connection.connectionDB.clear();
    const layer = new LayoutLayer();
    layer.uuid = data.layerUuid;
    layer.deserialize(data.serializedLayer);
    const index = Math.min(data.layerIndex, this.#controller.layers.length);
    this.#controller.layers.splice(index, 0, layer);
    this.#controller.workspace.addChildAt(layer, index);
    if (data.serializedLayer.components) {
      for (const compData of data.serializedLayer.components) {
        const baseData = this.#controller.trackData.bundles[0].assets.find(
          a => a.alias === compData.type
        );
        if (!baseData) continue;
        const comp = Component.deserialize(baseData, compData, layer);
        if (comp) {
          layer.addChild(comp);
        }
      }
      layer.cleanupGroupDeserialization();
      for (const child of layer.children) {
        if (child instanceof Component) {
          const openConnections = child.getOpenConnections();
          openConnections.forEach((openCon) => {
            layer.findMatchingConnection(openCon, true);
          });
        }
      }
    }
    this.#controller.updateLayerList();
  }

  /**
   * @param {{layerUuid: String, previousName: String, previousOpacity: Number}} data
   */
  #undoLayerEdit(data) {
    const layer = this.#controller.findLayerByUuid(data.layerUuid);
    if (!layer) return;
    layer.label = data.previousName;
    layer.alpha = data.previousOpacity;
    this.#controller.updateLayerList();
  }

  /**
   * @param {{previousOrder: Array<String>}} data
   */
  #undoLayerReorder(data) {
    const currentOrder = this.#controller.layers.map(l => l.uuid);
    if (data.previousOrder.length !== currentOrder.length) return;
    const reordered = data.previousOrder.map(uuid =>
      this.#controller.layers.find(l => l.uuid === uuid)
    ).filter(Boolean);
    if (reordered.length !== this.#controller.layers.length) return;
    this.#controller.layers.splice(0, this.#controller.layers.length, ...reordered);
    reordered.forEach((layer, i) => {
      this.#controller.workspace.setChildIndex(layer, i);
    });
    this.#controller.updateLayerList();
  }

  /**
   * Locate a ComponentGroup by traversing upward from a known component.
   * @param {LayoutLayer} layer
   * @param {String} componentUuid - UUID of a leaf Component inside the group
   * @param {String} groupUuid - UUID of the target group
   * @returns {?ComponentGroup}
   */
  #findGroupByUuid(layer, componentUuid, groupUuid) {
    const comp = layer.findComponentByUuid(componentUuid);
    if (!comp) return null;
    let current = comp.group;
    while (current) {
      if (current.uuid === groupUuid) return current;
      current = current.group;
    }
    return null;
  }

  /**
   * Update remaining stack entries when a component is recreated with a new UUID.
   * @param {String} oldUuid
   * @param {String} newUuid
   */
  #updateComponentUuid(oldUuid, newUuid) {
    if (oldUuid === newUuid) return;
    for (const entry of this.#stack) {
      if (entry.data.componentUuid === oldUuid) {
        entry.data.componentUuid = newUuid;
      }
      if (entry.data.components) {
        for (const compEntry of entry.data.components) {
          if (compEntry.componentUuid === oldUuid) {
            compEntry.componentUuid = newUuid;
          }
        }
      }
    }
  }
}

