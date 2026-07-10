import { Assets, BitmapText, Color, ColorMatrixFilter, Container, FederatedPointerEvent, Graphics, Sprite, TilingSprite } from "../pixi.mjs";
import { LayoutController, TrackData, DataTypes } from '../controller/layoutController.js';
import { ComponentGroup } from "./componentGroup.js";
import { Connection, SerializedConnection } from "./connection.js";
import { Pose, SerializedPose } from "./pose.js";
import { LayoutLayer } from "./layoutLayer.js";
import { PolarVector } from "./polarVector.js";

/**
 * @typedef {Object} SerializedComponent
 * @property {String} type
 * @property {SerializedPose} pose
 * @property {Array<SerializedConnection>} connections
 * @property {Number} [width] The width of the component, if applicable
 * @property {Number} [height] The height of the component, if applicable
 * @property {String} [units] The units that the component is measured in (e.g., "studs", "inches", "feet")
 * @property {String} [shape] The shape of the component (e.g., "rectangle", "circle")
 * @property {String} color The color of the component
 * @property {String} [outline_color] The color of the outline, if applicable
 * @property {String} [bp_color] The color of the baseplate to place this on, if applicable
 * @property {Number} [opacity] The opacity of the component, if applicable
 * @property {String} [text] The text to display on the component, if applicable
 * @property {String} [url] The URL of the photo to display, for photo components only
 * @property {String} [font] The font to use for the text, if applicable
 * @property {Number} [font_size] The font size to use for the text, if applicable
 * @property {String} [group] The UUID of the ComponentGroup this component belongs to
 * @property {Number} [circle_percentage] The percentage of circle to display for partial circles (5-95)
 * @property {Number} [locked] The locked state of the component (1 if locked, omitted if unlocked)
 * @property {Number} [flip] The flipped state of the component (1 if horizontally flipped, omitted if not; only for structures)
 */
let SerializedComponent;
export { SerializedComponent };

/**
 * @typedef {Object} ComponentOptions
 * @property {number} width The width of the component
 * @property {number} height The height of the component
 * @property {string} units The units that the component is measured in (e.g., "studs", "inches", "feet")
 * @property {string} shape The shape of the component (e.g., "rectangle", "circle")
 * @property {string} color The color of the component
 * @property {string} bpColor The color of the baseplate to place this on, if applicable
 * @property {string} outlineColor The color of the outline
 * @property {number} opacity The opacity of the component
 * @property {string} text The text to display on the component
 * @property {string} url The URL of the photo to display, for photo components only
 * @property {string} font The font to use for the text
 * @property {number} fontSize The font size to use for the text
 * @property {number} circlePercentage The percentage of circle to display for partial circles (5-95)
 */
let ComponentOptions;
export { ComponentOptions };

/**
 * A read-only map from color name to hex value taken from styles.css `i.lego*` classes.
 * Keys are lowercase names like "green", "darkred", etc.
 * @type {Readonly<Record<string, string>>}
 * @see HexToColorName
 */
export const ColorNameToHex = Object.freeze({
  green: "#237841",
  red: "#C91A09",
  "dark pink": "#EF5BB3",
  white: "#ffffff",
  aqua: "#B3D7D1",
  black: "#000000",
  "dark azure": "#009FE0",
  blue: "#0055BF",
  lilac: "#7862ce",
  tan: "#EED9A4",
  "dark tan": "#B89869",
  "olive green": "#ABA953",
  lime: "#BBE90B",
  yellow: "#F2CD37",
  orange: "#FE8A18",
  "dark orange": "#B35408",
  "medium nougat": "#E3A05B",
  brown: "#582A12",
  "dark red": "#720E0F",
  "dark green": "#184632",
  "light bluish gray": "#A0A5A9",
  "dark bluish gray": "#6C6E68",
  "bright green": "#10CB31",
});

/**
 * A read-only map from hex value to color name.
 * Keys are lowercase hex values like "#237841"
 * @type {Readonly<Record<string, string>>}
 * @see ColorNameToHex
 */
export const HexToColorName = Object.freeze(Object.fromEntries(Object.entries(ColorNameToHex).map(([name, hex]) => [hex.toLowerCase(), name])));

/**
 * Default percentage value for partial circles when creating or editing circle components.
 * This represents what portion of a circle is drawn, with 100 being a full circle.
 * Valid range for circlePercentage is 5-95; this default of 80 provides a clearly visible
 * partial circle while still showing enough of the arc to be recognizable as circular.
 * @type {number}
 */
export const DEFAULT_CIRCLE_PERCENTAGE = 80;

const CURVE_ALIASES = new Set(['r104', 'r104a', 'r104b', 'railCurved9V', 'railCurved9VHalf', 'r56', 'r72', 'r88', 'r120']);

/**
 * Any thing that can be placed on the layout.
 */
export class Component extends Container {
  /** @type {Color} */
  #color;

  /**
   * @type {?String}
   * The color of the outline, if applicable.
   * This is used for shape components only.
   */
  #outlineColor;

  /**
   * @type {?Color}
   * The color of the baseplate to place this on, if applicable.
   */
  #bpColor;

  /**
   * @type {Number}
   * The width of the component, if applicable.
   * This is used for shapes and baseplates only.
   */
  #width;

  /**
   * @type {Number}
   * The height of the component, if applicable.
   * This is used for shapes and baseplates only.
   */
  #height;

  /**
   * @type {String}
   * The units of the component, if applicable.
   * Example: studs, inches, centimeters
   */
  #units;

  /**
   * @type {String}
   * The shape of the component, if applicable.
   * This is used for shape components only.
   * Example: rectangle, circle
   */
  #shape;

  /**
   * @type {String}
   * The text to display on the component, if applicable.
   */
  #text;

  /**
   * @type {String}
   * The font to use for the text, if applicable.
   * This is used for text components only.
   */
  #font;

  /**
   * @type {Number}
   * The font size to use for the text, if applicable.
   * This is used for text components only.
   */
  #fontSize;

  /**
   * @type {String}
   * The URL of the photo to display, if applicable.
   * This is used for photo components only.
   */
  #url;

  /**
   * @type {Number}
   * The opacity of the component, if applicable.
   * This is used for shapes components only.
   */
  #opacity;

  /**
   * @type {?Number}
   * The percentage of circle to display for partial circles.
   * null or undefined indicates a full circle.
   * Valid range: 5-95
   */
  #circlePercentage;

  /**
   * @type {Boolean}
   * Whether this component is locked to prevent editing operations.
   */
  #locked;

  /**
   * @type {Boolean}
   * Whether this component is horizontally flipped (only supported for structures).
   */
  #flipped;

  /** @type {String} */
  #uuid;

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
   * @type {Graphics | Sprite | TilingSprite}
   */
  sprite;

  /**
   * @type {?Graphics}
   * The rotatable outline drawn behind the photo Sprite. Photo components only.
   * For non-photo components this is null; for photo components, rotation is
   * applied to this Graphics and never to `sprite` (which always stays upright).
   */
  photoGraphics;

  /**
   * @type {?ComponentGroup}
   */
  group;

  /**
   * @param {TrackData} baseData
   * @param {Pose} pose
   * @param {LayoutLayer} layer The layer this Component will be on
   * @param {ComponentOptions} [options={}] Options for the Component
   */
  constructor(baseData, pose, layer, options = {}) {
    super();

    /**
     * @type {TrackData}
     */
    this.baseData = baseData;

    /**
     * @type {LayoutLayer}
     */
    this.layer = layer;

    this.group = null;

    /**
     * @type {Boolean}
     */
    this.isDragging = false;

    this.#uuid = crypto.randomUUID();
    this.#locked = false;
    this.#flipped = false;

    if (this.baseData.type === DataTypes.TRACK) {
      if (this.baseData.onbp !== undefined && options.bpColor !== "") {
        this.#bpColor = new Color(options.bpColor ?? this.baseData.onbp);
      }
      if (this.#bpColor === undefined) {
        this.sprite = new Sprite(Assets.get(baseData.alias));
      } else {
        let tempTexture = Assets.get(baseData.alias);
        ({ width: this.#width, height: this.#height } = {...{width: tempTexture.width, height: tempTexture.height}, ...this.baseData});
        tempTexture = null;
        this.sprite = new Sprite(this._generateStructureOnBaseplateTexture());
      }
      this.sprite.anchor.set(0.5);
      if (this.baseData.color !== undefined) {
        this.#color = new Color(this.baseData.color);
      }
    } else if (this.baseData.type === DataTypes.SHAPE) {
      this.#color = new Color(options.color ?? this.baseData.color ?? 0xA0A5A9);
      ({ width: this.#width, height: this.#height } = {...this.baseData, ...options});
      this.#units = options.units ?? 'studs';
      this.#shape = options.shape ?? 'rectangle';
      if (this.#shape === 'circle') {
        this.#height = this.#width;
      }
      this.#outlineColor = undefined;
      if (options.outlineColor) {
        this.#outlineColor = new Color(options.outlineColor);
      }
      if (options.circlePercentage === null || options.circlePercentage === undefined) {
        this.#circlePercentage = null;
      } else {
        this.#circlePercentage = Math.min(Math.max(options.circlePercentage, 5), 95);
      }
      this.sprite = new Graphics();
      this._drawShape();
      if (options.opacity !== void 0) {
        this.#opacity = options.opacity;
        this.sprite.alpha = options.opacity;
      }
      this.sprite.pivot.set(0, 0);
    } else if (this.baseData.type === DataTypes.BASEPLATE) {
      this.#color = new Color(options.color ?? this.baseData.color ?? 0xA0A5A9);
      ({ width: this.#width, height: this.#height } = {...this.baseData, ...options});
      this.#units = 'studs';
      let plateTexture = this._generateBaseplateTexture();
      this.sprite = new Sprite(plateTexture);
      this.sprite.anchor.set(0.5);
    } else if (this.baseData.type === DataTypes.TILEABLE) {
      ({ width: this.#width, height: this.#height } = {...this.baseData, ...options});
      this.#units = 'studs';
      this.sprite = new TilingSprite({texture: Assets.get(this.baseData.alias), width: this.#width, height: this.#height});
      this.sprite.anchor.set(0.5);
    } else if (this.baseData.type === DataTypes.TEXT) {
      this.#color = new Color(options.color ?? this.baseData.color ?? 0xA0A5A9);
      this.#text = options.text ?? this.baseData.text ?? 'Text';
      this.#font = options.font ?? 'sans-serif';
      this.#fontSize = options.fontSize ?? 360;
      this.sprite = new BitmapText({
        text: this.#text,
        style: {
          fontFamily: this.#font,
          fontSize: this.#fontSize,
          fill: this.#color,
          align: 'center',
        },
      });
      this.sprite.anchor.set(0.5);
    } else if (this.baseData.type === DataTypes.PHOTO) {
      this.#text = options.text ?? '';
      this.#url = options.url ?? '';
      this.#width = 100;
      this.#height = 100;
      this.photoGraphics = new Graphics(Assets.get('photoOutlineSvg'));
      this.photoGraphics.pivot.set(50, 100);
      this.sprite = new Sprite(Assets.get(baseData.alias));
      this.sprite.anchor.set(0.5);
      this.sprite.setSize(50, 50);
      this.scale.set(8);
    } else {
      throw new Error(`Unsupported component type: ${this.baseData.type}`);
    }
    if (baseData.scale) {
      this.sprite.scale.set(baseData.scale);
    }

    if (this.baseData.type === DataTypes.PHOTO) {
      this.rotation = pose.angle;
      this.sprite.rotation = -pose.angle;
    } else {
      this.sprite.rotation = pose.angle;
    }
    this.position.set(pose.x, pose.y);
    let bbox = this._collisionLocalBounds();
    this.layer?.tree.insert({
      id: this.#uuid,
      minX: bbox.minX + pose.x,
      minY: bbox.minY + pose.y,
      maxX: bbox.maxX + pose.x,
      maxY: bbox.maxY + pose.y,
      component: this
    });
    if (this.photoGraphics) {
      this.addChild(this.photoGraphics);
      this.photoGraphics.eventMode = 'static';
      this.photoGraphics.on('pointerdown', this.onStartDrag, this);
      this.photoGraphics.on('click', Component.onClick, this);
      this.photoGraphics.on('tap', Component.onClick, this);
      let containSprite = new Container();
      containSprite.addChild(this.sprite);
      containSprite.pivot.set(0, 50);
      this.addChild(containSprite);
    } else {
      this.addChild(this.sprite);
    }

    this.sprite.eventMode = 'static';
    this.sprite.on('pointerdown', this.onStartDrag, this);
    this.sprite.on('click', Component.onClick, this);
    this.sprite.on('tap', Component.onClick, this);

    /**
     * @type {Array<Connection>}
     */
    this.connections = [];

    if (this.baseData.connections) {
      this.connections = this.baseData.connections.map((connection, index) => new Connection(this, connection.vector, connection.type, index, connection.next, connection.c !== void 0 ? connection.c === 1 : undefined));
    }
  }

  /**
   * 
   * @param {TrackData} baseData 
   * @param {Connection} connection 
   * @param {LayoutLayer} layer The layer this Component will be on
   * @param {ComponentOptions} [options={}] Options for the Component
   * @returns {Component}
   */
    static fromConnection(baseData, connection, layer, options = {}) {
      let conPose = connection.getPose();
      conPose.turnAngle(Math.PI);
      let conIndex = 0;
      if (connection.component.baseData.alias === baseData.alias
        || (CURVE_ALIASES.has(connection.component.baseData.alias) && CURVE_ALIASES.has(baseData.alias))
      ) {
        conIndex = connection.nextConnectionIndex;
        // XOR
        if ((baseData.alias !== "railCurved9V") !== (connection.component.baseData.alias !== "railCurved9V")) {
          conIndex = (conIndex === 1 ? 0 : 1);
        }
      } else if (connection.curveRight !== void 0 && CURVE_ALIASES.has(baseData.alias)) {
        if (connection.curveRight) {
          conIndex = 1;
        }
        if (baseData.alias === "railCurved9V") {
          conIndex = (conIndex === 1 ? 0 : 1);
        }
      }
      /** @type {Pose} */
      var newPos = baseData.connections[conIndex].vector.getStartPosition(conPose);
      newPos.x = Math.fround(newPos.x);
      newPos.y = Math.fround(newPos.y);
      var newComp = new Component(baseData, newPos, layer, options);
      newComp.connections[conIndex].connectTo(connection);
      return newComp;
    }

  /**
   * 
   * @param {TrackData} baseData 
   * @param {Component} component The Component to connect to
   * @param {LayoutLayer} layer The layer this Component will be on
   * @param {ComponentOptions} [options={}] Options for the Component
   * @returns {Component|null} The new Component or null if no open connections found
   */
  static fromComponent(baseData, component, layer, options = {}) {
    if (Array.from(component.connections.values()).length === 0 || (baseData.connections ?? []).length === 0) {
      // Calculate a position that is next to the component instead.
      let width = baseData.width ?? 0;
      // Helper to calculate the position vector for a new component next to another
      function calculateNextToPosition(component, width) {
        let vec = new PolarVector((component.sprite.width / 2) + (width / 2), 0, 0);
        return vec.getEndPosition(component.getPose());
      }
      let newPos = calculateNextToPosition(component, width);
      const newComp = new Component(baseData, newPos, layer, options);
      if (width === 0) {
        width = newComp.sprite.width;
        newPos = calculateNextToPosition(component, width);
        newComp.deleteCollisionTree();
        newComp.position.set(Math.fround(newPos.x), Math.fround(newPos.y));
        newComp.insertCollisionTree();
      }
      return newComp;
    }
    var connection = component.getOpenConnection();
    if (connection) {
      if (baseData.alias === "r104" && component.baseData.alias.startsWith("r104Switch") && connection.connectionIndex === 2) {
        const r104bData = LayoutController.getInstance().trackData.bundles[0].assets.find((a) => a.alias === "r104b");
        if (r104bData) {
          baseData = r104bData;
        }
      }
      return Component.fromConnection(baseData, connection, layer, options);
    }
    return null;
  }

  /**
   * Clone the component.
   * @param {LayoutLayer} layer The layer to clone the component to.
   * @param {Component} [connectTo] The component to connect to.
   * @returns {Component} The cloned component.
   */
  clone(layer, connectTo = null) {
    /** @type {ComponentOptions} */
    let options = {
      width: this.#width,
      height: this.#height,
      units: this.#units,
      shape: this.#shape,
      color: this.#color?.toHex(),
      outlineColor: this.#outlineColor?.toHex(),
      opacity: this.#opacity,
      text: this.#text,
      font: this.#font,
      fontSize: this.#fontSize,
      circlePercentage: this.#circlePercentage,
    };
    if (this.baseData.type === DataTypes.PHOTO) {
      options.url = this.#url;
    }
    if (this.baseData.onbp !== undefined) {
      options.bpColor = this.#bpColor?.toHex() ?? "";
      delete options.width;
      delete options.height;
    }
    if (connectTo) {
      let newComp = Component.fromComponent(this.baseData, connectTo, layer, options);
      if (newComp) {
        if (this.#flipped && newComp.canFlip()) {
          newComp.flipped = true;
        }
        return newComp;
      }
    }
    let newComp = new Component(this.baseData, this.getPose(), layer, options);
    if (this.#flipped && newComp.canFlip()) {
      newComp.flipped = true;
    }
    return newComp;
  }

  destroy() {
    this.dragStartConnection = null;
    if (this.group) {
      this.group.removeComponent(this);
    }
    this.group = null;
    this.connections.forEach((connection) => connection.destroy());
    this.connections = null;
    let bbox = this._collisionLocalBounds();
    let item = {
      id: this.#uuid,
      minX: bbox.minX + this.position.x,
      minY: bbox.minY + this.position.y,
      maxX: bbox.maxX + this.position.x,
      maxY: bbox.maxY + this.position.y
    };
    this.layer?.tree.remove(item, (a,b) => {return a.id === b.id});
    bbox = null;
    item = null;
    this.layer = null;
    if (this.baseData.type === DataTypes.SHAPE) {
      this.sprite.destroy();
    }
    if (this.baseData.type === DataTypes.PHOTO) {
      this.photoGraphics?.destroy();
      this.photoGraphics = null;
    }
    super.destroy();
    this.baseData = null;
  }

  /**
   * Swaps this component to a different track variant by updating baseData, sprite, and connections.
   * Used for swapping between r104a and r104b when connected to r104 switches.
   * @param {TrackData} newBaseData The new track data to swap to
   * @private
   */
  _swapToTrackVariant(newBaseData) {
    if (!newBaseData || !newBaseData.connections || newBaseData.connections.length !== this.connections.length) {
      return;
    }

    this.baseData = newBaseData;
    this.sprite.texture = Assets.get(newBaseData.alias);

    // Update each connection's offsetVector to match the new baseData
    this.connections.forEach((connection, index) => {
      const newVector = newBaseData.connections[index].vector;
      connection.offsetVector = newVector;
    });
  }

  /**
   * Get position as a Pose
  /**
   * Get position as a Pose
   * @returns {Pose}
   */
  getPose() {
    const angle = this.baseData?.type === DataTypes.PHOTO ? this.rotation : this.sprite.rotation;
    return new Pose(this.x, this.y, angle);
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
    if (openConnections.length === 0) {
      return null;
    }
    let returnConnection = openConnections.find((conn) => conn.connectionIndex >= startIndex);
    return returnConnection || openConnections[0];
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

  /**
   * Checks if this component can be rotated.
   * @returns {Boolean} True if this component can be rotated, false otherwise
   */
  canRotate() {
    const currentConnections = this.getUsedConnections();
    return currentConnections.length <= 1;
  }

  /**
   * Checks if this component can be flipped horizontally.
   * Only components in the "structures" category support flipping.
   * @returns {Boolean} True if this component can be flipped, false otherwise
   */
  canFlip() {
    return this.baseData?.category === 'structures';
  }

  /**
   * Rotate this component.
   * Checks for open connections and rotates accordingly.
   * @param {Number} [angle] The angle to rotate by in radians. Defaults to PI/8.
   */
  rotate(angle = Math.PI / 8) {
    if (this.#locked) {
      return;
    }
    const currentConnections = this.getUsedConnections();
    if (currentConnections.length > 1) {
      return;
    } else if (currentConnections.length === 0) {
      this.deleteCollisionTree();
      if (this.baseData.type === DataTypes.PHOTO) {
        this.rotation += angle;
        this.sprite.rotation = -this.rotation;
      } else {
        this.sprite.rotation += angle;
      }
      if (!this.isDragging) {
        this.insertCollisionTree();
      }
    } else if (currentConnections.length === 1) {
      const connection = currentConnections[0];
      const otherConnection = connection.otherConnection;
      const nextOpen = this.getOpenConnection(connection.connectionIndex + 1);
      if (!nextOpen) {
        return;
      }

      // Swap r104a/r104b when connected to an r104 switch
      const otherAlias = otherConnection.component.baseData.alias;
      if (otherAlias.startsWith('r104Switch')) {
        if (this.baseData.alias === 'r104a') {
          const r104bData = LayoutController.getInstance().trackData.bundles[0].assets.find((a) => a.alias === 'r104b');
          if (r104bData) {
            this._swapToTrackVariant(r104bData);
          }
        } else if (this.baseData.alias === 'r104b') {
          const r104aData = LayoutController.getInstance().trackData.bundles[0].assets.find((a) => a.alias === 'r104a');
          if (r104aData) {
            this._swapToTrackVariant(r104aData);
          }
        }
      }

      connection.disconnect();
      nextOpen.connectTo(otherConnection);

      let conPose = otherConnection.getPose();
      conPose.turnAngle(Math.PI);
      let newPos = nextOpen.offsetVector.getStartPosition(conPose);
      this.deleteCollisionTree();
      this.position.set(Math.fround(newPos.x), Math.fround(newPos.y));
      this.sprite.rotation = newPos.angle;
      if (!this.isDragging) {
        this.insertCollisionTree();
      }
    }
    let openConnections = this.getOpenConnections();
    if (openConnections.length > 0) {
      openConnections.forEach((openCon) => {
        this.layer.findMatchingConnection(openCon, true);
      });
    }
    this.connections.forEach((connection) => {
      connection.updateCircle();
    });
  }

  _drawShape() {
    this.sprite.clear();
    if (this.#shape === 'circle') {
      if (this.#circlePercentage !== null && this.#circlePercentage !== undefined) {
        this.sprite.arc(0, 0, this.#width / 2, 0, (2 * Math.PI) * (this.#circlePercentage / 100), false).lineTo(0, 0);
      } else {
        this.sprite.circle(0, 0, this.#width / 2);
      }
    } else {
      this.sprite.rect(0 - this.#width / 2, 0 - this.#height / 2, this.#width, this.#height);
    }
    this.sprite.fill(this.#color);
    if (this.#outlineColor) {
      this.sprite.stroke({width: 8, alignment: 1, color: this.#outlineColor});
    }
  }

  /**
   * Generates the texture for the baseplate.
   * @returns {Texture} The generated baseplate texture.
   */
  _generateBaseplateTexture() {
    /** @type {Texture} */
    let plateTexture = undefined;
    let plateAlias = `baseplate-${this.#width}x${this.#height}-${this.#color.toHex()}`;
    if (Assets.cache.has(plateAlias)) {
      plateTexture = Assets.get(plateAlias);
    } else {
      let tempSprite = new TilingSprite({
        texture: Assets.get("baseplate"),
        width: this.#width,
        height: this.#height
      });
      if (this.#color.toYiq() < 92) {
        // If the color is dark, we need to lighten the baseplate texture
        const filter = new ColorMatrixFilter();
        filter.negative(true);
        tempSprite.filters = [filter];
      }
      plateTexture = LayoutController.getInstance().app.renderer.extract.texture({target: tempSprite, clearColor: this.#color});
      Assets.cache.set(plateAlias, plateTexture);
      tempSprite.destroy();
      tempSprite = null;
    }
    return plateTexture;
  }

  /**
   * Generates the texture for a structure that is designed to be placed on a baseplate.
   * @returns {Texture} The generated texture for the structure on a baseplate
   */
  _generateStructureOnBaseplateTexture() {
    /** @type {Texture} */
    let structureTexture = undefined;
    let structureAlias = `${this.baseData.alias}-${this.#bpColor.toHex()}`;
    if (Assets.cache.has(structureAlias)) {
      structureTexture = Assets.get(structureAlias);
    } else {
      let tempContainer = new Container();
      let bpSprite = new TilingSprite({
        texture: Assets.get("baseplate"),
        width: this.#width,
        height: this.#height
      });
      if (this.#bpColor.toYiq() < 92) {
        // If the color is dark, we invert the stud color in the baseplate texture
        const filter = new ColorMatrixFilter();
        filter.negative(true);
        bpSprite.filters = [filter];
      }
      let tempSprite = new Sprite(Assets.get(this.baseData.alias));
      tempContainer.addChild(bpSprite);
      tempContainer.addChild(tempSprite);
      structureTexture = LayoutController.getInstance().app.renderer.extract.texture({target: tempContainer, clearColor: this.#bpColor});
      Assets.cache.set(structureAlias, structureTexture);
      tempSprite.destroy();
      bpSprite.destroy();
      tempContainer.destroy();
      tempSprite = null;
      bpSprite = null;
      tempContainer = null;
    }
    return structureTexture;
  }

  /**
   * Get the color of the baseplate this Component is designed to be placed on, if applicable.
   * @returns {?String} The color of the baseplate this Component is designed to be placed on, or null if not applicable
   */
  get baseplateColor() {
    return this.#bpColor?.toHex();
  }

  /**
   * Set the color of the baseplate this Component is designed to be placed on.
   * Note: This only applies to components that are designed to be placed on a baseplate. Setting this for other components or for tracks that don't specify a baseplate color will have no effect.
   * @param {?String} value The new color of the baseplate to set, or null to unset
   */
  set baseplateColor(value) {
    if (this.baseData.type !== DataTypes.TRACK || this.#bpColor?.toHex() === value) {
      return;
    }
    let tempTexture = Assets.get(this.baseData.alias);
    if (value !== void 0 && value !== '') {
      this.#bpColor = new Color(value);
      ({ width: this.#width, height: this.#height } = {...{width: tempTexture.width, height: tempTexture.height}, ...this.baseData});
      this.sprite.texture = this._generateStructureOnBaseplateTexture();
    } else {
      this.#bpColor = undefined;
      this.sprite.texture = tempTexture;
    }
    tempTexture = null;
  }

  /**
   * Get the color of this Component.
   * @returns {String} The color of this Component
   */
  get color() {
    return this.#color?.toHex();
  }

  /**
   * Set the color of this Component.
   * @param {String} value The new color to set
   */
  set color(value) {
    this.#color = new Color(value ?? this.baseData.color ?? 0xA0A5A9);
    if (this.baseData.type === DataTypes.SHAPE) {
      this._drawShape();
    } else if (this.baseData.type === DataTypes.TEXT) {
      this.sprite.style.fill = this.#color;
    } else if (this.baseData.type === DataTypes.BASEPLATE) {
      this.sprite.texture = this._generateBaseplateTexture();
    }
  }

  /**
   * Get the width of this Component.
   * @returns {Number} The width of this Component in pixels.
   */
  get componentWidth() {
    return this.#width;
  }

  /**
   * Get the height of this Component.
   * @returns {Number} The height of this Component in pixels.
   */
  get componentHeight() {
    return this.#height;
  }

  resize(width, height, units = 'studs') {
    this.#width = width;
    this.#height = height;
    this.#units = units;
    if (this.baseData.type === DataTypes.BASEPLATE) {
      this.sprite.texture = this._generateBaseplateTexture();
    } else if (this.baseData.type === DataTypes.SHAPE) {
      this._drawShape();
      this.sprite.pivot.set(0, 0);
      if (this.#shape === 'circle') {
        this.#height = this.#width;
      }
    } else if (this.baseData.type === DataTypes.TILEABLE) {
      this.sprite.width = width;
      this.sprite.height = height;
    }
  }

  get font() {
    return this.#font;
  }

  /**
   * Set the font for this Component.
   * @param {String} value The new font to set
   */
  set font(value) {
    if (this.baseData.type !== DataTypes.TEXT) {
      return;
    }
    this.#font = value;
    this.sprite.style.fontFamily = value;
  }

  get fontSize() {
    return this.#fontSize;
  }

  /**
   * Set the font size for this Component.
   * @param {Number} value The new font size to set
   */
  set fontSize(value) {
    if (this.baseData.type !== DataTypes.TEXT) {
      return;
    }
    this.#fontSize = value;
    this.sprite.style.fontSize = value;
  }

  /**
   * Get the opacity of this Component.
   * @returns {Number} The opacity of this Component
   */
  get opacity() {
    return this.#opacity;
  }

  set opacity(value) {
    if (this.baseData.type !== DataTypes.SHAPE || this.#opacity === value) {
      return;
    }
    this.#opacity = Math.min(Math.max(value, 0), 1);
    this.sprite.alpha = this.#opacity;
  }

  /**
   * Get the outline color of this Component.
   * @returns {?String} The outline color of this Component
   */
  get outlineColor() {
    return this.#outlineColor?.toHex();
  }

  /**
   * Set the outline color of this Component.
   * @param {?String} value The new outline color to set
   */
  set outlineColor(value) {
    if (this.baseData.type !== DataTypes.SHAPE || this.#outlineColor?.toHex() === value) {
      return;
    }
    if (value === undefined || value === null || value === '') {
      this.#outlineColor = undefined;
    } else {
      this.#outlineColor = new Color(value);
    }
    this._drawShape();
  }

  get shape() {
    return this.#shape;
  }

  get size() {
    return 1;
  }

  get text() {
    return this.#text;
  }

  /**
   * Set the text for this Component.
   * @param {String} value The new text to set
   */
  set text(value) {
    if (this.baseData.type === DataTypes.TEXT) {
      this.#text = value;
      this.sprite.text = value;
    } else if (this.baseData.type === DataTypes.PHOTO) {
      this.#text = value;
    }
  }

  /**
   * Get the URL of this photo Component.
   * @returns {?String} The URL of this photo Component
   */
  get url() {
    return this.#url;
  }

  /**
   * Set the URL of this photo Component.
   * @param {String} value The new URL to set
   */
  set url(value) {
    if (this.baseData.type !== DataTypes.PHOTO) {
      return;
    }
    this.#url = value ?? '';
  }

  get units() {
    return this.#units;
  }

  get uuid() {
    return this.#uuid;
  }

  /**
   * Get the locked state of this Component.
   * @returns {Boolean} True if this Component is locked, false otherwise
   */
  get locked() {
    return this.#locked;
  }

  /**
   * Set the locked state of this Component.
   * @param {Boolean} value The new locked state to set
   */
  set locked(value) {
    this.#locked = Boolean(value);
  }

  /**
   * Get the flipped state of this Component.
   * @returns {Boolean} True if this Component is horizontally flipped, false otherwise
   */
  get flipped() {
    return this.#flipped;
  }

  /**
   * Set the flipped state of this Component. When the value changes,
   * `sprite.scale.x` is negated to visually mirror the sprite horizontally.
   * `sprite.scale.y` is never modified.
   * @param {Boolean} value The new flipped state to set
   */
  set flipped(value) {
    const next = Boolean(value);
    if (next === this.#flipped) return;
    this.#flipped = next;
    if (this.sprite && this.sprite.scale) {
      this.sprite.scale.x = -this.sprite.scale.x;
    }
  }

  /**
   * Get the circle percentage of this Component.
   * @returns {?Number} The circle percentage of this Component
   */
  get circlePercentage() {
    return this.#circlePercentage;
  }

  /**
   * Set the circle percentage of this Component.
   * @param {?Number} value The new circle percentage to set (5-95, or null for full circle)
   */
  set circlePercentage(value) {
    if (this.baseData.type !== DataTypes.SHAPE || this.#shape !== 'circle') {
      return;
    }
    if (value === null || value === undefined) {
      this.#circlePercentage = null;
    } else {
      this.#circlePercentage = Math.min(Math.max(value, 5), 95);
    }
    this._drawShape();
  }

  /**
   * Compute the collision-tree bbox for this component in its local space.
   * Photo components use a fixed 100x100 box centered on position; everything
   * else uses the sprite's local bounds.
   * @returns {{minX: Number, minY: Number, maxX: Number, maxY: Number}}
   * @private
   */
  _collisionLocalBounds() {
    if (this.baseData.type === DataTypes.PHOTO) {
      return { minX: -50, minY: -50, maxX: 50, maxY: 50 };
    }
    return this.sprite.getLocalBounds();
  }

  /**
   * Remove this Component from the collision tree.
   */
  deleteCollisionTree() {
    let bbox = this._collisionLocalBounds();
    let item = {
      id: this.#uuid,
      minX: bbox.minX + this.position.x,
      minY: bbox.minY + this.position.y,
      maxX: bbox.maxX + this.position.x,
      maxY: bbox.maxY + this.position.y,
      component: this
    };
    this.layer.tree.remove(item, (a,b) => {return a.id === b.id});
  }

  /**
   * Insert this Component into the collision tree.
   */
  insertCollisionTree() {
    let bbox = this._collisionLocalBounds();
    let item = {
      id: this.#uuid,
      minX: bbox.minX + this.position.x,
      minY: bbox.minY + this.position.y,
      maxX: bbox.maxX + this.position.x,
      maxY: bbox.maxY + this.position.y,
      component: this
    };
    this.layer.tree.insert(item);
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
    /** @type {ComponentOptions} */
    var options = {};
    if (data.width !== undefined) {
      options.width = data.width;
    }
    if (data.height !== undefined) {
      options.height = data.height;
    }
    if (data.units !== undefined) {
      options.units = data.units;
    }
    if (data.shape !== undefined) {
      options.shape = data.shape;
    }
    if (data.color !== undefined) {
      options.color = data.color;
    }
    if (data.outline_color !== undefined) {
      options.outlineColor = data.outline_color;
    }
    if (data.opacity !== undefined) {
      options.opacity = data.opacity;
    }
    if (data.text !== undefined) {
      options.text = data.text;
    }
    if (data.url !== undefined) {
      options.url = data.url;
    }
    if (data.font !== undefined) {
      options.font = data.font;
    }
    if (data.font_size !== undefined) {
      options.fontSize = data.font_size;
    }
    if (data.circle_percentage !== undefined) {
      options.circlePercentage = data.circle_percentage;
    }
    if (data.bp_color !== undefined) {
      options.bpColor = data.bp_color;
    }
    const newComponent = new Component(baseData, Pose.deserialize(data.pose), layer, options);
    data.connections.forEach((connectionData, index) => {
      newComponent.connections[index].deserialize(connectionData);
    });

    if (data.group && layer) {
      const groupLookupMap = layer.getGroupLookupMap();
      if (groupLookupMap) {
        const group = groupLookupMap.get(data.group);
        if (group) {
          group.addComponent(newComponent);
        } else {
          console.warn(`Component ${newComponent.uuid} references missing group ${data.group}, treating as ungrouped`);
        }
      }
    }

    if (data?.locked === 1) {
      newComponent.locked = true;
    }

    if (data?.flip === 1 && newComponent.canFlip()) {
      newComponent.flipped = true;
    }

    return newComponent;
  }

  /**
   * 
   * @returns {SerializedComponent}
   */
  serialize() {
    const serialized = {
      type: this.baseData.alias,
      pose: this.getPose().serialize(),
      connections: this.connections.map((connection) => connection.serialize()),
      width: this.#width,
      height: this.#height,
      units: this.#units,
      shape: this.#shape,
      color: this.#color?.toHex(),
      outline_color: this.#outlineColor?.toHex(),
      opacity: this.#opacity,
      text: this.#text,
      font: this.#font,
      font_size: this.#fontSize
    };

    if (this.baseData.type === DataTypes.PHOTO) {
      serialized.url = this.#url ?? '';
    }

    if (this.#circlePercentage !== null && this.#circlePercentage !== undefined) {
      serialized.circle_percentage = this.#circlePercentage;
    }

    if (this.baseData.onbp !== undefined) {
      delete serialized.width;
      delete serialized.height;
    }

    if (this.#bpColor !== undefined) {
      serialized.bp_color = this.#bpColor.toHex();
    } else if (this.baseData.onbp !== undefined) {
      serialized.bp_color = '';
    }

    if (this.group && !this.group.isTemporary) {
      serialized.group = this.group.uuid;
    }

    if (this.#locked) {
      serialized.locked = 1;
    }

    if (this.#flipped && this.canFlip()) {
      serialized.flip = 1;
    }

    return serialized;
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
      data?.type ? (LayoutController._instance?.trackData?.bundles[0].assets.some(a => a.alias === data.type) ?? Assets.get(data.type)) : false,
      data?.pose,
      Pose._validateImportData(data?.pose),
      data?.connections,
      Array.isArray(data?.connections),
      data?.connections?.every?.((connection) => Connection._validateImportData(connection)),
      data?.width === undefined || (typeof data?.width === 'number' && data?.width > 0),
      data?.height === undefined || (typeof data?.height === 'number' && data?.height > 0),
      data?.units === undefined || (typeof data?.units === 'string' && data?.units.length > 0),
      data?.type !== "baseplate" || data?.units === "studs",
      data?.type !== "shape" || data?.units !== undefined,
      data?.shape === undefined || (typeof data?.shape === 'string' && ['rectangle', 'circle'].includes(data?.shape)),
      data?.color === undefined || (typeof data?.color === 'string' && /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(data?.color)),
      data?.outline_color === undefined || (typeof data?.outline_color === 'string' && /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(data?.outline_color)),
      data?.text === undefined || (typeof data?.text === 'string' && (data?.text.length > 0 || data?.type === 'photo')),
      data?.font === undefined || (typeof data?.font === 'string' && data?.font.length > 0),
      data?.font_size === undefined || (typeof data?.font_size === 'number' && data?.font_size > 0),
      data?.opacity === undefined || (typeof data?.opacity === 'number' && data?.opacity >= 0 && data?.opacity <= 1),
      data?.group === undefined || (typeof data?.group === 'string' && data?.group.length > 0),
      data?.circle_percentage === undefined || (typeof data?.circle_percentage === 'number' && data?.circle_percentage >= 5 && data?.circle_percentage <= 95),
      data?.locked === undefined || data?.locked === 1,
      data?.flip === undefined || data?.flip === 1,
      data?.url === undefined || typeof data?.url === 'string'
    ];
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
      if (this.group && !this.group.isTemporary) {
        LayoutController.selectComponent(this.group);
      } else {
        LayoutController.selectComponent(this);
      }
    }
    this.isDragging = false;
  }

  /**
   * 
   * @param {FederatedPointerEvent} e 
   */
  onStartDrag(e) {
    if (this.#locked) {
      return;
    }
    if (e.button != 0 || !e.nativeEvent.isPrimary || LayoutController._instance.isSpaceDown) {
      return;
    }
    if (LayoutController.getInstance().readOnly) {
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
    } else if (this.baseData.type === DataTypes.TRACK) {
      // Set the drag start to the top left of the track
      this.dragStartPos = this.getPose().subtract({x: this.width / 2, y: this.height / 2, angle: 0}).subtract({...a, angle: 0});
      this.dragStartOffset = new Pose(this.width / 2, this.height / 2, 0);
    } else if (this.baseData.type === DataTypes.BASEPLATE) {
      // Set the drag start to the upper left corner of the baseplate
      this.dragStartPos = this.getPose().subtract({x: this.#width / 2, y: this.#height / 2, angle: 0}).subtract({...a, angle: 0});
      this.dragStartOffset = new Pose(this.#width / 2, this.#height / 2, 0);
    } else {
      // If we didn't find a connection, set the drag start position to the Component's pose
      this.dragStartPos = this.getPose().subtract({...a, angle: 0});
      this.dragStartOffset = new Pose(0, 0, 0);
    }
    this.deleteCollisionTree();
    window.app.stage.on('pointermove', LayoutController.onDragMove);
    window.app.stage.on('pointerupoutside', LayoutController.onDragEnd);
    console.log(this.baseData.alias);
    e.stopImmediatePropagation();
  }
}
