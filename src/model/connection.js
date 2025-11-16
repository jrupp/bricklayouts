import { Graphics } from "../pixi.mjs";
import { Component } from "./component.js";
import { PolarVector } from "./polarVector.js";
import { Pose } from "./pose.js";

/**
 * @typedef {Object} SerializedConnection
 * @property {String} uuid
 * @property {String} otherConnection
 */
let SerializedConnection;
export { SerializedConnection };

export class Connection {
    /**
     * Map of all Connections by UUID
     * @type {Map<String, Connection>}
     */
    static connectionDB = new Map();

    /**
     * Unique identifier for this Connection
     * @type {String}
     */
    #uuid;

    /**
     * @param {Component} parent
     * @param {PolarVector} offsetVector
     * @param {Number} type
     * @param {Number} connectionIndex The index of this connection in the parent component's connections array
     * @param {Number} nextConnectionIndex
     */
    constructor(parent, offsetVector, type, connectionIndex, nextConnectionIndex) {
        this.#uuid = crypto.randomUUID();
        /**
         * @type {Component}
         */
        this.component = parent;
        /**
         * @type {PolarVector}
         */
        this.offsetVector = offsetVector;
        /**
         * @type {?Connection}
         */
        this.otherConnection = null;
        /**
         * @type {Number}
         */
        this.type = type;
        /**
         * @type {Number}
         */
        this.connectionIndex = connectionIndex;
        /**
         * @type {Number}
         */
        this.nextConnectionIndex = nextConnectionIndex;
        /**
         * @type {Graphics}
         */
        this.circle = new Graphics();
        this.circle.priority = true;
        this.updateCircle();
        parent.addChild(this.circle);
        this.component.layer?.openConnections.set(this.#uuid, this);
    }

    destroy() {
        this.disconnect();
        this.component.layer?.openConnections.delete(this.#uuid);
        this.component = null;
        this.offsetVector = null;
        this.circle.destroy();
        this.circle = null;
    }

    /**
     * Unique identifier for this Connection
     * @returns {String}
     */
    get uuid() {
        return this.#uuid;
    }

    set uuid(value) {
        this.component.layer.openConnections.delete(this.#uuid);
        this.#uuid = value;
        if (!this.otherConnection) {
            this.component.layer.openConnections.set(this.#uuid, this);
        }
    }

    /**
     * Get position as a Pose
     * @returns {Pose}
     */
    getPose() {
        return this.offsetVector.getEndPosition(this.component.getPose());
    }

    /**
     * Connect this Connection to another Connection
     * @param {Connection} other The Connection to connect to
     */
    connectTo(other) {
        if (this.otherConnection) {
            this.disconnect(false);
        }
        this.otherConnection = other;
        other.otherConnection = this;
        this.component.layer?.openConnections.delete(this.#uuid);
        this.component.layer?.openConnections.delete(other.uuid);
        this.updateCircle();
        other.updateCircle();
    }

    /**
     * Disconnect this Connection from another Connection
     * @param {boolean} redraw Whether to redraw the circle representing this Connection
     */
    disconnect(redraw = true) {
        if (this.otherConnection) {
            this.otherConnection.otherConnection = null;
            this.component.layer?.openConnections.set(this.otherConnection.uuid, this.otherConnection);
            if (redraw) {
                this.otherConnection.updateCircle();
            }
            this.otherConnection = null;
            this.component.layer?.openConnections.set(this.#uuid, this);
        }
        if (redraw) {
            this.updateCircle();
        }
    }

    /**
     * Update the circle representing this Connection
     */
    updateCircle() {
        this.circle.clear();
        if (this.otherConnection) {
            this.circle.visible = false;
            return;
        }
        this.circle.visible = true;
        var tempPose = this.offsetVector.getEndPosition({ x: 0, y: 0, angle: this.component.sprite.rotation });
        this.circle.position.set(tempPose.x, tempPose.y);
        this.circle.circle(0, 0, 10).fill({ color: 0xffff00 });
        // TODO: Check if this is dragStartConnection, and drag bigger if so
        if (this.circle.eventMode == "static") {
            this.circle.circle(0, 0, 1).fill({ color: 0x000000 });
        }
    }

    /**
     * 
     * @returns {SerializedConnection}
     */
    serialize() {
        return {
            uuid: this.#uuid,
            otherConnection: this.otherConnection ? this.otherConnection.uuid : ""
        };
    }

    /**
     * 
     * @param {SerializedConnection} data 
     */
    deserialize(data) {
        this.uuid = data.uuid;
        Connection.connectionDB.set(this.#uuid, this);
        if (data.otherConnection && Connection.connectionDB.has(data.otherConnection)) {
            this.connectTo(Connection.connectionDB.get(data.otherConnection));
        }
        this.updateCircle();
    }

    /**
     * 
     * @param {SerializedConnection} data 
     * @returns {Boolean}
     */
    static _validateImportData(data) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let validations = [
            data,
            data?.uuid,
            typeof data?.uuid === 'string',
            data?.uuid?.length > 0,
            uuidRegex.test(data?.uuid),
            data?.hasOwnProperty?.('otherConnection'),
            typeof data?.otherConnection === 'string',
            (data?.otherConnection?.length > 0) ? uuidRegex.test(data?.otherConnection) : true
          ]
          return validations.every(v => v);
    }
}