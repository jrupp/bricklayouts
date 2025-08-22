import { Assets, Application, Bounds, Container, FederatedPointerEvent, FederatedWheelEvent, Graphics, path, Point, Texture } from '../pixi.mjs';
import { Component, ComponentOptions, HexToColorName } from '../model/component.js';
import { Configuration, SerializedConfiguration } from '../model/configuration.js';
import { Connection } from '../model/connection.js';
import { LayoutLayer, SerializedLayoutLayer } from '../model/layoutLayer.js';
import { PolarVector } from '../model/polarVector.js';
import { getOptionIndexByValue } from '../utils/utils.js';
import '../FileSaver.min.js';


/**
 * @typedef {Object} ConnectionData
 * @property {Number} type
 * @property {PolarVector} vector
 * @property {Number} next
 */
let ConnectionData;
export { ConnectionData };

/**
 * Types of Track Data.
 * @readonly
 * @enum {String}
 */
const DataTypes = Object.freeze({
  /** Represents a track component. */
  TRACK: "track",
  /** Represents a shape component. */
  SHAPE: "shape",
  /** Represents a baseplate component. */
  BASEPLATE: "baseplate",
  /** Represents a text component. */
  TEXT: "text"
});
export { DataTypes };

/**
 * @typedef {Object} TrackData
 * @property {String} alias
 * @property {String} name
 * @property {String} category
 * @property {String} src
 * @property {HTMLImageElement} image
 * @property {Number} [scale]
 * @property {Array<ConnectionData>} [connections]
 * @property {DataTypes} [type] The type of the track.
 * @property {Number} [color] The color of the component, represented as a hexadecimal number. Only used for shapes and baseplates.
 * @property {Number} [width] The width of the component, in pixels. Only used for shapes and baseplates.
 * @property {Number} [height] The height of the component, in pixels. Only used for shapes and baseplates.
 */
let TrackData;
export { TrackData };

/**
 * @typedef {Object} SerializedLayout
 * @property {Number} version The version number of the format of this layout.
 * @property {Number} date The timestamp of when this layout was saved, in milliseconds since epoch.
 * @property {Number} [x] The x-coordinate of the layout's position in the workspace.
 * @property {Number} [y] The y-coordinate of the layout's position in the workspace.
 * @property {Number} [zoom] The zoom level of the layout.
 * @property {Array<SerializedLayoutLayer>} layers The layers of the layout.
 * @property {SerializedConfiguration} config The configuration settings for the layout.
 */
let SerializedLayout;
export { SerializedLayout };

/**
 * The current version of the serialized file format.
 * @type {Number}
 */
const CurrentFormatVersion = 2;
export { CurrentFormatVersion };

export class LayoutController {
  static _instance = null;

  /**
   * @type {?Component}
   */
  static dragTarget = null;

  /**
   * @type {?Component}
   */
  static selectedComponent = null;

  /**
   * @type {Boolean}
   */
  static isPanning = false;

  /**
   * @type {Number}
   */
  static panDistance = 0;

  /**
   * @type {Map<Number, PointerEvent>}
   */
  static eventCache = new Map();

  /**
   * @type {Number}
   */
  static previousPinchDistance = -1;

  /** @type {?editorController.EditorController} */
  static editorController = null;

  /**
   * The currently active layer
   * @type {LayoutLayer}
   */
  #currentLayer = null;

  /**
   * The type of custom component being created.
   * @type {DataTypes}
   */
  #customComponentType = "shape";

  /**
   * 
   * @param {Application} [app] 
   * @returns {LayoutController}
   */
  static getInstance(app = null) {
    if (LayoutController._instance === null) {
      if (app === null) {
        throw new Error('LayoutController requires an Application instance to be passed to getInstance()');
      }
      LayoutController._instance = new LayoutController(app);
    }
    return LayoutController._instance;
  }

  /**
   * @param {Application} app
   */
  constructor(app) {
    if (LayoutController._instance !== null) {
      throw new Error('LayoutController is a singleton. Use getInstance() instead.');
    }

    /**
     * @type {Application}
     */
    this.app = app;
    /**
     * @type {Boolean}
     */
    this.readOnly = false;
    /**
     * @type {HTMLDivElement}
     */
    this.componentBrowser = document.getElementById('componentBrowser');
    /**
     * @type {HTMLSelectElement}
     */
    this.groupSelect = document.getElementById('categories');
    /**
     * @type {HTMLInputElement}
     */
    this.searchElement = document.getElementById('searchText');
    /**
     * @type {Object}
     */
    this.trackData = Assets.get(path.toAbsolute('../data/manifest.json'));

    /**
     * @type {Map<String, String>}
     */
    this.categories = new Map(Object.entries(this.trackData.categories));

    /**
     * @type {Point}
     */
    this.panOffset = new Point();

    /**
     * The grid
     * @type {Graphics}
     */
    this.grid = new Graphics();

    /**
     * The subgrid
     * @type {Graphics}
     */
    this.subGrid = new Graphics();

    app.stage.addChild(this.subGrid);
    app.stage.addChild(this.grid);

    /**
     * App configuration
     * @type {Configuration}
     */
    this.config = Configuration.getInstance();

    /**
     * @type {Container}
     */
    this.workspace = new Container();
    this.workspace.scale.set(this.config.defaultZoom);
    app.stage.addChild(this.workspace);

    /**
     * @type {Array<LayoutLayer>}
     */
    this.layers = [];

    this.#currentLayer = null;

    this.initLayerUI();

    this.newLayer();

    this.initCustomComponentUI();

    this.drawGrid();

    var option = document.createElement('option');
    option.value = "all";
    option.title = "All";
    option.innerHTML = '<span class="label">All</span>';
    option.selected = true;
    this.groupSelect.appendChild(option);
    this.categories.forEach((value, key, map) => {
      var option = document.createElement('option');
      option.value = key;
      option.title = value;
      option.innerHTML = '<span class="label">' + value + '</span>';
      this.groupSelect.appendChild(option);
    });
    this.groupSelect.addEventListener('change', () => {
      this.createComponentBrowser();
    });

    this.searchElement.addEventListener('keydown', (event) => {
      event.stopPropagation();
    });
    this.searchElement.addEventListener('input', () => {
      this.createComponentBrowser();
      if (this.searchElement.value.trim().length === 0) {
        this.searchElement.classList.remove('hasInput');
      } else {
        this.searchElement.classList.add('hasInput');
      }
    });

    document.getElementById('searchClearButton').addEventListener('click', () => {
      this.searchElement.value = '';
      this.searchElement.classList.remove('hasInput');
      this.createComponentBrowser();
    });
    document.getElementById('buttonRotate').addEventListener('click', this.rotateSelectedComponent.bind(this));
    document.getElementById('buttonRemove').addEventListener('click', this.deleteSelectedComponent.bind(this));
    document.getElementById('buttonDownload').addEventListener('click', this.downloadLayout.bind(this));
    document.getElementById('buttonImport').addEventListener('click', this.onImportClick.bind(this));
    document.getElementById('buttonExport').addEventListener('click', this.exportLayout.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    document.getElementById('buttonMenu').addEventListener('click', () => {
      document.getElementById('toolbar').classList.toggle('open');
    });
    document.getElementById('outsideMenu').addEventListener('click', /** @param {MouseEvent} event */ (event) => {
      this.hideFileMenu();
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (target) {
        let newPointerEvent = new PointerEvent('pointerdown', event);
        target.dispatchEvent(newPointerEvent);
        let newEvent = new MouseEvent('mousedown', event);
        target.dispatchEvent(newEvent);
        newPointerEvent = new PointerEvent('pointerup', event);
        target.dispatchEvent(newPointerEvent);
        newEvent = new MouseEvent('mouseup', event);
        target.dispatchEvent(newEvent);
        newEvent = new MouseEvent('click', event);
        target.dispatchEvent(newEvent);
      }
    });

    /**
     * Floating toolbar element for selected component
     * @type {HTMLDivElement}
     */
    this.selectionToolbar = document.getElementById('selectionToolbar');
    // Wire toolbar actions to existing handlers
    this.selectionToolbar?.querySelector('#selToolRotate')?.addEventListener('click', () => this.rotateSelectedComponent());
    this.selectionToolbar?.querySelector('#selToolDelete')?.addEventListener('click', () => this.deleteSelectedComponent());
    this.selectionToolbar?.querySelector('#selToolEdit')?.addEventListener('click', () => this.editSelectedComponent());
  }

  /**
   * Sanitizes a filename extracted from URL path to prevent security issues
   * @param {string} filename - The raw filename from URL
   * @returns {string} - Sanitized filename safe for file operations
   */
  _sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return null;
    }

    // Remove leading/trailing slashes and whitespace
    filename = filename.trim().replace(/^\/+|\/+$/g, '');

    // Remove any file extensions (after path traversal prevention)
    filename = filename.replace(/\.[a-zA-Z0-9]+$/, '');

    // Prevent path traversal by removing any path separators and dots
    filename = filename.replace(/[\/\\\.]/g, '');

    // Keep only alphanumeric characters (letters, numbers)
    filename = filename.replace(/[^a-zA-Z0-9]/g, '');

    // Ensure filename is not empty and has reasonable length
    if (!filename || filename.length === 0 || filename.length > 50) {
      return null;
    }
    
    return filename;
  }

  async init() {
    if (window.location.pathname !== '/') {
      this.readOnly = true;
      document.getElementById('layerAdd').parentElement.classList.add('hidden');
      document.getElementById('mobileLayerAdd').classList.add('hidden');
      document.getElementById('buttonRemove').disabled = true;
      document.getElementById('buttonRotate').disabled = true;
      document.getElementById('layerList').classList.add('readonly');
      document.getElementById('mobileLayerList').classList.add('readonly');
    }
    const trackBundle = await Assets.loadBundle('track');
    await Promise.all(this.trackData.bundles[0].assets.map(/** @param {TrackData} track */async (track) => {
      /** @type {HTMLImageElement} */
      var image = await this.app.renderer.extract.image(trackBundle[track.alias]);
      image.className = "track";
      image.alt = track.name;
      track.image = image;
      if (track.type === void 0) {
        track.type = DataTypes.TRACK;
      }
      if (track.color !== void 0 && typeof track.color === 'string') {
        track.color = parseInt(track.color.slice(1), 16);
      }
      if ((track.type === DataTypes.SHAPE || track.type === DataTypes.BASEPLATE) && track.width !== void 0 && track.height !== void 0) {
        var tempGraphics = new Graphics();
        tempGraphics.rect(0, 0, track.width, track.height);
        tempGraphics.fill(track.color ?? 0xA0A5A9);
        image = await this.app.renderer.extract.image(tempGraphics);
        image.className = "track";
        image.alt = track.name;
        track.image = image;
      }
      if (track.connections && track.connections.length > 0) {
        var newConnections = track.connections.map((connection) => {return {...connection, vector: PolarVector.fromFloats(...(connection.vector))};});
        // TODO: We want to store more information with each connection, like the index of the preferred next connection
        track.connections = newConnections;
      }
    }));
    this.createComponentBrowser();
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerup', LayoutController.onDragEnd);
    this.app.stage.on('touchstart', /** @param {FederatedPointerEvent} event */(event) => {
      if (!event.nativeEvent.isPrimary) {
        this.app.stage.off('pointermove', LayoutController.onPan);
      }
      LayoutController.eventCache.set(event.nativeEvent.pointerId, event.nativeEvent);
      if (LayoutController.eventCache.size === 1) {
        this.app.stage.on('touchend', LayoutController.onTouchEnd);
        this.app.stage.on('touchendoutside', LayoutController.onTouchEnd);
      } else if (LayoutController.eventCache.size === 2) {
        if (LayoutController.dragTarget) {
          LayoutController.dragTarget.alpha = 1;
          LayoutController.dragTarget = null;
        }
        this._hideSelectionToolbar();
        this.app.stage.on('touchmove', LayoutController.onPinch, this);
        this.app.stage.off('pointermove', LayoutController.onPan);
        this.app.stage.off('pointerupoutside', LayoutController.onDragEnd);
        this.app.stage.off('pointermove', LayoutController.onDragMove);
      }
    });
    this.app.stage.on('pointerdown', /** @param {FederatedPointerEvent} event */(event) => {
      if (event.button != 1 && (event.pointerType != "touch" || !event.nativeEvent.isPrimary || LayoutController.dragTarget)) {
        LayoutController.isPanning = false;
        return;
      }
      if (event.button == 1) {
        LayoutController.isPanning = true;
        this._hideSelectionToolbar();
      }
      LayoutController.panDistance = 0;
      this.panOffset.set(event.global.x - this.workspace.x, event.global.y - this.workspace.y);
      this.app.stage.on('pointermove', LayoutController.onPan, this);
      this.app.stage.on('pointerupoutside', LayoutController.onDragEnd);
    });
    this.app.stage.on('wheel', /** @param {FederatedWheelEvent} event */(event) => {
      const prePos = event.global;
      const preScale = this.workspace.scale.x;
      if (event.deltaY < 0) {
        this.workspace.scale.set(this.workspace.scale.x * 1.1);
      }
      if (event.deltaY > 0) {
        this.workspace.scale.set(this.workspace.scale.x / 1.1);
      }
      const scaleChange = this.workspace.scale.x / preScale;
      const postPos = new Point(
        (prePos.x - this.workspace.x) * scaleChange + this.workspace.x,
        (prePos.y - this.workspace.y) * scaleChange + this.workspace.y
      );
      this.workspace.position.set(this.workspace.x + prePos.x - postPos.x, this.workspace.y + prePos.y - postPos.y);
      this.drawGrid();
      this._positionSelectionToolbar();
    });
    if (this.readOnly) {
      try {
        // Extract filename from URL path and sanitize it
        const urlPath = window.location.pathname;
        const rawFilename = urlPath.substring(1); // Remove leading slash
        const sanitizedFilename = this._sanitizeFilename(rawFilename);
        
        if (!sanitizedFilename) {
          // If sanitization fails, show not found
          document.getElementById('notfound').classList.remove('hidden');
          return;
        }
        
        const layoutPath = path.toAbsolute(`../data/layouts/${sanitizedFilename}.json`);
        let layout = await Assets.load(layoutPath);
        this._importLayout(layout);
      } catch (error) {
        document.getElementById('notfound').classList.remove('hidden');
      }
      return;
    }
  }

  createComponentBrowser() {
    this.componentBrowser.innerHTML = '';
    if (this.readOnly) {
      document.getElementById('componentMenu').classList.add('hidden');
      return;
    }
    var selectedCategory = this.groupSelect.options[this.groupSelect.selectedIndex].value;
    var searchQuery = this.searchElement.value.trim().toLowerCase();
    if (selectedCategory === 'baseplates') {
      let button = document.createElement('button');
      button.title = "Custom Baseplate";
      let image = new Image();
      image.src = 'img/icon-add-black.png';
      image.className = 'custom';
      button.appendChild(image);
      let label = document.createElement('span');
      label.textContent = "Custom Baseplate";
      button.appendChild(label);
      button.addEventListener('click', () => this.showCreateCustomComponentDialog(DataTypes.BASEPLATE));
      this.componentBrowser.appendChild(button);
    } else if (selectedCategory === 'custom') {
      let button = document.createElement('button');
      button.title = "Custom Shape";
      let image = new Image();
      image.src = 'img/icon-add-black.png';
      image.className = 'custom';
      button.appendChild(image);
      let label = document.createElement('span');
      label.textContent = "Custom Shape";
      button.appendChild(label);
      button.addEventListener('click', () => this.showCreateCustomComponentDialog(DataTypes.SHAPE));
      this.componentBrowser.appendChild(button);
      let textButton = document.createElement('button');
      textButton.title = "Custom Text";
      let textImage = new Image();
      textImage.src = 'img/icon-addtext-black.png';
      textImage.className = 'custom';
      textButton.appendChild(textImage);
      let textLabel = document.createElement('span');
      textLabel.textContent = "Custom Text";
      textButton.appendChild(textLabel);
      textButton.addEventListener('click', () => this.showCreateCustomComponentDialog(DataTypes.TEXT));
      this.componentBrowser.appendChild(textButton);
    }
    this.trackData.bundles[0].assets.forEach(/** @param {TrackData} track */(track) => {
      if ((this.groupSelect.selectedIndex == 0 || track.category === selectedCategory) && (searchQuery.length === 0 || track.name.toLowerCase().includes(searchQuery)) && track.alias !== 'baseplate' && track.alias !== 'shape' && track.alias !== 'text') {
        let button = document.createElement('button');
        let label = document.createElement('span');
        label.textContent = track.name;
        button.title = track.name;
        button.appendChild(track.image);
        button.appendChild(label);
        button.addEventListener('click', this.addComponent.bind(this, track, true));
        this.componentBrowser.appendChild(button);
      }
    });
  }

  /**
   * Add a new component to the current layer.
   * @param {TrackData} track 
   * @param {Boolean} [checkConnections] Whether to check for open connections near the new component
   * @param {ComponentOptions} [options] Additional options for the component
   */
  addComponent(track, checkConnections = false, options = {}) {
    console.log("Create component: " + track.alias);
    var newComp = null;
    if (LayoutController.selectedComponent) {
      newComp = Component.fromComponent(track, LayoutController.selectedComponent, this.currentLayer, options);
      if (newComp == null) {
        return;
      }
    } else {
      let newPos = { x: 150, y: 274, angle: 0 };
      if (track.connections?.length ?? 0 > 0) {
        newPos = track.connections[0].vector.getStartPosition({ x: 512, y: 384, angle: 0 });
        newPos.x = Math.fround(newPos.x);
        newPos.y = Math.fround(newPos.y);
      } else {
        // Align to top left corner of component
        if (track.width !== void 0 && track.height !== void 0) {
          newPos.x += track.width / 2;
          newPos.y += track.height / 2;
        } else {
          /** @type {Texture} */
          let texture = Assets.get(track.alias);
          if (texture !== void 0) {
            newPos.x += texture.width / 2;
            newPos.y += texture.height / 2;
          }
        }
      }
      newPos = { ...this.#currentLayer.toLocal({x: newPos.x / 2, y: newPos.y / 2}), angle: 0 };
      if (this.config.gridSettings.snapToGrid) {
        newPos.x = Math.round(newPos.x / 16) * 16;
        newPos.y = Math.round(newPos.y / 16) * 16;
      }
      newComp = new Component(track, newPos, this.currentLayer, options);
    }
    this.currentLayer.addChild(newComp);
    LayoutController.selectComponent(newComp);
    this.currentLayer.overlay.attach(...(newComp.children.filter((component) => component.renderPipeId == "graphics" && component.pivot.x === 0)));
    if (checkConnections) {
      let openConnections = newComp.getOpenConnections();
      if (openConnections.length < newComp.connections.length) {
        openConnections.forEach((openCon) => {
          // TODO: Move this for loop to its own method in LayoutLayer
          for (const [key, connection] of this.currentLayer.openConnections) {
            if (connection.component.uid === openCon.component.uid) {
              continue;
            }
            if (connection.getPose().isInRadius(openCon.getPose(), 1) && connection.getPose().hasOppositeAngle(openCon.getPose())) {
              openCon.connectTo(connection);
              break;
            }
          }
        });
      }
    }
  }

  initCustomComponentUI() {
    document.getElementById('createComponentDialog').addEventListener('click', this.onCreateCustomComponent.bind(this));
    document.getElementById('saveComponentDialog').addEventListener('click', this.onSaveCustomComponent.bind(this));
    const componentWidthNode = document.getElementById('componentWidth');
    const componentHeightNode = document.getElementById('componentHeight');
    const componentTextNode = document.getElementById('componentText');
    const componentBorderColor = document.getElementById('componentBorderColor');
    const componentColorFilter = document.getElementById('componentColorFilter');
    componentWidthNode.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        if (document.getElementById('newCustomComponentDialog').classList.contains('editing')) {
          this.onSaveCustomComponent();
        } else {
          this.onCreateCustomComponent();
        }
      }
      if (event.key === 'Escape') {
        ui("#newCustomComponentDialog");
      }
      event.stopPropagation();
    });
    componentWidthNode.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });
    componentHeightNode.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        if (document.getElementById('newCustomComponentDialog').classList.contains('editing')) {
          this.onSaveCustomComponent();
        } else {
          this.onCreateCustomComponent();
        }
      }
      if (event.key === 'Escape') {
        ui("#newCustomComponentDialog");
      }
      event.stopPropagation();
    });
    componentHeightNode.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });
    componentTextNode.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        if (document.getElementById('newCustomComponentDialog').classList.contains('editing')) {
          this.onSaveCustomComponent();
        } else {
          this.onCreateCustomComponent();
        }
      }
      if (event.key === 'Escape') {
        ui("#newCustomComponentDialog");
      }
      event.stopPropagation();
    });
    componentTextNode.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });
    const colors = ["aqua", "black", "blue", "brown", "dark azure", "dark bluish gray", "dark green", "dark pink", "dark red", "green", "light bluish gray", "lilac", "lime", "olive green", "orange", "red", "tan", "white", "yellow"];
    const colorMenu = document.getElementById('componentColorMenu');
    colors.forEach((color) => {
      let menuItem = document.createElement('li');
      let itemIcon = document.createElement('i');
      itemIcon.className = `fill lego${color.replaceAll(' ', '')}`;
      itemIcon.setAttribute('data-ui', '#componentColorMenu');
      menuItem.innerText = color.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      menuItem.prepend(itemIcon);
      menuItem.setAttribute('data-ui', '#componentColorMenu');
      menuItem.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        this.selectComponentColor(color);
      });
      colorMenu.appendChild(menuItem);
    });
    componentColorFilter.addEventListener('input', this.filterComponentColors.bind(this));
    componentColorFilter.addEventListener('keydown', (event) => {
      event.stopPropagation();
    });
    document.getElementById('componentColorClear').addEventListener('click', () => {
      componentColorFilter.value = '';
      componentColorFilter.classList.remove('hasInput');
      this.filterComponentColors();
    });
    componentBorderColor.addEventListener('change', (event) => {
      componentBorderColor.previousElementSibling?.style.setProperty('--component-border-color', event.currentTarget.value);
    });
  }

  /**
   * Called when the user selects a color for a custom component.
   * @param {String} color The name of the color to select, e.g. "green", "red", etc.
   */
  selectComponentColor(color) {
    let icon = document.getElementById('componentColorSelect');
    let input = document.getElementById('componentColorName');
    icon.setAttribute('data-color', color.replaceAll(' ', ''));
    input.value = color.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    document.getElementById('componentColorFilter').value = '';
    this.filterComponentColors();
    document.getElementById('componentColorMenu').classList.remove('active');
  }

  filterComponentColors() {
    const colorArray = [... document.querySelectorAll('#componentColorMenu li:nth-child(n+2)')];
    const filter = document.getElementById('componentColorFilter').value.toLowerCase();
    colorArray.forEach((item) => {
      if (filter.length === 0 || item.innerText.toLowerCase().includes(filter)) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
    if (filter.trim().length === 0) {
      document.getElementById('componentColorFilter').classList.remove('hasInput');
    } else {
      document.getElementById('componentColorFilter').classList.add('hasInput');
    }
  }

  /**
   * Show the create custom component dialog.
   * @param {DataTypes} type The type of the component to create.
   * @param {Boolean} [editing] Whether this is called while editing an existing custom component. Defaults to false
   */
  showCreateCustomComponentDialog(type, editing=false) {
    const componentWidthNode = document.getElementById('componentWidth');
    const componentHeightNode = document.getElementById('componentHeight');
    const componentTextNode = document.getElementById('componentText');
    const componentSizeUnits = document.getElementById('componentSizeUnits');
    const componentBorderColor = document.getElementById('componentBorderColor');
    this.#customComponentType = type;
    const typeName = type.charAt(0).toUpperCase() + type.slice(1);
    if (editing) {
      document.getElementById('componentDialogTitle').innerText = `Edit Custom ${typeName}`;
      document.getElementById('newCustomComponentDialog').classList.add('editing');
    } else {
      document.getElementById('componentDialogTitle').innerText = `New Custom ${typeName}`;
      document.getElementById('newCustomComponentDialog').classList.remove('editing');
    }
    componentHeightNode.value = '';
    componentWidthNode.value = '';
    componentTextNode.value = '';
    if (editing) {
      componentTextNode.value = LayoutController.selectedComponent.text ?? '';
    }
    document.getElementById('componentWidthError').innerText = '';
    document.getElementById('componentHeightError').innerText = '';
    document.getElementById('componentTextError').innerText = '';
    document.getElementById('componentColorFilter').value = '';
    componentSizeUnits.selectedIndex = 0;
    this.filterComponentColors();
    componentWidthNode.parentElement.classList.remove('invalid');
    componentHeightNode.parentElement.classList.remove('invalid');
    componentTextNode.parentElement.classList.remove('invalid');
    document.getElementById('componentShapeOptions').classList.add('hidden');
    componentBorderColor.value = '#000000';
    componentBorderColor.nextElementSibling.value = '#000000';
    componentBorderColor.previousElementSibling?.style.setProperty('--component-border-color', '#000000');
    document.getElementById('componentOpacity').value = 100;
    document.getElementById('componentBorder').checked = false;
    let color = "black";
    if (type === DataTypes.TEXT) {
      componentTextNode.parentElement.classList.remove('hidden');
      componentWidthNode.parentElement.parentElement.parentElement.classList.add('hidden');
      componentHeightNode.parentElement.parentElement.parentElement.classList.add('hidden');
      componentWidthNode.autofocus = false;
      componentTextNode.autofocus = true;
      let font = 0;
      let fontSize = 7;
      if (editing) {
        font = getOptionIndexByValue('componentFont', LayoutController.selectedComponent.font, 0);
        fontSize = getOptionIndexByValue('componentFontSize', (LayoutController.selectedComponent.fontSize / 20).toString(), 7);
      }
      document.getElementById('componentFont').selectedIndex = font;
      document.getElementById('componentFontSize').selectedIndex = fontSize;
      document.getElementById('componentFontOptions').classList.remove('hidden');
    } else {
      componentTextNode.parentElement.classList.add('hidden');
      componentTextNode.autofocus = false;
      componentWidthNode.parentElement.parentElement.parentElement.classList.remove('hidden');
      componentHeightNode.parentElement.parentElement.parentElement.classList.remove('hidden');
      componentWidthNode.autofocus = true;
      componentHeightNode.parentElement.classList.remove('hidden');
      color = "green";
      document.getElementById('componentFontOptions').classList.add('hidden');
      if (type === DataTypes.BASEPLATE) {
        if (editing) {
          componentHeightNode.value = (LayoutController.selectedComponent.componentHeight / 16).toString();
          componentWidthNode.value = (LayoutController.selectedComponent.componentWidth / 16).toString();
        }
        componentSizeUnits.parentElement.parentElement.classList.add('hidden');
        componentWidthNode.parentElement.parentElement.classList.remove('s8');
        componentHeightNode.parentElement.parentElement.classList.remove('s8');
        componentWidthNode.parentElement.parentElement.classList.add('s12');
        componentHeightNode.parentElement.parentElement.classList.add('s12');
      } else {
        if (editing) {
          let units = LayoutController.selectedComponent.units;
          componentSizeUnits.selectedIndex = getOptionIndexByValue('componentSizeUnits', units, 0);
          let multiplier = 16;
          if (units === 'centimeters') {
            multiplier = 20; // 1 cm = 20 pixels
          } else if (units === 'millimeters') {
            multiplier = 2; // 1 mm = 2 pixels
          } else if (units === 'inches') {
            multiplier = 51.2; // 1 inch = 51.2 pixels
          } else if (units === 'feet') {
            multiplier = 614.4; // 1 foot = 614.4 pixels
          }
          componentHeightNode.value = Math.round(LayoutController.selectedComponent.componentHeight / multiplier).toString();
          componentWidthNode.value = Math.round(LayoutController.selectedComponent.componentWidth / multiplier).toString();
          let opacity = Math.min(
            Math.round((LayoutController.selectedComponent.opacity ?? 1) * 100),
            100
          );
          document.getElementById('componentOpacity').value = opacity;
          if (LayoutController.selectedComponent.outlineColor !== void 0) {
            document.getElementById('componentBorder').checked = true;
            let outlineColor = LayoutController.selectedComponent.outlineColor;
            componentBorderColor.value = outlineColor;
            componentBorderColor.nextElementSibling.value = outlineColor;
            componentBorderColor.previousElementSibling?.style.setProperty('--component-border-color', outlineColor);
          }
        }
        componentSizeUnits.parentElement.parentElement.classList.remove('hidden');
        componentWidthNode.parentElement.parentElement.classList.remove('s12');
        componentHeightNode.parentElement.parentElement.classList.remove('s12');
        componentWidthNode.parentElement.parentElement.classList.add('s8');
        componentHeightNode.parentElement.parentElement.classList.add('s8');
        document.getElementById('componentShapeOptions').classList.remove('hidden');
      }
    }
    if (editing) {
      color = HexToColorName[LayoutController.selectedComponent.color] ?? 'black';
    }
    document.getElementById('componentColorSelect').setAttribute('data-color', color.replaceAll(' ', ''));
    document.getElementById('componentColorName').value = color.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    ui("#newCustomComponentDialog");
  }

  onCreateCustomComponent() {
    const componentWidthNode = document.getElementById('componentWidth');
    const componentHeightNode = document.getElementById('componentHeight');
    const componentTextNode = document.getElementById('componentText');
    let componentWidth = componentWidthNode.value;
    let componentHeight = componentHeightNode.value;
    let componentText = componentTextNode.value.trim();
    let componentColor = window.getComputedStyle(document.getElementById('componentColorSelect').children[0]).getPropertyValue('color');
    /** @type {ComponentOptions} */
    let options = {
      color: componentColor
    }
    if (this.#customComponentType !== DataTypes.TEXT) {
      if (componentWidth.length === 0 || isNaN(componentWidth) || componentWidth <= 0) {
        document.getElementById('componentWidthError').innerText = "Width must be a positive number";
        componentWidthNode.parentElement.classList.add('invalid');
        componentWidthNode.focus();
        return;
      }
      if (componentHeight.length === 0 || isNaN(componentHeight) || componentHeight <= 0) {
        document.getElementById('componentHeightError').innerText = "Height must be a positive number";
        componentHeightNode.parentElement.classList.add('invalid');
        componentHeightNode.focus();
        return;
      }
      let multiplier = 16; // 1 stud = 16 pixels
      let units = document.getElementById('componentSizeUnits').value;
      if (units === 'centimeters') {
        multiplier = 20; // 1 cm = 20 pixels
      } else if (units === 'millimeters') {
        multiplier = 2; // 1 mm = 2 pixels
      } else if (units === 'inches') {
        multiplier = 51.2; // 1 inch = 51.2 pixels
      } else if (units === 'feet') {
        multiplier = 614.4; // 1 foot = 614.4 pixels
      }
      options.width = parseInt(componentWidth) * multiplier;
      options.height = parseInt(componentHeight) * multiplier;
      options.units = units;
      if (this.#customComponentType === DataTypes.SHAPE) {
        if (document.getElementById('componentBorder').checked) {
          options.outlineColor = document.getElementById('componentBorderColor').value;
        }
        let opacity = parseInt(document.getElementById('componentOpacity').value);
        if (opacity >= 0 && opacity <= 100) {
          options.opacity = opacity / 100;
        }
      }
    } else {
      if (componentText.length === 0) {
        document.getElementById('componentTextError').innerText = "Text cannot be empty";
        componentTextNode.parentElement.classList.add('invalid');
        componentTextNode.focus();
        return;
      }
      options.text = componentText;
      options.font = document.getElementById('componentFont').value;
      options.fontSize = parseInt(document.getElementById('componentFontSize').value) * 20;
    }
    let track = this.trackData.bundles[0].assets.find((a) => a.alias === this.#customComponentType);
    this.addComponent(track, false, options);
    ui("#newCustomComponentDialog");
  }

  onSaveCustomComponent() {
    const componentWidthNode = document.getElementById('componentWidth');
    const componentHeightNode = document.getElementById('componentHeight');
    const componentTextNode = document.getElementById('componentText');
    let componentWidth = componentWidthNode.value;
    let componentHeight = componentHeightNode.value;
    let componentText = componentTextNode.value.trim();
    if (this.#customComponentType === DataTypes.TEXT) {
      if (componentText.length === 0) {
        document.getElementById('componentTextError').innerText = "Text cannot be empty";
        componentTextNode.parentElement.classList.add('invalid');
        componentTextNode.focus();
        return;
      }
      LayoutController.selectedComponent.text = componentText;
      LayoutController.selectedComponent.font = document.getElementById('componentFont').value;
      LayoutController.selectedComponent.fontSize = parseInt(document.getElementById('componentFontSize').value) * 20;
    } else {
      if (componentWidth.length === 0 || isNaN(componentWidth) || componentWidth <= 0) {
        document.getElementById('componentWidthError').innerText = "Width must be a positive number";
        componentWidthNode.parentElement.classList.add('invalid');
        componentWidthNode.focus();
        return;
      }
      if (componentHeight.length === 0 || isNaN(componentHeight) || componentHeight <= 0) {
        document.getElementById('componentHeightError').innerText = "Height must be a positive number";
        componentHeightNode.parentElement.classList.add('invalid');
        componentHeightNode.focus();
        return;
      }
      let multiplier = 16;
      let units = 'studs';
      if (this.#customComponentType !== DataTypes.BASEPLATE) {
        units = document.getElementById('componentSizeUnits').value;
        if (units === 'centimeters') {
          multiplier = 20; // 1 cm = 20 pixels
        } else if (units === 'millimeters') {
          multiplier = 2; // 1 mm = 2 pixels
        } else if (units === 'inches') {
          multiplier = 51.2; // 1 inch = 51.2 pixels
        } else if (units === 'feet') {
          multiplier = 614.4; // 1 foot = 614.4 pixels
        }
      }
      LayoutController.selectedComponent.resize(
        parseInt(document.getElementById('componentWidth').value) * multiplier,
        parseInt(document.getElementById('componentHeight').value) * multiplier,
        units
      );
      if (this.#customComponentType === DataTypes.SHAPE) {
        if (document.getElementById('componentBorder').checked) {
          LayoutController.selectedComponent.outlineColor = document.getElementById('componentBorderColor').value;
        } else {
          LayoutController.selectedComponent.outlineColor = undefined;
        }
        let opacity = parseInt(document.getElementById('componentOpacity').value);
        if (opacity >= 0 && opacity <= 100) {
          LayoutController.selectedComponent.opacity = opacity / 100;
        }
      }
    }
    LayoutController.selectedComponent.color = window.getComputedStyle(document.getElementById('componentColorSelect').children[0]).getPropertyValue('color');
    this._positionSelectionToolbar();
    ui("#newCustomComponentDialog");
  }

  /**
   * Reset the layout to a blank state.
   */
  reset() {
    Connection.connectionDB.clear();
    this.hideFileMenu();
    this.layers.forEach(layer => layer.destroy());
    this.layers = [];
    this.#currentLayer = null;
    this.workspace.position.set(0, 0);
    this.config.clearWorkspaceSettings();
    this.workspace.scale.set(this.config.defaultZoom);
    this.drawGrid();
    this._hideSelectionToolbar();
    LayoutController.selectedComponent = null;
    LayoutController.dragTarget = null;
    LayoutController.isPanning = false;
    LayoutController.panDistance = 0;
    LayoutController.previousPinchDistance = -1;
    LayoutController.eventCache.clear();
    this.newLayer();
  }

  get currentLayer() {
    return this.#currentLayer;
  }

  set currentLayer(layer) {
    if (this.#currentLayer) {
      this.#currentLayer.eventMode = 'none';
      this.#currentLayer.interactiveChildren = false;
    }
    this.#currentLayer = layer;
    if (this.#currentLayer && this.readOnly === false) {
      this.#currentLayer.eventMode = 'passive';
      this.#currentLayer.interactiveChildren = true;
    }
  }

  /**
   * Download the current layout as a JSON file.
   */
  downloadLayout() {
    /** @type {SerializedLayout} */
    const layout = {
      version: CurrentFormatVersion,
      date: Date.now(),
      x: this.workspace.x,
      y: this.workspace.y,
      zoom: this.workspace.scale.x,
      layers: this.layers.map((layer) => layer.serialize()),
      config: this.config.serializeWorkspaceSettings()
    };
    const blob = new Blob([JSON.stringify(layout)], { type: 'application/json' });
    saveAs(blob, 'layout.json');
    this.hideFileMenu();
  }

  /**
   * Export the current layout as an image.
   */
  async exportLayout() {
    this.hideFileMenu();
    LayoutController.selectComponent(null);
    document.getElementById('exportloading').classList.remove('hidden');
    // This is just to make sure that the browser repaints before we move on
    await this.app.renderer.extract.base64(this.app.stage);
    let preScale = this.workspace.scale.x;
    let prePos = this.workspace.position.clone();
    this.workspace.scale.set(1.0);
    this.workspace.position.set(0, 0);
    this.drawGrid(true);
    this.app.renderer.extract.download({target:this.app.stage, filename:"layout.png"});
    document.getElementById('exportloading').classList.add('hidden');
    this.workspace.scale.set(preScale);
    this.workspace.position.set(prePos.x, prePos.y);
    this.drawGrid();
  }

  /**
   * Handler for the keydown event.
   * @param {KeyboardEvent} event - The keydown event
   */
  onKeyDown(event) {
    this.hideFileMenu();
    if (LayoutController.selectedComponent) {
      if (event.key === 'Delete') {
        this.deleteSelectedComponent();
      }
      if (event.key === 'Escape') {
        LayoutController.selectComponent(null);
      }
      if (event.key === 'r') {
        this.rotateSelectedComponent();
      }
      if (event.key === 'PageUp') {
        this.currentLayer.setChildIndex(LayoutController.selectedComponent, this.currentLayer.children.length - 2);
      }
    }
    if (event.key === '0' && event.ctrlKey) {
      this.workspace.scale.set(this.config.defaultZoom);
      this.workspace.position.set(0, 0);
      this._positionSelectionToolbar();
      this.drawGrid();
    }
    if (event.key === 'ArrowUp') {
      this.workspace.position.set(this.workspace.x, this.workspace.y + 10);
      this._positionSelectionToolbar();
      this.drawGrid();
    }
    if (event.key === 'ArrowDown') {
      this.workspace.position.set(this.workspace.x, this.workspace.y - 10);
      this._positionSelectionToolbar();
      this.drawGrid();
    }
    if (event.key === 'ArrowLeft') {
      this.workspace.position.set(this.workspace.x + 10, this.workspace.y);
      this._positionSelectionToolbar();
      this.drawGrid();
    }
    if (event.key === 'ArrowRight') {
      this.workspace.position.set(this.workspace.x - 10, this.workspace.y);
      this._positionSelectionToolbar();
      this.drawGrid();
    }
    if (event.key === 'l' && event.ctrlKey && this.readOnly === false) {
      this.newLayer();
    }
    if (event.key === '}' && event.ctrlKey && event.shiftKey) {
      if (LayoutController.editorController) {
        return;
      }
      let input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png';
      input.onchange = _ => {
        if (input.files.length > 1) {
          console.error("Only one file at a time");
          // TODO: Show an error, only one file at a time
          return;
        }
        const file = input.files[0];
        if (file && file.type === 'image/png') {
          const reader = new FileReader();
          reader.onload = _ => {
            this.reset();
            Assets.add({alias:'newComponent', src:reader.result});
            Assets.load('newComponent').then((textures) => {
              import('./editorController.js').then((module) => {
                LayoutController.editorController = new module.EditorController(textures.newComponent, this);
              });
            });
          };
          reader.onabort = (e) => {
            console.error(e);
            input = null;
          };
          reader.onerror = (e) => {
            console.error(e);
            // TODO: Show an error message to user
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  }

  /**
   * Handler for the import button click event.
   */
  onImportClick() {
    let input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = _ => {
      if (input.files.length > 1) {
        console.error("Only one file at a time");
        // TODO: Show an error, only one file at a time
        return;
      }
      const file = input.files[0];
      if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = async _ => {
          try {
            /** @type {SerializedLayout} */
            const data = JSON.parse(reader.result);
            if (data && data?.version < CurrentFormatVersion) {
              await import('../utils/layoutUpgrade.js').then((module) => {
                module.upgradeLayout(data);
              });
            }
            if (LayoutController._validateImportData(data) === false) {
              console.error("Invalid layout data");
              // TODO: Show an error message to user
              return;
            }
            this._importLayout(data);
          } catch (e) {
            console.error(e);
            if (e instanceof SyntaxError) {
              // TODO: Show an error message to user
              return;
            }
          }
        };
        reader.onerror = (e) => {
          console.error(e);
          // TODO: Show an error message to user
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  /**
   * 
   * @param {SerializedLayout} data 
   */
  _importLayout(data) {
    this.reset();
    if (data.config) {
      this.config.deserializeWorkspaceSettings(data.config);
      this.drawGrid();
    }
    data.layers.forEach((layer, index) => {
      if (index > 0) {
        this.newLayer();
      }
      this.#currentLayer.deserialize(layer);
      layer.components.forEach((component) => {
        let newComp = Component.deserialize(this.trackData.bundles[0].assets.find((a) => a.alias == component.type), component, this.layers[index]);
        this.layers[index].addChild(newComp);
        this.layers[index].overlay.attach(...(newComp.children.filter((component) => component.renderPipeId == "graphics" && component.pivot.x === 0)));
      });
      // Clear between layers
      Connection.connectionDB.clear();
    });
    if (data.x !== void 0 && data.y !== void 0) {
      this.workspace.position.set(data.x, data.y);
    }
    if (data.zoom !== void 0) {
      this.workspace.scale.set(data.zoom);
      this.drawGrid();
    }
    this.updateLayerList();
  }

  /**
   * 
   * @param {SerializedLayout} data
   * @returns {Boolean} True if the data is valid, false otherwise
   */
  static _validateImportData(data) {
    let validations = [
      data,
      data?.version === CurrentFormatVersion,
      data?.date,
      data?.x === undefined || (typeof data?.x === 'number'),
      data?.y === undefined || (typeof data?.y === 'number'),
      data?.zoom === undefined || (typeof data?.zoom === 'number' && data?.zoom > 0.0),
      data?.layers,
      data?.layers?.length > 0
    ]
    if (validations.every(v => v) === false) {
      return false;
    }
    // TODO: Add validation that checks every component in every layer to see if the `type` can't be found in the manifest
    if (data.hasOwnProperty('config') && Configuration.validateImportData(data.config) === false) {
      return false;
    }
    return data.layers.every(layer => LayoutLayer._validateImportData(layer));
  }

  /**
   * 
   * @param {FederatedPointerEvent} event 
   */
  static onPan(event) {
    if (LayoutController.isPanning === false) {
      const diff = Math.sqrt(event.movementX * event.movementX + event.movementY * event.movementY)
      LayoutController.panDistance += diff;
      if (LayoutController.panDistance < 5) {
        return;
      }
      LayoutController.isPanning = true;
      LayoutController.getInstance()._hideSelectionToolbar();
    }
    this.workspace.position.set(event.global.x - this.panOffset.x, event.global.y - this.panOffset.y);
    this.drawGrid();
  }

  /**
   * 
   * @param {FederatedPointerEvent} event 
   */
  static onDragMove(event) {
    if (LayoutController.dragTarget) {
      let a = event.getLocalPosition(LayoutController.dragTarget.parent);
      if (!LayoutController.dragTarget.isDragging) {
        let diff = LayoutController.dragTarget.getPose().subtract(LayoutController.dragTarget.dragStartPos).subtract({ ...a, angle: 0 });
        const distance = diff.magnitude();
        if (distance <= 16.0) {
          return;
        }
        LayoutController.dragTarget.isDragging = true;
        LayoutController.getInstance()._hideSelectionToolbar();
        LayoutController.dragTarget.closeConnections();
        if (LayoutController.selectedComponent?.uid !== LayoutController.dragTarget.uid) {
          LayoutController.selectComponent(null);
        }
      }
      a.x += LayoutController.dragTarget.dragStartPos.x;
      a.y += LayoutController.dragTarget.dragStartPos.y;
      // Snap to grid if enabled
      if (LayoutController.getInstance().config.gridSettings.snapToGrid) {
        let gridSize = 16;
        a.x = Math.round(a.x / gridSize) * gridSize;
        a.y = Math.round(a.y / gridSize) * gridSize;
      }
      // TODO: Check for nearby connections and snap to them
      a.x += LayoutController.dragTarget.dragStartOffset.x;
      a.y += LayoutController.dragTarget.dragStartOffset.y;
      LayoutController.dragTarget.position.set(a.x, a.y);
    }
  }

  static onDragEnd() {
    window.app.stage.off('pointerupoutside', LayoutController.onDragEnd);
    if (LayoutController.dragTarget) {
      window.app.stage.off('pointermove', LayoutController.onDragMove);
      LayoutController.dragTarget.alpha = 1;
      LayoutController.dragTarget.dragStartConnection = null;
      if (LayoutController.dragTarget.connections.length > 0) {
        let openConnections = LayoutController.dragTarget.getOpenConnections();
        if (openConnections.length > 0) {
          openConnections.forEach((openCon) => {
            // TODO: Move this for loop to its own method in LayoutLayer
            for (const [key, connection] of LayoutController.getInstance().currentLayer.openConnections) {
              if (connection.component.uid === openCon.component.uid) {
                continue;
              }
              if (connection.getPose().isInRadius(openCon.getPose(), 1) && connection.getPose().hasOppositeAngle(openCon.getPose())) {
                openCon.connectTo(connection);
                break;
              }
            }
          });
        }
      }
      LayoutController.dragTarget = null;
    } else {
      window.app.stage.off('pointermove', LayoutController.onPan);
      if (LayoutController.isPanning) {
        LayoutController.isPanning = false;
      } else if (LayoutController.selectedComponent) {
        LayoutController.selectComponent(null);
      }
    }
    if (LayoutController.selectedComponent) {
      LayoutController.getInstance()._showSelectionToolbar();
      LayoutController.getInstance()._positionSelectionToolbar();
    }
  }

  /**
   * 
   * @param {FederatedPointerEvent} event 
   */
  static onPinch(event) {
    if (LayoutController.eventCache.size < 2) {
      return;
    }
    LayoutController.eventCache.set(event.nativeEvent.pointerId, event.nativeEvent);
    let eventArray = Array.from(LayoutController.eventCache.values());
    // Calculate the distance between the two pointers
    let curDiff = Math.sqrt(
      Math.pow(eventArray[1].clientX - eventArray[0].clientX, 2) +
      Math.pow(eventArray[1].clientY - eventArray[0].clientY, 2)
    );
    if (LayoutController.previousPinchDistance > 0) {
      const preScale = this.workspace.scale.x;
      if (curDiff > LayoutController.previousPinchDistance) {
        this.workspace.scale.set(this.workspace.scale.x * 1.1);
      } else if (curDiff < LayoutController.previousPinchDistance) {
        this.workspace.scale.set(this.workspace.scale.x / 1.1);
      }
      const scaleChange = this.workspace.scale.x / preScale;
      const midPoint = new Point(
        (eventArray[0].clientX + eventArray[1].clientX) / 2,
        (eventArray[0].clientY + eventArray[1].clientY) / 2
      );
      const postPos = new Point(
        (midPoint.x - this.workspace.x) * scaleChange + this.workspace.x,
        (midPoint.y - this.workspace.y) * scaleChange + this.workspace.y
      );
      this.workspace.position.set(this.workspace.x + midPoint.x - postPos.x, this.workspace.y + midPoint.y - postPos.y);
      this.drawGrid();
      LayoutController.getInstance()._positionSelectionToolbar();
    }
    LayoutController.previousPinchDistance = curDiff;
  }

  /**
   * Handler for the touchend event that manages touch interaction cleanup.
   * Removes the touch point from the event cache and cleans up event listeners
   * when all touch points are released. Also resets pinch gesture tracking
   * when fewer than 2 touch points remain.
   * @param {FederatedPointerEvent} event - The touch event containing the released pointer
   * @static
   */
  static onTouchEnd(event) {
    LayoutController.eventCache.delete(event.nativeEvent.pointerId);
    if (LayoutController.eventCache.size === 0) {
      window.app.stage.off('touchend', LayoutController.onTouchEnd);
      window.app.stage.off('touchendoutside', LayoutController.onTouchEnd);
    } else if (LayoutController.eventCache.size < 2) {
      LayoutController.previousPinchDistance = -1;
      window.app.stage.off('touchmove', LayoutController.onPinch);
      if (LayoutController.selectedComponent) {
        LayoutController.getInstance()._showSelectionToolbar();
        LayoutController.getInstance()._positionSelectionToolbar();
      }
    }
  }

  /**
   * Select a component and highlight it.
   * @param {Component} component - The component to select.
   */
  static selectComponent(component) {
    if (LayoutController.selectedComponent) {
      LayoutController.selectedComponent.tint = 0xffffff;
    }
    LayoutController.selectedComponent = component;
    if (LayoutController.selectedComponent) {
      LayoutController.selectedComponent.tint = 0xffff00;
      // Show and position toolbar when a component is selected
      const inst = LayoutController.getInstance();
      inst._showSelectionToolbar();
      inst._positionSelectionToolbar();
    } else {
      // Hide toolbar when nothing selected
      try {
        LayoutController.getInstance()._hideSelectionToolbar();
      } catch (error) {
        return;
      }
    }
  }

  /**
   * Delete a component from the layout.
   * @param {Component} component - The component to delete.
   */
  static deleteComponent(component) {
    if (LayoutController.selectedComponent === component) {
      LayoutController.selectedComponent = null;
      LayoutController.getInstance()._hideSelectionToolbar();
    }
    component.destroy();
    component = null;
  }
  
  deleteSelectedComponent() {
    this.hideFileMenu();
    if (LayoutController.selectedComponent) {
      let nextComp = LayoutController.selectedComponent.getAdjacentComponent();
      LayoutController.deleteComponent(LayoutController.selectedComponent);
      if (nextComp) {
        LayoutController.selectComponent(nextComp);
      }
    }
  }

  editSelectedComponent() {
    this.hideFileMenu();
    if (LayoutController.selectedComponent) {
      this.showCreateCustomComponentDialog(LayoutController.selectedComponent.baseData.type, true);
    }
  }

  /**
   * Rotate the selected component.
   * @see {@link LayoutController.selectedComponent}
   * @see {@link Component.rotate}
   */
  rotateSelectedComponent() {
    this.hideFileMenu();
    if (LayoutController.selectedComponent) {
      LayoutController.selectedComponent.rotate();
    }
  }

  /**
   * Create a new layer and set it as the active layer.
   */
  newLayer() {
    this.currentLayer = new LayoutLayer();
    this.layers.push(this.#currentLayer);
    this.workspace.addChild(this.#currentLayer);
    this.#currentLayer.label = `Layer ${this.layers.length}`;
    if (this.readOnly === true) {
      this.#currentLayer.eventMode = 'none';
      this.#currentLayer.interactiveChildren = false;
    }
    LayoutController.selectComponent(null);
    this.updateLayerList();
  }

  /**
   * Initialize the UI for the layer management.
   */
  initLayerUI() {
    document.getElementById('layerAdd').addEventListener('click', this.newLayer.bind(this));
    document.getElementById('mobileLayerAdd').addEventListener('click', this.newLayer.bind(this));

    /** @type {HTMLUListElement} */
    const layerList = document.getElementById('layerList');
    const mobileLayerList = document.getElementById('mobileLayerList');
    layerList.addEventListener('slip:beforeswipe', (e) => {e.preventDefault();}, false);
    mobileLayerList.addEventListener('slip:beforeswipe', (e) => {e.preventDefault();}, false);
    layerList.addEventListener('slip:beforewait', (e) => {
      if (e.target.className.indexOf('instant') > -1) e.preventDefault();
    }, false);
    mobileLayerList.addEventListener('slip:beforewait', (e) => {
      if (e.target.className.indexOf('instant') > -1) e.preventDefault();
    }, false);
    layerList.addEventListener('slip:reorder', (e) => {
      const oppIndex = this.layers.length - 1 - e.detail.originalIndex;
      const oppSpliceIndex = this.layers.length - 1 - e.detail.spliceIndex;
      const layer = this.layers[oppIndex];
      this.layers.splice(oppIndex, 1);
      this.layers.splice(oppSpliceIndex, 0, layer);
      e.target.parentNode.insertBefore(e.target, e.detail.insertBefore);
      this.workspace.setChildIndex(layer, oppSpliceIndex);
      this.updateLayerList();
    }, false);
    mobileLayerList.addEventListener('slip:reorder', (e) => {
      const oppIndex = this.layers.length - 1 - e.detail.originalIndex;
      const oppSpliceIndex = this.layers.length - 1 - e.detail.spliceIndex;
      const layer = this.layers[oppIndex];
      this.layers.splice(oppIndex, 1);
      this.layers.splice(oppSpliceIndex, 0, layer);
      e.target.parentNode.insertBefore(e.target, e.detail.insertBefore);
      this.workspace.setChildIndex(layer, oppSpliceIndex);
      this.updateLayerList();
    }, false);
    new Slip(layerList);
    new Slip(mobileLayerList);
    this.updateLayerList();
    document.getElementById('saveLayerDialog').addEventListener('click', this.onSaveLayerName.bind(this));
    const layerNameNode = document.getElementById('layerName');
    layerNameNode.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.onSaveLayerName();
      }
      if (event.key === 'Escape') {
        ui("#editLayerDialog");
      }
      event.stopPropagation();
    });
    layerNameNode.addEventListener('input', (event) => {
      if (event.target.value.length > 0) {
        event.target.parentElement.classList.remove('invalid');
      }
    });
  }

  /**
   * 
   * @param {Event} event 
   */
  onToggleLayerVisibility(event) {
    let index = parseInt(event.currentTarget.dataset.layer);
    console.log(`Toggle Layer ${index}`);
    let layer = this.layers[index];
    layer.visible = !layer.visible;
    this.updateLayerList();
  }

  /**
   * 
   * @param {Event} event 
   */
  onDeleteLayer(event) {
    let index = parseInt(event.currentTarget.dataset.layer);
    console.log(`Delete Layer ${index}`);
    if (this.layers.length > 1) {
      let tempLayer = this.layers[index];
      this.layers.splice(index, 1);
      if (this.#currentLayer === tempLayer) {
        this.currentLayer = this.layers[0];
      }
      if (LayoutController.selectedComponent && LayoutController.selectedComponent.layer === tempLayer) {
        LayoutController.selectComponent(null);
      }
      this.workspace.removeChild(tempLayer);
      tempLayer.destroy();
      tempLayer = null;
      this.updateLayerList();
    }
  }

  /**
   * 
   * @param {Event} event 
   */
  onEditLayer(event) {
    let index = parseInt(event.currentTarget.dataset.layer);
    console.log(`Edit Layer ${index}`);
    const layerNameNode = document.getElementById('layerName');
    layerNameNode.parentElement.classList.remove('invalid');
    layerNameNode.value = this.layers[index].label;
    layerNameNode.setAttribute('data-layer', index);
    this.hideFileMenu();
    ui("#editLayerDialog");
  }

  onSaveLayerName() {
    const layerNameNode = document.getElementById('layerName');
    let layerName = layerNameNode.value;
    let index = parseInt(layerNameNode.getAttribute('data-layer'));
    if (layerName.length === 0) {
      layerNameNode.parentElement.classList.add('invalid');
      layerNameNode.focus();
      return;
    }
    this.layers[index].label = layerName;
    this.updateLayerList();
    ui("#editLayerDialog");
  }

  /**
   * Update the layer list in the UI.
   */
  updateLayerList() {
    /** @type {HTMLUListElement} */
    const layerList = document.getElementById('layerList');
    /** @type {HTMLUListElement} */
    const mobileLayerList = document.getElementById('mobileLayerList');
    layerList.innerHTML = '';
    mobileLayerList.innerHTML = '';
    this.layers.forEach((layer, index) => {
      const layerItem = document.createElement('li');
      const layerVisible = layer.visible ? '' : '_off';
      let itemHtml = "";
      if (this.readOnly === false) {
        itemHtml += "<i class=\"instant\">menu</i>";
      }
      itemHtml += `<i class="visible" data-layer="${index}">visibility${layerVisible}</i><div class="max truncate" data-layer="${index}">${layer.label}</div>`;
      if (this.readOnly === false) {
        itemHtml += `<i class="edit" data-layer="${index}">edit</i><i class="delete" data-layer="${index}">delete</i>`;
      }
      layerItem.innerHTML = itemHtml;
      if (layer === this.#currentLayer && this.readOnly === false) {
        layerItem.classList.add('primary');
      }
      let mobileLayerItem = layerItem.cloneNode(true);
      layerList.prepend(layerItem);
      mobileLayerList.prepend(mobileLayerItem);
    });
    if (this.readOnly === false) {
      document.querySelectorAll('#layerList .instant, #mobileLayerList .instant').forEach((item) => {
        item.addEventListener('mousedown', () => {
          item.style.cursor = "grabbing";
        });
        item.addEventListener('mouseup', () => {
          item.style.cursor = "grab";
        });
        item.addEventListener('mouseover', () => {
          item.style.cursor = "grab";
        });
      });
      let deleteCallback = this.onDeleteLayer.bind(this);
      document.querySelectorAll('#layerList .delete, #mobileLayerList .delete').forEach((item) => {
        item.addEventListener('click', deleteCallback);
      });
      let editCallback = this.onEditLayer.bind(this);
      document.querySelectorAll('#layerList .edit, #mobileLayerList .edit').forEach((item) => {
        item.addEventListener('click', editCallback);
      });
      layerList.querySelectorAll('div').forEach((item, index) => {
        item.addEventListener('click', () => {
          if (this.currentLayer !== this.layers[(this.layers.length - 1 - index)]) {
            this.currentLayer = this.layers[(this.layers.length - 1 - index)];
            LayoutController.selectComponent(null);
            this.updateLayerList();
          }
        });
        item.addEventListener('dblclick', editCallback);
      });
      mobileLayerList.querySelectorAll('div').forEach((item, index) => {
        item.addEventListener('click', () => {
          this.currentLayer = this.layers[(this.layers.length - 1 - index)];
          LayoutController.selectComponent(null);
          this.updateLayerList();
        });
      });
    }
    let visibilityCallback = this.onToggleLayerVisibility.bind(this);
    document.querySelectorAll('#layerList .visible, #mobileLayerList .visible').forEach((item) => {
      item.addEventListener('click', visibilityCallback);
    });
  }

  /**
   * Draw the grid on the workspace.
   * @param {boolean} [forScreenshot=false] Whether the grid is being drawn for a screenshot
   * @returns 
   */
  drawGrid(forScreenshot = false) {
    let grid = this.grid;
    let subGrid = this.subGrid;
    subGrid.clear();
    grid.clear();

    if (!this.config.gridSettings.enabled) {
      return;
    }

    const originalGridSize = this.config.gridSettings.size; // 1536
    const originalGridDivisions = this.config.gridSettings.divisions;
    let gridSize = originalGridSize * this.workspace.scale.x;
    let gridLeft = 0;
    let gridTop = 0;
    let gridWidth = this.app.screen.width;
    let gridHeight = this.app.screen.height;
    let xOffset = this.workspace.x % gridSize;
    let yOffset = this.workspace.y % gridSize;
    let divisionSize = gridSize / originalGridDivisions;
    if (xOffset > 0) {
      xOffset -= gridSize;
    }
    if (yOffset > 0) {
      yOffset -= gridSize;
    }
    if (forScreenshot) {
      /**
       * @type {Bounds}
       */
      let bounds = this.workspace.getLocalBounds();
      gridLeft = bounds.minX;
      if (gridLeft % originalGridSize !== 0) {
        gridLeft = Math.floor(gridLeft / originalGridSize) * originalGridSize;
      }
      gridLeft *= this.workspace.scale.x;
      gridTop = bounds.minY;
      if (gridTop % originalGridSize !== 0) {
        gridTop = Math.floor(gridTop / originalGridSize) * originalGridSize;
      }
      gridTop *= this.workspace.scale.y;
      xOffset = gridLeft;
      yOffset = gridTop;
      gridWidth = bounds.maxX - gridLeft;
      if (gridWidth % originalGridSize !== 0) {
        gridWidth += originalGridSize - (gridWidth % originalGridSize);
      }
      gridWidth *= this.workspace.scale.x;
      gridHeight = bounds.maxY - gridTop;
      if (gridHeight % originalGridSize !== 0) {
        gridHeight += originalGridSize - (gridHeight % originalGridSize);
      }
      gridHeight *= this.workspace.scale.y;
      subGrid.rect(gridLeft, gridTop, gridWidth, gridHeight);
      subGrid.fill(0x93bee2);
    }

    /**
     * i + xOffset
     * @type {number}
     */
    let lXO = 0;
    let lYO = 0;
    /**
     * i + xOffset + j * divisionSize
     * @type {number}
     */
    let slXO = 0;
    let slYO = 0;
    for (let i = 0; i < gridWidth + gridSize; i += gridSize) {
      lXO = i + xOffset;
      if (lXO >= gridLeft && lXO <= gridWidth + gridLeft) {
        grid.moveTo(lXO, gridTop);
        grid.lineTo(lXO, gridTop + gridHeight);
      }
      for (let j = 1; j < originalGridDivisions; j++) {
        slXO = lXO + j * divisionSize;
        if (slXO < gridLeft) {
          continue;
        }
        if (slXO > gridWidth + gridLeft) {
          break;
        }
        subGrid.moveTo(slXO, gridTop);
        subGrid.lineTo(slXO, gridTop + gridHeight);
      }
    }
    for (let i = 0; i < gridHeight + gridSize; i += gridSize) {
      lYO = i + yOffset;
      if (lYO >= gridTop && lYO <= gridHeight + gridTop) {
        grid.moveTo(gridLeft, lYO);
        grid.lineTo(gridWidth + gridLeft, lYO);
      }
      for (let j = 1; j < originalGridDivisions; j++) {
        slYO = lYO + j * divisionSize;
        if (slYO < gridTop) {
          continue;
        }
        if (slYO > gridHeight + gridTop) {
          break;
        }
        subGrid.moveTo(gridLeft, slYO);
        subGrid.lineTo(gridLeft + gridWidth, slYO);
      }
    }
    this.grid.stroke({ color: this.config.gridSettings.mainColor, pixelLine: true, width: 1 });
    if (originalGridDivisions > 1) {
      this.subGrid.stroke({ color: this.config.gridSettings.subColor, pixelLine: true, width: 1 });
    }
  }

  /**
   * Hide the file menu.
   */
  hideFileMenu() {
    document.getElementById('toolbar')?.classList.remove('open');
  }

  initWindowEvents() {
    /**
     * 
     * @param {Function} func 
     * @param {number} delay 
     * @returns {Function}
     */
    function debounce(func, delay) {
      let timeoutId;
      return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this), delay);
      };
    }
    const debouncedHandler = debounce(() => {
      this.drawGrid();
      this._positionSelectionToolbar();
    }, 300);
    const orientationQuery = window.matchMedia('(orientation: portrait)');
    window.addEventListener('resize', debouncedHandler);
    orientationQuery.addEventListener('change', debouncedHandler);
  }

  /**
   * Show the floating selection toolbar.
   */
  _showSelectionToolbar() {
    if (!this.selectionToolbar || this.readOnly) return;
    const comp = LayoutController.selectedComponent;
    if (!comp || comp.destroyed) {
      return;
    }
    if (comp.baseData.type === DataTypes.TEXT || comp.baseData.type === DataTypes.SHAPE || (comp.baseData.type === DataTypes.BASEPLATE && comp.baseData.alias === "baseplate")) {
      this.selectionToolbar.classList.add('editable');
    } else {
      this.selectionToolbar.classList.remove('editable');
    }
    this.selectionToolbar.classList.remove('hidden');
  }

  /**
   * Hide the floating selection toolbar.
   */
  _hideSelectionToolbar() {
    if (!this.selectionToolbar) return;
    this.selectionToolbar.classList.add('hidden');
  }

  /**
   * Position the selection toolbar above or below the selected component, in viewport pixels.
   */
  _positionSelectionToolbar() {
    if (!this.selectionToolbar) return;
    const comp = LayoutController.selectedComponent;
    if (!comp || comp.destroyed) {
      this._hideSelectionToolbar();
      return;
    }
    // Get component global bounds (axis-aligned, includes rotation/scale)
    const gb = comp.getBounds();
    const screenTop = Math.round(gb.minY);
    const screenBottom = Math.round(gb.maxY);
    const compCenterX = Math.round(comp.getGlobalPosition().x);
    // Measure toolbar
    const tbRect = this.selectionToolbar.getBoundingClientRect();
    const gap = 8;
    let left = Math.round(compCenterX - tbRect.width / 2);
    let top = screenTop - tbRect.height - gap;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left + tbRect.width > vw - 8) left = vw - tbRect.width - 8;
    if (left < 8) left = 8;
    if (top < 8) {
      top = screenBottom + gap;
      if (top + tbRect.height > vh - 8) {
        top = Math.max(8, Math.min(vh - tbRect.height - 8, top));
      }
    }
    this.selectionToolbar.style.left = `${left}px`;
    this.selectionToolbar.style.top = `${top}px`;
  }
}
