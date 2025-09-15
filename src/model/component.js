import { Assets, BitmapText, Color, ColorMatrixFilter, Container, FederatedPointerEvent, Graphics, Sprite, TilingSprite } from "../pixi.mjs";
import { LayoutController, TrackData, DataTypes } from '../controller/layoutController.js';
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
 * @property {String} color The color of the component
 * @property {String} [outline_color] The color of the outline, if applicable
 * @property {Number} [opacity] The opacity of the component, if applicable
 * @property {String} [text] The text to display on the component, if applicable
 * @property {String} [font] The font to use for the text, if applicable
 * @property {Number} [font_size] The font size to use for the text, if applicable
 */
let SerializedComponent;
export { SerializedComponent };

/**
 * @typedef {Object} ComponentOptions
 * @property {number} width The width of the component
 * @property {number} height The height of the component
 * @property {string} units The units that the component is measured in (e.g., "studs", "inches", "feet")
 * @property {string} color The color of the component
 * @property {string} outlineColor The color of the outline
 * @property {number} opacity The opacity of the component
 * @property {string} text The text to display on the component
 * @property {string} font The font to use for the text
 * @property {number} fontSize The font size to use for the text
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
  "olive green": "#ABA953",
  lime: "#BBE90B",
  yellow: "#F2CD37",
  orange: "#FE8A18",
  brown: "#582A12",
  "dark red": "#720E0F",
  "dark green": "#184632",
  "light bluish gray": "#A0A5A9",
  "dark bluish gray": "#6C6E68",
});

/**
 * A read-only map from hex value to color name.
 * Keys are lowercase hex values like "#237841"
 * @type {Readonly<Record<string, string>>}
 * @see ColorNameToHex
 */
export const HexToColorName = Object.freeze(Object.fromEntries(Object.entries(ColorNameToHex).map(([name, hex]) => [hex.toLowerCase(), name])));

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
   * @type {Number}
   * The opacity of the component, if applicable.
   * This is used for shapes components only.
   */
  #opacity;

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

    /**
     * @type {Boolean}
     */
    this.isDragging = false;

    if (this.baseData.type === DataTypes.TRACK) {
      this.sprite = new Sprite(Assets.get(baseData.alias));
      this.sprite.anchor.set(0.5);
    } else if (this.baseData.type === DataTypes.SHAPE) {
      this.#color = new Color(options.color ?? this.baseData.color ?? 0xA0A5A9);
      ({ width: this.#width, height: this.#height } = {...this.baseData, ...options});
      this.#units = options.units ?? 'studs';
      this.#outlineColor = undefined;
      if (options.outlineColor) {
        this.#outlineColor = new Color(options.outlineColor);
      }
      this.sprite = new Graphics();
      this._drawShape();
      if (options.opacity !== void 0) {
        this.#opacity = options.opacity;
        this.sprite.alpha = options.opacity;
      }
      this.sprite.pivot.set(this.#width / 2, this.#height / 2);
    } else if (this.baseData.type === DataTypes.BASEPLATE) {
      this.#color = new Color(options.color ?? this.baseData.color ?? 0xA0A5A9);
      ({ width: this.#width, height: this.#height } = {...this.baseData, ...options});
      this.#units = 'studs';
      let plateTexture = this._generateBaseplateTexture();
      this.sprite = new Sprite(plateTexture);
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
    }
    if (baseData.scale) {
      this.sprite.scale.set(baseData.scale);
    }

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
   * @param {ComponentOptions} [options={}] Options for the Component
   * @returns {Component}
   */
    static fromConnection(baseData, connection, layer, options = {}) {
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
    var connection = component.getOpenConnection();
    if (connection) {
      return Component.fromConnection(baseData, connection, layer, options);
    }
    if (component.connections.length === 0) {
      // Calculate a position that is next to the component instead.
      const vec = new PolarVector(component.sprite.width, 0, 0);
      let newPos = vec.getEndPosition(component.getPose());
      return new Component(baseData, newPos, layer, options);
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
      color: this.#color?.toHex(),
      outlineColor: this.#outlineColor?.toHex(),
      opacity: this.#opacity,
      text: this.#text,
      font: this.#font,
      fontSize: this.#fontSize
    };
    if (connectTo) {
      let newComp = Component.fromComponent(this.baseData, connectTo, layer, options);
      if (newComp) {
        return newComp;
      }
    }
    let newComp = new Component(this.baseData, this.getPose(), layer, options);
    return newComp;
  }

  destroy() {
    this.dragStartConnection = null;
    this.connections.forEach((connection) => connection.destroy());
    this.connections = null;
    this.layer = null;
    if (this.baseData.type === DataTypes.SHAPE) {
      this.sprite.destroy();
    }
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

  /**
   * Checks if this component can be rotated.
   * @returns {Boolean} True if this component can be rotated, false otherwise
   */
  canRotate() {
    const currentConnections = this.getUsedConnections();
    return currentConnections.length <= 1;
  }

  /**
   * Rotate this component.
   * Checks for open connections and rotates accordingly.
   */
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
        this.layer.findMatchingConnection(openCon, true);
      });
    }
    this.connections.forEach((connection) => {
      connection.updateCircle();
    });
  }

  _drawShape() {
    this.sprite.clear();
    this.sprite.rect(0, 0, this.#width, this.#height);
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

  get text() {
    return this.#text;
  }

  /**
   * Set the text for this Component.
   * @param {String} value The new text to set
   */
  set text(value) {
    if (this.baseData.type !== DataTypes.TEXT) {
      return;
    }
    this.#text = value;
    this.sprite.text = value;
  }

  get units() {
    return this.#units;
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
    if (data.font !== undefined) {
      options.font = data.font;
    }
    if (data.font_size !== undefined) {
      options.fontSize = data.font_size;
    }
    const newComponent = new Component(baseData, Pose.deserialize(data.pose), layer, options);
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
      connections: this.connections.map((connection) => connection.serialize()),
      width: this.#width,
      height: this.#height,
      units: this.#units,
      color: this.#color?.toHex(),
      outline_color: this.#outlineColor?.toHex(),
      opacity: this.#opacity,
      text: this.#text,
      font: this.#font,
      font_size: this.#fontSize
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
      data?.connections?.every?.((connection) => Connection._validateImportData(connection)),
      data?.width === undefined || (typeof data?.width === 'number' && data?.width > 0),
      data?.height === undefined || (typeof data?.height === 'number' && data?.height > 0),
      data?.units === undefined || (typeof data?.units === 'string' && data?.units.length > 0),
      data?.type !== "baseplate" || data?.units === "studs",
      data?.type !== "shape" || data?.units !== undefined,
      data?.color === undefined || (typeof data?.color === 'string' && /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(data?.color)),
      data?.outline_color === undefined || (typeof data?.outline_color === 'string' && /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(data?.outline_color)),
      data?.text === undefined || (typeof data?.text === 'string' && data?.text.length > 0),
      data?.font === undefined || (typeof data?.font === 'string' && data?.font.length > 0),
      data?.font_size === undefined || (typeof data?.font_size === 'number' && data?.font_size > 0),
      data?.opacity === undefined || (typeof data?.opacity === 'number' && data?.opacity >= 0 && data?.opacity <= 1)
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
    if (e.button != 0 || !e.nativeEvent.isPrimary || LayoutController._instance.isSpaceDown) {
      return;
    }
    LayoutController.dragTarget = this;
    LayoutController.dragDistance = 0;
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
    window.app.stage.on('pointermove', LayoutController.onDragMove);
    window.app.stage.on('pointerupoutside', LayoutController.onDragEnd);
    console.log(this.baseData.alias);
    e.stopImmediatePropagation();
  }
}