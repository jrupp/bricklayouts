import { Assets, Container, FederatedPointerEvent, Sprite } from "../pixi.mjs";
import { LayoutController, TrackData } from '../controller/layoutController.js';
import { Connection, SerializedConnection } from "./connection.js";
import { Pose, SerializedPose } from "./pose.js";
import { LayoutLayer } from "./layoutLayer.js";
import { PolarVector } from "./polarVector.js";

/**
 * @typedef {Object} SerializedComponent
 * @property {String} type
 * @property {SerializedPose} pose
 * @property {Array<SerializedConnection>} connections
 */
let SerializedComponent;
export { SerializedComponent };

export class Component extends Container {
  /**
   * @type {Pose}
   * The offset position from the mouse to this Component's position when dragging.
   */
  dragStartPos;

  /**
   * @type {Connection}
   * The connection that was closest to the start of dragging this Component.
   */
  dragStartConnection;

  /**
   * @type {Pose}
   */
  dragStartOffset;

  /**
   * 
   * @param {TrackData} baseData 
   * @param {Pose} pose 
   * @param {LayoutLayer} layer The layer this Component will be on
   */
  constructor(baseData, pose, layer) {
    super();

    /**
     * @type {TrackData}
     */
    this.baseData = baseData;

    /**
     * @type {LayoutLayer}
     */
    this.layer = layer;

    /**
     * @type {Boolean}
     */
    this.isDragging = false;

    /**
     * @type {Sprite}
     */
    this.sprite = new Sprite(Assets.get(baseData.alias));
    if (baseData.scale) {
      this.sprite.scale.set(baseData.scale);
    }

    this.sprite.anchor.set(0.5);
    this.sprite.rotation = pose.angle;
    this.position.set(pose.x, pose.y);
    this.addChild(this.sprite);

    this.sprite.eventMode = 'static';
    this.sprite.on('pointerdown', this.onStartDrag, this);
    this.sprite.on('click', Component.onClick, this);
    this.sprite.on('tap', Component.onClick, this);

    /**
     * @type {Array<Connection>}
     */
    this.connections = [];

    if (this.baseData.connections) {
      this.connections = this.baseData.connections.map((connection, index) => new Connection(this, connection.vector, connection.type, index, connection.next));
    }
  }

  /**
   * 
   * @param {TrackData} baseData 
   * @param {Connection} connection 
   * @param {LayoutLayer} layer The layer this Component will be on
   * @returns {Component}
   */
    static fromConnection(baseData, connection, layer) {
      let conPose = connection.getPose();
      conPose.turnAngle(Math.PI);
      let conIndex = 0;
      if (connection.component.baseData.alias === baseData.alias) {
        conIndex = connection.nextConnectionIndex;
      }
      /** @type {Pose} */
      var newPos = baseData.connections[conIndex].vector.getStartPosition(conPose);
      newPos.x = Math.fround(newPos.x);
      newPos.y = Math.fround(newPos.y);
      var newComp = new Component(baseData, newPos, layer);
      newComp.connections[conIndex].connectTo(connection);
      return newComp;
    }

  /**
   * 
   * @param {TrackData} baseData 
   * @param {Component} component The Component to connect to
   * @param {LayoutLayer} layer The layer this Component will be on
   * @returns {Component|null} The new Component or null if no open connections found
   */
  static fromComponent(baseData, component, layer) {
    var connection = component.getOpenConnection();
    if (connection) {
      return Component.fromConnection(baseData, connection, layer);
    }
    if (component.connections.length === 0) {
      // Calculate a position that is next to the component instead.
      const vec = new PolarVector(component.sprite.width, 0, 0);
      let newPos = vec.getEndPosition(component.getPose());
      return new Component(baseData, newPos, layer);
    }
    return null;
  }

  destroy() {
    this.dragStartConnection = null;
    this.connections.forEach((connection) => connection.destroy());
    this.connections = null;
    this.layer = null;
    super.destroy();
    this.baseData = null;
  }

  /**
   * Get position as a Pose
   * @returns {Pose}
   */
  getPose() {
    return new Pose(this.x, this.y, this.sprite.rotation);
  }

  /**
   * Find the next open connection on this Component
   * @param {Number} startIndex The index to start searching from, defaults to 0
   * @returns {Connection} The next open Connection, or null if none are open
   */
  getOpenConnection(startIndex = 0) {
    if (startIndex < 0 || startIndex >= this.connections.length) {
      startIndex = 0;
    }
    let openConnections = this.getOpenConnections();
    let returnConnection = null;
    openConnections.forEach((connection) => {
      if (connection.otherConnection) {
        return;
      }
      if (connection.connectionIndex >= startIndex) {
        returnConnection = connection;
      } else if (returnConnection === null) {
        returnConnection = connection; // If no other open connections found, return the first one
      }
    });
    return returnConnection;
  }

  /**
   * Finds all of the open connections on this Component
   * @returns {Array<Connection>} The open connections on this Component
   */
  getOpenConnections() {
    return this.connections.filter((connection) => !connection.otherConnection);
  }

  /**
   * Finds all of the used connections on this Component
   * @returns {Array<Connection>} The used connections on this Component
   */
  getUsedConnections() {
    return this.connections.filter((connection) => connection.otherConnection);
  }

  /**
   * Disconnect all connections from this Component
   */
  closeConnections() {
    this.connections.forEach((connection) => {
      connection.disconnect();
    });
  }

  /**
   * Get the first Component that is connected to this one.
   * @returns {Component|null} The first Component that is connected to this one, or null.
   */
  getAdjacentComponent() {
    const connection = this.connections.find((connection) => connection.otherConnection);
    return connection?.otherConnection?.component ?? null;
  }

  rotate() {
    const currentConnections = this.getUsedConnections();
    if (currentConnections.length > 1) {
      return;
    } else if (currentConnections.length === 0) {
      this.sprite.rotation += Math.PI / 8;
    } else if (currentConnections.length === 1) {
      const connection = currentConnections[0];
      const otherConnection = connection.otherConnection;
      const nextOpen = this.getOpenConnection(connection.connectionIndex + 1);
      if (!nextOpen) {
        return;
      }
      connection.disconnect();
      nextOpen.connectTo(otherConnection);

      let conPose = otherConnection.getPose();
      conPose.turnAngle(Math.PI);
      let newPos = nextOpen.offsetVector.getStartPosition(conPose);
      this.position.set(Math.fround(newPos.x), Math.fround(newPos.y));
      this.sprite.rotation = newPos.angle;
    }
    let openConnections = this.getOpenConnections();
    if (openConnections.length > 0) {
      openConnections.forEach((openCon) => {
        // TODO: Move this for loop to its own method in LayoutLayer
        for (const [key, connectionTest] of this.layer.openConnections) {
          if (connectionTest.component.uid === openCon.component.uid) {
            continue;
          }
          if (connectionTest.getPose().isInRadius(openCon.getPose(), 1) && connectionTest.getPose().hasOppositeAngle(openCon.getPose())) {
            openCon.connectTo(connectionTest);
            break;
          }
        }
      });
    }
    this.connections.forEach((connection) => {
      connection.updateCircle();
    });
  }

  /**
   * 
   * @param {TrackData} baseData 
   * @param {SerializedComponent} data The serialized data to deserialize
   * @param {LayoutLayer} layer The layer this Component will be on
   * @throws {Error} If baseData is undefined
   * @returns {Component}
   */
  static deserialize(baseData, data, layer) {
    if (baseData === undefined) {
      throw new Error('Component.deserialize: baseData is undefined');
    }
    const newComponent = new Component(baseData, Pose.deserialize(data.pose), layer);
    data.connections.forEach((connectionData, index) => {
      newComponent.connections[index].deserialize(connectionData);
    });
    return newComponent;
  }

  /**
   * 
   * @returns {SerializedComponent}
   */
  serialize() {
    return {
      type: this.baseData.alias,
      pose: this.getPose().serialize(),
      connections: this.connections.map((connection) => connection.serialize())
    };
  }

  /**
   * 
   * @param {SerializedComponent} data 
   * @returns {Boolean} True if data is valid, false otherwise
   */
  static _validateImportData(data) {
    let validations = [
      data,
      data?.type,
      typeof data?.type === 'string',
      data?.type?.length > 0,
      data?.type ? Assets.get(data?.type) : false,
      data?.pose,
      Pose._validateImportData(data?.pose),
      data?.connections,
      Array.isArray(data?.connections),
      data?.connections?.every?.((connection) => Connection._validateImportData(connection))
    ]
    return validations.every(v => v);
  }

  /**
   * 
   * @param {FederatedPointerEvent} e 
   */
  static onClick(e) {
    if (e.button != 0) {
      return;
    }
    if (!this.isDragging) {
      LayoutController.selectComponent(this);
    }
    this.isDragging = false;
  }

  /**
   * 
   * @param {FederatedPointerEvent} e 
   */
  onStartDrag(e) {
    if (e.button != 0 || !e.nativeEvent.isPrimary) {
      return;
    }
    LayoutController.dragTarget = this;
    this.alpha = 0.5;
    this.isDragging = false;
    let a = e.getLocalPosition(this.parent);
    this.dragStartConnection = null;
    // Find the closest connection to the start of dragging
    let closestDistance = Infinity;
    for (let connection of this.connections) {
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
      // If we didn't find a connection, set the drag start position to the Component's pose
      this.dragStartPos = this.getPose().subtract({...a, angle: 0});
      this.dragStartOffset = new Pose(0, 0, 0);
    }
    window.app.stage.on('pointermove', LayoutController.onDragMove);
    window.app.stage.on('pointerupoutside', LayoutController.onDragEnd);
    console.log(this.baseData.alias);
    e.stopImmediatePropagation();
  }
}