import { Container, RenderLayer } from "../pixi.mjs";
import { Component, SerializedComponent } from "./component.js";
import { ComponentGroup } from "./componentGroup.js";
import { Connection } from "./connection.js";

/**
 * @typedef {Object} SerializedLayoutLayer
 * @property {String} name The display name of the layer
 * @property {Boolean} visible The visibility of the layer
 * @property {Number} [opacity] The opacity of the layer (0-100), defaults to 100
 * @property {Array<SerializedComponent>} components
 * @property {Array<Object>} [groups] Permanent ComponentGroups in this layer
 */
let SerializedLayoutLayer;
export { SerializedLayoutLayer };

export class LayoutLayer extends Container {
    /**
     * Unique identifier for this LayoutLayer
     * @type {String}
     */
    #uuid;

    /**
     * @type {RBush<Component>}
     */
    tree;

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

        this.tree = new RBush();

        super.addChild(this.overlay);
    }

    destroy() {
        this.clear();
        this.overlay.detachAll();
        this.overlay = null;
        this.tree = null;
        super.destroy();
    }

    addChild(...children) {
        let index = this.children.length - 1;
        children.forEach(child => {
            if (child instanceof ComponentGroup) {
                child.addToLayer(this);
                return;
            }
            super.addChildAt(child, index);
            this.overlay.attach(...(child.children.filter((component) => component.renderPipeId == "graphics" && (component.priority ?? false))));
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
        this.tree.clear();
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
     * Find a matching connection for the given openConnection
     * @param {Connection} openConnection Connection to find a match for
     * @param {Boolean} connect Whether to connect the connections if a match is found
     * @returns {?Connection} The matching connection, or null if none was found
     */
    findMatchingConnection(openConnection, connect = false) {
        for (const [key, connectionTest] of this.openConnections) {
          if (connectionTest.component.uuid === openConnection.component.uuid) {
            continue;
          }
          if (connectionTest.getPose().isInRadius(openConnection.getPose(), 1) && connectionTest.getPose().hasOppositeAngle(openConnection.getPose())) {
            if (connect) {
              openConnection.connectTo(connectionTest);
            }
            return connectionTest;
          }
        }
        return null;
    }

    /**
     * Serialize this LayoutLayer to a SerializedLayoutLayer
     * @returns {SerializedLayoutLayer}
     */
    serialize() {
      const serialized = {
        components: this.children.filter(/** @param {Container} child */(child) => child instanceof Component)
          .map(/** @param {Component} child */(child) => child.serialize()),
        name: this.label,
        visible: this.visible,
        opacity: Math.round(this.alpha * 100)
      };
      const permanentGroups = new Map();

      this.children.forEach(child => {
        if (child instanceof Component && child.group && !child.group.isTemporary) {
          permanentGroups.set(child.group.uuid, child.group);
        }
      });
      if (permanentGroups.size > 0) {
        serialized.groups = Array.from(permanentGroups.values()).map(group => group.serialize());
      }

      return serialized;
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
        this.alpha = (data?.opacity ?? 100) / 100;

        if (data.groups && Array.isArray(data.groups)) {
            this._reconstructGroups(data.groups);
        }
    }

    /**
     * Reconstructs permanent ComponentGroups from serialized groups data
     * Handles nested groups and missing group references gracefully
     * @param {Array<Object>} groupsData Array of serialized group objects
     * @private
     */
    _reconstructGroups(groupsData) {
        // Create a temporary Map for group lookup during deserialization
        this._groupLookupMap = new Map();
        
        // Arrays to handle nested groups
        const topLevelGroups = [];
        const nestedGroups = [];
        
        // Separate top-level and nested groups
        groupsData.forEach(groupData => {
            if (groupData.group) {
                // This is a nested group - defer creation
                nestedGroups.push(groupData);
            } else {
                // This is a top-level group - create immediately
                topLevelGroups.push(groupData);
            }
        });
        
        // Create top-level groups first
        topLevelGroups.forEach(groupData => {
            const group = new ComponentGroup(false); // permanent group
            group.uuid = groupData.uuid;
            group.parent = this;
            if (groupData.locked === 1) {
                group.locked = true;
            }
            this._groupLookupMap.set(groupData.uuid, group);
        });
        
        // Process nested groups in dependency order
        let remainingNestedGroups = [...nestedGroups];
        let processedInLastIteration = true;
        
        while (remainingNestedGroups.length > 0 && processedInLastIteration) {
            const initialLength = remainingNestedGroups.length;
            
            for (let i = remainingNestedGroups.length - 1; i >= 0; i--) {
                const groupData = remainingNestedGroups[i];
                const parentGroup = this._groupLookupMap.get(groupData.group);
                
                if (parentGroup) {
                    // Parent exists, create this nested group
                    const nestedGroup = new ComponentGroup(false); // permanent group
                    nestedGroup.uuid = groupData.uuid;
                    nestedGroup.parent = this;
                    nestedGroup.group = parentGroup;
                    if (groupData.locked === 1) {
                        nestedGroup.locked = true;
                    }
                    this._groupLookupMap.set(groupData.uuid, nestedGroup);
                    remainingNestedGroups.splice(i, 1);
                }
            }
            
            // Check if we processed any groups this iteration
            processedInLastIteration = remainingNestedGroups.length < initialLength;
        }
        
        // Handle any remaining nested groups with missing parents
        remainingNestedGroups.forEach(groupData => {
            console.warn(`Group ${groupData.uuid} references missing parent group ${groupData.group}, treating as top-level group`);
            const group = new ComponentGroup(false); // permanent group
            group.uuid = groupData.uuid;
            group.parent = this;
            if (groupData.locked === 1) {
                group.locked = true;
            }
            this._groupLookupMap.set(groupData.uuid, group);
        });
    }

    /**
     * Gets the group lookup map for component deserialization
     * @returns {Map<String, ComponentGroup>|null} The group lookup map or null if no groups
     */
    getGroupLookupMap() {
        return this._groupLookupMap || null;
    }

    /**
     * Cleans up the temporary group lookup map after deserialization
     * Also removes any empty groups that have no components or sub-groups
     */
    cleanupGroupDeserialization() {
        if (!this._groupLookupMap) return;
        
        // Check for empty groups and log warnings
        const emptyGroups = [];
        this._groupLookupMap.forEach((group, uuid) => {
            // Count components in this group
            const componentCount = this.children.filter(child => 
                child instanceof Component && child.group === group
            ).length;
            
            // Count sub-groups in this group
            const subGroupCount = Array.from(this._groupLookupMap.values()).filter(
                otherGroup => otherGroup.group === group
            ).length;
            
            if (componentCount === 0 && subGroupCount === 0) {
                emptyGroups.push(group);
            }
        });
        
        // Remove empty groups
        emptyGroups.forEach(group => {
            console.warn(`Destroying orphaned group ${group.uuid} with no components`);
            this._groupLookupMap.delete(group.uuid);
            group.destroy();
        });
        
        // Clean up the temporary lookup map
        this._groupLookupMap = null;
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
            data?.opacity == undefined || typeof data?.opacity === 'number',
            data?.opacity == undefined || (data?.opacity >= 0 && data?.opacity <= 100),
            data?.components,
            Array.isArray(data?.components),
            data?.groups === undefined || Array.isArray(data?.groups),
        ]

        if (validations.some(v => !v)) {
            return false;
        }

        if (data.groups) {
            const groupsValid = data.groups.every(group => {
                return group && 
                       typeof group.uuid === 'string' &&
                       (group.group === undefined || typeof group.group === 'string');
            });
            if (!groupsValid) {
                return false;
            }
        }

        return data.components.every(component => Component._validateImportData(component));
    }
}