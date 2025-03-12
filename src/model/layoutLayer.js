import { Container, RenderLayer } from "../pixi.mjs";
import { Component, SerializedComponent } from "./component.js";
import { Connection } from "./connection.js";

/**
 * @typedef {Object} SerializedLayoutLayer
 * @property {Array<SerializedComponent>} components
 */
let SerializedLayoutLayer;
export { SerializedLayoutLayer };

export class LayoutLayer extends Container {
    constructor() {
        super();

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
     * 
     * @returns {SerializedLayoutLayer}
     */
    serialize() {
        return {
            components: this.children.filter(/** @param {Container} child */(child) => child instanceof Component)
                                    .reverse()
                                    .map(/** @param {Component} child */(child) => child.serialize())
        };
    }

    /**
     * 
     * @param {SerializedLayoutLayer} data
     * @returns {Boolean} True if data is valid, false otherwise
     */
    static _validateImportData(data) {
        if (data?.components === undefined || data?.components?.length == 0) {
            return false;
        }

        return data.components.every(component => Component._validateImportData(component));
    }
}