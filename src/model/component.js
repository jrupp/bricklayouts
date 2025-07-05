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
 * @property {String} [color] The color of the component, if applicable
 * @property {String} [outline_color] The color of the outline, if applicable
 * @property {Number} [opacity] The opacity of the component, if applicable
 * @property {String} [text] The text to display on the component, if applicable
 * @property {String} [font] The font to use for the text, if applicable
 * @property {Number} [fontSize] The font size to use for the text, if applicable
 */
let SerializedComponent;
export { SerializedComponent };

/**
 * @typedef {Object} ComponentOptions
 * @property {number} width The width of the component
 * @property {number} height The height of the component
 * @property {string} color The color of the component
 * @property {string} outlineColor The color of the outline
 * @property {number} opacity The opacity of the component
 * @property {string} text The text to display on the component
 * @property {string} font The font to use for the text
 * @property {number} fontSize The font size to use for the text
 */
let ComponentOptions;
export { ComponentOptions };

export class Component extends Container {
  /** @type {Color} */
  #color;

  /**
   * @type {String}
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
      this.sprite = new Graphics();
      this.sprite.rect(0, 0, this.#width, this.#height);
      this.sprite.fill(this.#color);
      if (options.outlineColor) {
        // @todo Alignment should be 0, but there is a bug in PixiJS that causes the outline to be misaligned
        // See: {@link https://github.com/pixijs/pixijs/issues/11494}
        this.#outlineColor = new Color(options.outlineColor);
        this.sprite.stroke({width: 8, alignment: 1, color: options.outlineColor});
      }
      if (options.opacity !== void 0) {
        this.#opacity = options.opacity;
        this.sprite.alpha = options.opacity;
      }
      this.sprite.pivot.set(this.#width / 2, this.#height / 2);
    } else if (this.baseData.type === DataTypes.BASEPLATE) {
      /** @type {Texture} */
      let plateTexture = undefined;
      this.#color = new Color(options.color ?? this.baseData.color ?? 0xA0A5A9);
      ({ width: this.#width, height: this.#height } = {...this.baseData, ...options});
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
    /** @type {ComponentOptions} */
    var options = {};
    if (data.width !== undefined) {
      options.width = data.width;
    }
    if (data.height !== undefined) {
      options.height = data.height;
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
    if (data.fontSize !== undefined) {
      options.fontSize = data.fontSize;
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
      color: this.#color?.toHex(),
      outline_color: this.#outlineColor?.toHex(),
      opacity: this.#opacity,
      text: this.#text,
      font: this.#font,
      fontSize: this.#fontSize
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
      data?.color === undefined || (typeof data?.color === 'string' && /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(data?.color)),
      data?.outline_color === undefined || (typeof data?.outline_color === 'string' && /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(data?.outline_color)),
      data?.text === undefined || (typeof data?.text === 'string' && data?.text.length > 0),
      data?.font === undefined || (typeof data?.font === 'string' && data?.font.length > 0),
      data?.fontSize === undefined || (typeof data?.fontSize === 'number' && data?.fontSize > 0),
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