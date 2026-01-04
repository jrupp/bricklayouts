import { LayoutController } from "../controller/layoutController.js";
import { Bounds, Point } from "../pixi.mjs";
import { Component } from "./component.js";
import { Connection } from "./connection.js";
import { PolarVector } from "./polarVector.js";
import { Pose } from "./pose.js";

/**
 * Class representing a group of components.
 * 
 * The way this will work is that each component will have a pointer to the group it is in, and the
 * group will have a list of components that are in it. When a component is added/removed from a
 * group, the components will need to updated to keep everything in sync.
 *
 * When certain methods are called on a component, they will check if they are in a group and if
 * so, delegate the method call to the group instead. For example, when rotating a component, if it
 * is in a group, the group will handle the rotation of all components in the group.
 */
export class ComponentGroup {
  /** @type {Array<Component>} */
  #components = [];

  /**
   * Connections, anywhere in the group
   * @type {Map<String, Connection>}
   */
  connections;

  /** @type {Boolean} */
  destroyed = false;

  /** @type {Boolean} */
  #isDragging = false;

  /** @type {*} */
  parent;

  /** @type {Boolean} */
  #temporary = false;

  /**
   * @type {Boolean}
   * Whether this component group is locked to prevent editing operations.
   */
  #locked;

  /**
     * Unique identifier for this ComponentGroup
     * @type {String}
     */
  #uuid;

  /**
   * Reference to parent ComponentGroup if this group is nested
   * @type {ComponentGroup|null}
   */
  group = null;

  /**
   * @type {Pose}
   * The offset position from the mouse to this Group's position when dragging.
   */
  dragStartPos;

  /**
   * @type {Connection}
   * The connection that was closest to the start of dragging this Group.
   */
  dragStartConnection;

  /**
   * @type {Pose}
   */
  dragStartOffset;

  /**
   * @param {Boolean} temporary Whether this is a temporary group (used for dragging) or a permanent group.
   */
  constructor(temporary = false) {
    this.#uuid = crypto.randomUUID();
    this.#temporary = temporary;
    this.#locked = false;
    /** @type {Map<String, Connection>} */
    this.connections = new Map();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.parent = null;
    let layoutController = LayoutController.getInstance();
    this.connections.clear();
    this.#components.forEach(component => {
      component.group = null;
      if (!this.#temporary) {
        layoutController.deleteComponent(component);
      }
    });
    this.#components = null;
  }

  /**
   * Adds a component to the group.
   * @param {Component} component
   * @throws {Error} If the component is on a different layer than the group (for permanent groups only)
   * @throws {Error} If the component already belongs to another ComponentGroup
   * @throws {Error} If trying to add the same permanent ComponentGroup to a temporary group multiple times
   */
  addComponent(component) {
    if (this.destroyed) return;

    if (component instanceof ComponentGroup) {
      if (component === this) {
        console.warn?.('Cannot add group to itself.', component);
        return;
      }
      const alreadyExists = this.#components.some(existingComponent => 
        existingComponent instanceof ComponentGroup && 
        existingComponent.uuid === component.uuid
      );

      if (alreadyExists) {
        console.warn(`Prevented adding ComponentGroup ${component.uuid} to another group multiple times`);
        return;
      }
    }

    if (component.group) {
      console.warn?.('Component already belongs to a group.', component);
      return;
    }

    if (!this.parent) {
      this.parent = component.parent ?? component.layer;
    }

    const componentLayer = component.parent ?? component.layer;
    if (componentLayer !== this.parent) {
      throw new Error('Cannot add component from different layer to a ComponentGroup. All components in a group must be on the same layer.');
    }

    this.#components.push(component);
    component.group = this;
    component.connections.forEach(connection => {
      this.connections.set(connection.uuid, connection);
    });
  }

  /**
   * Removes a component from the group.
   * If the group becomes empty, it is destroyed.
   * @param {Component} component
   */
  removeComponent(component) {
    component.group = null;
    if (this.destroyed) return;
    this.#components = this.#components.filter(c => c.uuid !== component.uuid);
    component.connections.forEach(connection => {
      this.connections.delete(connection.uuid);
    });
    if (this.#components.length === 0) {
      this.destroy();
    }
  }

  /**
   * Sets the alpha for all components in the group.
   * @param {number} value - The alpha value to set.
   */
  set alpha(value) {
    this.#components.forEach(component => {
      component.alpha = value;
    });
  }

  addToLayer(layer) {
    layer.addChild(...this.#components);
    this.parent = layer;
  }

  get baseData() {
    const bounds = this.getBounds();
    return {
      width: bounds.width,
      height: bounds.height,
      connections: []
    };
  }

  bringToFront() {
    if (this.destroyed) return;
    if (!this.parent) return;

    const allComponents = this.getAllComponents();
    const componentsWithIndices = allComponents.map(comp => ({
      component: comp,
      index: this.parent.getChildIndex(comp)
    }));
    const targetIndex = this.parent.children.length - 2;

    componentsWithIndices.sort((a, b) => a.index - b.index);
    componentsWithIndices.forEach(({ component }) => {
      this.parent.setChildIndex(component, targetIndex);
    });
  }

  sendToBack() {
    if (this.destroyed) return;
    if (!this.parent) return;

    const allComponents = this.getAllComponents();
    const componentsWithIndices = allComponents.map(comp => ({
      component: comp,
      index: this.parent.getChildIndex(comp)
    }));

    componentsWithIndices.sort((a, b) => b.index - a.index);
    componentsWithIndices.forEach(({ component }) => {
      this.parent.setChildIndex(component, 0);
    });
  }

  /**
   * Checks if the group can be rotated.
   * This is true if all connections in the group are connected to other connections in the group,
   * or not connected.
   * @returns {Boolean}
   */
  canRotate() {
    for (const connection of this.connections.values()) {
      if (connection.otherConnection && !this.connections.has(connection.otherConnection.uuid)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Clone the whole component group.
   * @param {LayoutLayer} layer The layer to clone to.
   * @param {Component} [connectTo] The component to connect to.
   * @returns {ComponentGroup} The cloned component group.
   */
  clone(layer, connectTo = null) {
    const newGroup = new ComponentGroup(this.#temporary);

    if (layer) {
      newGroup.parent = layer;
    }

    // Map from old component UUID to new component (including nested components)
    const componentMap = new Map();

    // Helper function to recursively map all components
    const mapAllComponents = (oldItem, newItem) => {
      if (oldItem instanceof ComponentGroup) {
        componentMap.set(oldItem.uuid, newItem);
        // Map all components within the nested group
        const oldComponents = oldItem.getAllComponents();
        const newComponents = newItem.getAllComponents();
        for (let i = 0; i < oldComponents.length; i++) {
          componentMap.set(oldComponents[i].uuid, newComponents[i]);
        }
      } else {
        componentMap.set(oldItem.uuid, newItem);
      }
    };

    // Clone all components in the group
    for (const component of this.#components) {
      const newComponent = component.clone(layer);
      mapAllComponents(component, newComponent);
      newGroup.addComponent(newComponent);
    }

    // Re-establish connections between cloned components (only for regular Components)
    const allOldComponents = this.getAllComponents();
    for (const oldComponent of allOldComponents) {
      const newComponent = componentMap.get(oldComponent.uuid);

      for (let i = 0; i < oldComponent.connections.length; i++) {
        const oldConnection = oldComponent.connections[i];

        // If this connection was connected to another component in the group
        if (oldConnection.otherConnection) {
          const otherComponent = oldConnection.otherConnection.component;

          // Check if the other component is in this group
          if (this.connections.has(oldConnection.otherConnection.uuid)) {
            const newOtherComponent = componentMap.get(otherComponent.uuid);
            const otherConnectionIndex = oldConnection.otherConnection.connectionIndex;

            // Connect the cloned connections (only if not already connected)
            if (newOtherComponent && !newComponent.connections[i].otherConnection) {
              newComponent.connections[i].connectTo(newOtherComponent.connections[otherConnectionIndex]);
            }
          }
        }
      }
    }

    if (connectTo) {
      var connection = connectTo.getOpenConnection();
      if (Array.from(connectTo.connections.values()).length === 0 || newGroup.connections.size === 0 || !connection) {
        let width = newGroup.getBounds().width;
        function calculateNextToPosition(component, width) {
          let compWidth;
          if (component instanceof ComponentGroup) {
            const nextBounds = component.getBounds();
            let localNextBounds = layer.toLocal({x:nextBounds.minX, y:nextBounds.maxX});
            compWidth = localNextBounds.y - localNextBounds.x;
          } else {
            compWidth = component.sprite.width;
          }
          let vec = new PolarVector((compWidth / 2) + (width / 2), 0, 0);
          return vec.getEndPosition(component.getPose());
        }
        let newPos = calculateNextToPosition(connectTo, width);
        newGroup.deleteCollisionTree();
        newGroup.move(Math.fround(newPos.x), Math.fround(newPos.y));
        newGroup.insertCollisionTree();
        return newGroup;
      }
      if (connection) {
        let groupConnections = newGroup.getOpenConnections();
        if (groupConnections.length > 0) {
          let groupConnection = groupConnections[0];
          if (connection.component.baseData.alias !== groupConnection.component.baseData.alias
            || connection.nextConnectionIndex !== groupConnection.connectionIndex) {
            groupConnections.some((conn) => {
              if (connection.component.baseData.alias === conn.component.baseData.alias
                && connection.nextConnectionIndex === conn.connectionIndex) {
                groupConnection = conn;
                return true;
              }
              return false;
            });
          }
          // Get the pose of the connection we're connecting to
          let conPose = connection.getPose();
          conPose.turnAngle(Math.PI);

          // Calculate the target position based on the group connection's offset
          let targetPose = groupConnection.offsetVector.getStartPosition(conPose);

          // Get current pose of the group connection
          let currentGroupConPose = groupConnection.component.getPose();

          // Calculate the angle difference needed to align
          let angleOffset = targetPose.angle - currentGroupConPose.angle;

          // Rotate the group to align the connection angles
          if (angleOffset !== 0) {
            newGroup.rotate(angleOffset, false);
          }

          // After rotation, recalculate the group connection pose
          currentGroupConPose = groupConnection.component.getPose();

          // Calculate position offset needed after rotation
          let posX = Math.fround(targetPose.x - currentGroupConPose.x);
          let posY = Math.fround(targetPose.y - currentGroupConPose.y);

          // Move the group to align positions
          let currentPos = newGroup.#components[0]?.parent ? newGroup.getLocalPosition() : newGroup.getGlobalPosition();
          newGroup.deleteCollisionTree();
          newGroup.move(currentPos.x + posX, currentPos.y + posY);
          newGroup.insertCollisionTree();

          // Connect the connections
          groupConnection.connectTo(connection);
        }
      }
    }

    return newGroup;
  }

  /**
   * Disconnect all "outgoing" connections from this Group
   */
  closeConnections() {
    for (const connection of this.connections.values()) {
      if (connection.otherConnection && !this.connections.has(connection.otherConnection.uuid)) {
        connection.disconnect();
      }
    }
  }

  /**
   * @returns {Array<Component>} The components in the group.
   */
  get components() {
    if (this.destroyed) {
      return [];
    }
    return [...this.#components];
  }

  /**
   * Get the first Component that is connected to this group.
   * @returns {Component|null} The first Component that is connected to this group, or null.
   */
  getAdjacentComponent() {
    const connection = Array.from(this.connections.values()).find((connection) => connection.otherConnection && !this.connections.has(connection.otherConnection.uuid));
    return connection?.otherConnection?.component ?? null;
  }

  /**
   * Recursively collect all individual components from this group and any nested groups.
   * @returns {Array<Component>} Array of all individual components (not ComponentGroups)
   */
  getAllComponents() {
    const allComponents = [];

    this.#components.forEach(component => {
      if (component instanceof ComponentGroup) {
        allComponents.push(...component.getAllComponents());
      } else {
        allComponents.push(component);
      }
    });

    return allComponents;
  }

  /**
   * Gets the global Bounds of the group.
   * @returns {Bounds}
   */
  getBounds() {
    if (this.#components.length === 0) return null;
    
    // Get first component's bounds to initialize
    const firstBounds = this.#components[0].getBounds();
    if (!firstBounds) return null;
    
    let minX = firstBounds.minX;
    let minY = firstBounds.minY;
    let maxX = firstBounds.maxX;
    let maxY = firstBounds.maxY;
    
    // Find overall min/max from remaining components
    for (let i = 1; i < this.#components.length; i++) {
      const bounds = this.#components[i].getBounds();
      if (!bounds) continue;
      
      if (bounds.minX < minX) minX = bounds.minX;
      if (bounds.minY < minY) minY = bounds.minY;
      if (bounds.maxX > maxX) maxX = bounds.maxX;
      if (bounds.maxY > maxY) maxY = bounds.maxY;
    }
    
    // Create bounds object once with final values
    return new Bounds(minX, minY, maxX, maxY);
  }

  /**
   * @returns {Point} The global position of the group.
   */
  getGlobalPosition() {
    if (this.#components.length === 0) return null;

    const bounds = this.getBounds();
    if (!bounds) return null;

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    return {x: centerX, y: centerY};
  }

  /**
   * @returns {Point} The local position of the group.
   */
  getLocalPosition() {
    if (this.#components.length === 0) return null;

    const globalPosition = this.getGlobalPosition();
    if (!globalPosition) return null;
    if (!this.parent) return globalPosition;

    return this.parent.toLocal(globalPosition);
  }

  /**
   * Find the next open connection on this ComponentGroup
   * @param {Number} startIndex The index to start searching from, defaults to 0
   * @returns {Connection} The next open Connection, or null if none are open
   */
  getOpenConnection(startIndex = 0) {
    if (startIndex < 0 || startIndex >= this.connections.size) {
      startIndex = 0;
    }
    let openConnections = this.getOpenConnections();
    if (openConnections.length === 0) {
      return null;
    }
    let returnConnection = openConnections.find((conn) => conn.connectionIndex >= startIndex);
    return returnConnection || openConnections[0];
  }

  /**
   * Finds all of the open connections in this group
   * @returns {Array<Connection>} The open connections in this group
   */
  getOpenConnections() {
    return Array.from(this.connections.values()).filter((connection) => !connection.otherConnection);
  }

  getPose() {
    const localPos = this.getLocalPosition();
    if (!localPos) return null;
    return new Pose(localPos.x, localPos.y, 0);
  }

  /**
   * Finds all of the used connections in this group
   * @returns {Array<Connection>} The used connections in this group
   */
  getUsedConnections() {
    return Array.from(this.connections.values()).filter((connection) => connection.otherConnection);
  }

  /**
   * Check if any member components are locked.
   * @returns {Boolean} True if any member component is locked, false otherwise
   */
  hasLockedComponents() {
    return this.#components.some(component => {
      if (component instanceof ComponentGroup) {
        return component.locked || component.hasLockedComponents();
      }
      return component.locked;
    });
  }

  /**
   * @returns {Boolean} Whether the group is being dragged.
   */
  get isDragging() {
    return this.#isDragging;
  }

  set isDragging(value) {
    this.#isDragging = value;
    this.#components.forEach(component => {
      component.isDragging = value;
    });
  }

  get isTemporary() {
    return this.#temporary;
  }

  /**
   * @param {Boolean} value
   */
  set isTemporary(value) {
    if (value === this.#temporary) return;
    this.#temporary = value;
  }

  /**
   * Get the locked state of this ComponentGroup.
   * @returns {Boolean} True if this ComponentGroup is locked, false otherwise
   */
  get locked() {
    return this.#locked;
  }

  /**
   * Set the locked state of this ComponentGroup.
   * For temporary groups, this also affects all member components.
   * For permanent groups, this only affects the group itself.
   * @param {Boolean} value The new locked state to set
   */
  set locked(value) {
    this.#locked = Boolean(value);
    if (this.#temporary) {
      this.#components.forEach(component => {
        component.locked = this.#locked;
      });
    }
  }

  /**
   * Moves the group to the specified position.
   * @param {number} x 
   * @param {number} y 
   */
  move(x, y) {
    if (this.#locked || this.hasLockedComponents()) {
      return;
    }
    const localPosition = this.#components[0]?.parent ? this.getLocalPosition() : this.getGlobalPosition();
    if (!localPosition) return;

    const deltaX = x - localPosition.x;
    const deltaY = y - localPosition.y;

    this.#components.forEach(component => {
      if (component instanceof ComponentGroup) {
        const componentPos = component.components[0]?.parent ? component.getLocalPosition() : component.getGlobalPosition();
        if (componentPos) {
          component.move(componentPos.x + deltaX, componentPos.y + deltaY);
        }
      } else {
        const compLocalPos = component.position;
        if (compLocalPos) {
          component.position.set(compLocalPos.x + deltaX, compLocalPos.y + deltaY);
        }
      }
    });
  }

  /**
   * 
   * @param {FederatedPointerEvent} e 
   */
  onStartDrag(e) {
    if (this.#locked || this.hasLockedComponents()) {
      return;
    }
    if (this.group) {
      this.group.onStartDrag(e);
      return;
    }

    LayoutController.dragTarget = this;
    LayoutController.dragDistance = 0;
    LayoutController.dragWithAlt = e.altKey; // Track if Alt key is pressed for duplication
    this.alpha = 0.5;
    this.isDragging = false;
    let a = e.getLocalPosition(this.parent);
    this.dragStartConnection = null;
    // Find the closest connection to the start of dragging
    let closestDistance = Infinity;
    for (let connection of this.connections.values()) {
      let distance = connection.getPose().subtract({...a, angle: 0}).magnitude();
      if (this.dragStartConnection === null || distance < closestDistance) {
        closestDistance = distance;
        this.dragStartConnection = connection;
      }
    }
    if (this.dragStartConnection) {
      // If we found a connection, set the drag start position to the connection's pose
      let b = this.dragStartConnection.getPose();
      this.dragStartPos = b.subtract({...a, angle: 0});
      this.dragStartOffset =  this.getPose().subtract(b);
    } else {
      // If we didn't find a connection, set the drag start position to the center of the component group
      this.dragStartPos = this.getPose().subtract({...a, angle: 0});
      this.dragStartOffset = new Pose(0, 0, 0);
    }
    this.deleteCollisionTree();
    window.app.stage.on('pointermove', LayoutController.onDragMove);
    window.app.stage.on('pointerupoutside', LayoutController.onDragEnd);
    e.stopImmediatePropagation();
  }

  get position() {
    return {set: (x, y) => {this.move(x, y)}};
  }

  /**
   * Rotate the group.
   * @param {Number} [angle] The angle to rotate by in radians. Defaults to PI/8.
   */
  rotate(angle = Math.PI / 8, checkConnections = true) {
    if (this.#locked || this.hasLockedComponents()) {
      return;
    }
    if (!this.canRotate()) {
      return;
    }

    const center = this.getLocalPosition();
    if (!center) return;
    this.deleteCollisionTree();
    this.#components.forEach(component => {
      if (component instanceof ComponentGroup) {
        const componentCenter = component.getLocalPosition();
        if (componentCenter) {
          const rotatedCenter = new Pose(componentCenter.x, componentCenter.y, 0).rotateAround(center.x, center.y, angle);
          component.move(rotatedCenter.x, rotatedCenter.y);
          component._rotateComponents(angle, checkConnections);
        }
      } else {
        const pose = component.getPose().rotateAround(center.x, center.y, angle);
        component.position.set(pose.x, pose.y);
        component.sprite.rotation = pose.angle;
        component.connections.forEach(connection => {
          if (checkConnections && !connection.otherConnection) {
            component.layer.findMatchingConnection(connection, true);
          }
          connection.updateCircle();
        });
      }
    });
    if (!this.isDragging) {
      this.insertCollisionTree();
    }
  }

  /**
   * Internal method to rotate components without checking canRotate().
   * Used when rotating nested groups as part of a parent group rotation.
   * @param {Number} angle The angle to rotate by in radians
   * @param {Boolean} checkConnections Whether to check connections
   */
  _rotateComponents(angle, checkConnections = true) {
    const center = this.getLocalPosition();
    if (!center) return;

    this.#components.forEach(component => {
      if (component instanceof ComponentGroup) {
        const componentCenter = component.getLocalPosition();
        if (componentCenter) {
          const rotatedCenter = new Pose(componentCenter.x, componentCenter.y, 0).rotateAround(center.x, center.y, angle);
          component.move(rotatedCenter.x, rotatedCenter.y);
          component._rotateComponents(angle, checkConnections);
        }
      } else {
        const pose = component.getPose().rotateAround(center.x, center.y, angle);
        component.position.set(pose.x, pose.y);
        component.sprite.rotation = pose.angle;
        component.connections.forEach(connection => {
          if (checkConnections && !connection.otherConnection) {
            component.layer.findMatchingConnection(connection, true);
          }
          connection.updateCircle();
        });
      }
    });
  }

  /**
   * @returns {number} The number of components in the group.
   */
  get size() {
    if (this.destroyed) {
      return 0;
    }
    return this.#components.length;
  }

  /**
   * Sets the tint color for all components in the group.
   * @param {number} color - The tint color to set.
   */
  set tint(color) {
    if (this.destroyed) return;
    this.#components.forEach(component => {
      component.tint = color;
    });
  }

  /**
   * Remove all of the Components from the collision tree.
   */
  deleteCollisionTree() {
    this.#components.forEach(component => {
      if (component instanceof ComponentGroup) {
        component.deleteCollisionTree();
      } else {
        let bbox = component.sprite.getLocalBounds();
        let item = {
          id: component.uuid,
          minX: bbox.minX + component.position.x,
          minY: bbox.minY + component.position.y,
          maxX: bbox.maxX + component.position.x,
          maxY: bbox.maxY + component.position.y,
          component: component
        };
        component.layer.tree.remove(item, (a,b) => {return a.id === b.id});
      }
    });
  }

  /**
   * Insert all of the Components into the collision tree, using a bulk load.
   */
  insertCollisionTree() {
    if (!this.parent) return;
    let load = [];
    this.#components.forEach(component => {
      if (component instanceof ComponentGroup) {
        component.insertCollisionTree();
      } else {
        let bbox = component.sprite.getLocalBounds();
        let item = {
          id: component.uuid,
          minX: bbox.minX + component.position.x,
          minY: bbox.minY + component.position.y,
          maxX: bbox.maxX + component.position.x,
          maxY: bbox.maxY + component.position.y,
          component: component
        };
        load.push(item);
      }
    });
    if (load.length > 0) {
      this.parent.tree.load(load);
    }
  }

  /**
   * Serializes the ComponentGroup to a plain object
   * @returns {Object} Serialized ComponentGroup with uuid and optional group property for nested groups
   */
  serialize() {
    const serialized = {
      uuid: this.#uuid
    };

    if (this.group) {
      serialized.group = this.group.uuid;
    }

    if (this.#locked) {
      serialized.locked = 1;
    }

    return serialized;
  }

  /**
   * Unique identifier for this ComponentGroup
   * @returns {String}
   */
  get uuid() {
    return this.#uuid;
  }

  /**
   * Set the UUID for this ComponentGroup (used during deserialization)
   * @param {String} value
   */
  set uuid(value) {
    this.#uuid = value;
  }
}
