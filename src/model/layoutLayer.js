import { Container, RenderLayer } from "../pixi.mjs";
import { Component, SerializedComponent } from "./component.js";
import { Connection } from "./connection.js";

/**
 * @typedef {Object} SerializedLayoutLayer
 * @property {String} name The display name of the layer
 * @property {Boolean} visible The visibility of the layer
 * @property {Array<SerializedComponent>} components
 */
let SerializedLayoutLayer;
export { SerializedLayoutLayer };

export class LayoutLayer extends Container {
    /**
     * Unique identifier for this LayoutLayer
     * @type {String}
     */
    #uuid;

    constructor() {
        super();

        /**
         * Name of this Layer
         * @type {String}
         */
        this.label = "New Layer";

        this.#uuid = crypto.randomUUID();

        /**
         * @type {RenderLayer}
         */
        this.overlay = new RenderLayer();

        /**
         * Open connections anywhere in this layer
         * @type {Map<String, Connection>}
         */
        this.openConnections = new Map();

        super.addChild(this.overlay);
    }

    destroy() {
        this.clear();
        this.overlay.detachAll();
        this.overlay = null;
        super.destroy();
    }

    addChild(...children) {
        children.forEach(child => {
            super.addChildAt(child, 0);
        });
        return children[0];
    }

    /**
     * Remove all Components from this layer
     */
    clear() {
        this.children.forEach(child => {
            if (child instanceof Component) {
                child.destroy();
            }
        });
        this.openConnections.clear();
    }

    /**
     * Unique identifier for this LayoutLayer
     */
    get uuid() {
        return this.#uuid;
    }

    set uuid(value) {
        this.#uuid = value;
    }

    /**
     * Check if this LayoutLayer is equal to another LayoutLayer
     * @param {LayoutLayer} other 
     * @returns {Boolean} True if this LayoutLayer is equal to the other, false otherwise
     */
    equals(other) {
        if (!(other instanceof LayoutLayer)) {
            return false;
        }

        if (this.uuid === other.uuid) {
            return true;
        }
        return false;
    }

    /**
     * Serialize this LayoutLayer to a SerializedLayoutLayer
     * @returns {SerializedLayoutLayer}
     */
    serialize() {
        return {
            components: this.children.filter(/** @param {Container} child */(child) => child instanceof Component)
                                    .reverse()
                                    .map(/** @param {Component} child */(child) => child.serialize()),
            name: this.label,
            visible: this.visible
        };
    }

    /**
     * Deserialize a LayoutLayer from a SerializedLayoutLayer. Does not deserialize the components.
     * @param {SerializedLayoutLayer} data
     * @throws {Error} If the data is invalid
     */
    deserialize(data) {
        if (data === undefined) {
            throw new Error("Invalid data");
        }

        this.label = data?.name ?? "New Layer";
        this.visible = data?.visible ?? true;
    }

    /**
     * 
     * @param {SerializedLayoutLayer} data
     * @returns {Boolean} True if data is valid, false otherwise
     */
    static _validateImportData(data) {
        let validations = [
            data,
            data?.name === undefined || typeof data?.name === 'string',
            data?.name === undefined || data?.name?.length > 0,
            data?.visible == undefined || typeof data?.visible === 'boolean',
            data?.components,
            Array.isArray(data?.components),
            data?.components?.length > 0,
        ]
        if (validations.some(v => !v)) {
            return false;
        }
        /**
        if (data?.components === undefined || data?.components?.length == 0) {
            return false;
        }
        if (data?.name !== undefined && data?.name?.length == 0) {
            return false;
        }
        */

        return data.components.every(component => Component._validateImportData(component));
    }
}