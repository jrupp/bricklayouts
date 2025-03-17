import { Assets, Application, Container, FederatedPointerEvent, FederatedWheelEvent, Graphics, Point } from '../pixi.mjs';
import { EditorController } from './editorController.js';
import { Component } from '../model/component.js';
import { Connection } from '../model/connection.js';
import { LayoutLayer, SerializedLayoutLayer } from '../model/layoutLayer.js';
import { PolarVector } from '../model/polarVector.js';
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
 * @typedef {Object} TrackData
 * @property {String} alias
 * @property {String} name
 * @property {String} category
 * @property {String} src
 * @property {HTMLImageElement} image
 * @property {Number} [scale]
 * @property {Array<ConnectionData>} [connections]
 */
let TrackData;
export { TrackData };

/**
 * @typedef {Object} SerializedLayout
 * @property {Number} version The version number of the format of this layout.
 * @property {Number} date The timestamp of when this layout was saved, in milliseconds since epoch.
 * @property {Array<SerializedLayoutLayer>} layers The layers of the layout.
 */
let SerializedLayout;
export { SerializedLayout };

export class LayoutController {

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

  /** @type {?EditorController} */
  static editorController = null;

  /**
   * @param {Application} app
   */
  constructor(app) {
    /**
     * @type {Application}
     */
    this.app = app;
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
    this.trackData = Assets.get("../data/manifest.json");

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
    app.stage.addChild(this.grid);

    /**
     * @type {Container}
     */
    this.workspace = new Container();
    this.workspace.scale.set(0.5);
    app.stage.addChild(this.workspace);

    /**
     * @type {Array<LayoutLayer>}
     */
    this.layers = [];

    /**
     * The current active layer
     * @type {LayoutLayer}
     */
    this.currentLayer = null;

    this.newLayer();

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
    document.getElementById('buttonRotate').addEventListener('click', LayoutController.rotateSelectedComponent);
    document.getElementById('buttonRemove').addEventListener('click', LayoutController.deleteSelectedComponent);
    document.getElementById('buttonDownload').addEventListener('click', this.downloadLayout.bind(this));
    document.getElementById('buttonImport').addEventListener('click', this.onImportClick.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    document.getElementById('buttonMenu').addEventListener('click', () => {
      document.getElementById('toolbar').classList.toggle('open');
    });
    document.getElementById('outsideMenu').addEventListener('click', () => {
      this.hideFileMenu();
    });
    document.getElementById('buttonConfig').addEventListener('click', () => {
      document.getElementById('configurationEditor').classList.toggle('hidden');
    });
    document.getElementById('configurationEditorClose').addEventListener('click', () => {
      document.getElementById('configurationEditor').classList.add('hidden');
    });
    document.getElementById('configurationEditorSave').addEventListener('click', () => {
      document.getElementById('configurationEditor').classList.add('hidden');
    });
    document.getElementById('configurationEditorCancel').addEventListener('click', () => {
      document.getElementById('configurationEditor').classList.add('hidden');
    });
  }

  async init() {
    const trackBundle = await Assets.loadBundle('track');
    await Promise.all(this.trackData.bundles[0].assets.map(/** @param {TrackData} track */async (track) => {
      /** @type {HTMLImageElement} */
      var image = await this.app.renderer.extract.image(trackBundle[track.alias]);
      image.className = "track";
      image.alt = track.name;
      track.image = image;
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
    });
  }

  createComponentBrowser() {
    this.componentBrowser.innerHTML = '';
    var selectedCategory = this.groupSelect.options[this.groupSelect.selectedIndex].value;
    var searchQuery = this.searchElement.value.trim().toLowerCase();
    this.trackData.bundles[0].assets.forEach(/** @param {TrackData} track */(track) => {
      if ((this.groupSelect.selectedIndex == 0 || track.category === selectedCategory) && (searchQuery.length === 0 || track.name.toLowerCase().includes(searchQuery))) {
        var button = document.createElement('button');
        button.title = track.name;
        button.appendChild(track.image);
        button.addEventListener('click', this.addComponent.bind(this, track, true));
        this.componentBrowser.appendChild(button);
      }
    });
  }

  /**
   * 
   * @param {TrackData} track 
   * @param {Boolean} [checkConnections] Whether to check for open connections near the new component
   */
  addComponent(track, checkConnections = false) {
    console.log("Create component: " + track.alias);
    var newComp = null;
    if (LayoutController.selectedComponent) {
      newComp = Component.fromComponent(track, LayoutController.selectedComponent, this.currentLayer);
      if (newComp == null) {
        return;
      }
    } else {
      let newPos = { x: 150, y: 275, angle: 0 };
      if (track.connections?.length ?? 0 > 0) {
        newPos = track.connections[0].vector.getStartPosition({ x: 512, y: 384, angle: 0 });
        newPos.x = Math.fround(newPos.x);
        newPos.y = Math.fround(newPos.y);
      }
      newComp = new Component(track, newPos, this.currentLayer);
    }
    this.currentLayer.addChild(newComp);
    LayoutController.selectComponent(newComp);
    this.currentLayer.overlay.attach(...(newComp.children.filter((component) => component.renderPipeId == "graphics")));
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

  /**
   * Create a new layer and set it as the active layer.
   */
  newLayer() {
    this.currentLayer = new LayoutLayer();
    this.layers.push(this.currentLayer);
    this.workspace.addChild(this.currentLayer);
  }

  /**
   * Reset the layout to a blank state.
   */
  reset() {
    Connection.connectionDB.clear();
    this.hideFileMenu();
    this.layers.forEach(layer => layer.destroy());
    this.layers = [];
    this.currentLayer = null;
    this.workspace.position.set(0, 0);
    this.workspace.scale.set(0.5);
    this.drawGrid();
    LayoutController.selectedComponent = null;
    LayoutController.dragTarget = null;
    LayoutController.isPanning = false;
    LayoutController.panDistance = 0;
    LayoutController.previousPinchDistance = -1;
    LayoutController.eventCache.clear();
    this.newLayer();
  }

  /**
   * Download the current layout as a JSON file.
   */
  downloadLayout() {
    /** @type {SerializedLayout} */
    const layout = {
      version: 1,
      date: Date.now(),
      layers: this.layers.map((layer) => layer.serialize())
    };
    const blob = new Blob([JSON.stringify(layout)], { type: 'application/json' });
    saveAs(blob, 'layout.json');
    this.hideFileMenu();
  }

  /**
   * Handler for the keydown event.
   * @param {KeyboardEvent} event - The keydown event
   */
  onKeyDown(event) {
    if (LayoutController.selectedComponent) {
      if (event.key === 'Delete') {
        LayoutController.deleteSelectedComponent();
      }
      if (event.key === 'Escape') {
        LayoutController.selectComponent(null);
      }
      if (event.key === 'r') {
        LayoutController.rotateSelectedComponent();
      }
    }
    if (event.key === '0' && event.ctrlKey) {
      this.workspace.scale.set(0.5);
      this.workspace.position.set(0, 0);
      this.drawGrid();
    }
    if (event.key === 'ArrowUp') {
      this.workspace.position.set(this.workspace.x, this.workspace.y + 10);
    }
    if (event.key === 'ArrowDown') {
      this.workspace.position.set(this.workspace.x, this.workspace.y - 10);
    }
    if (event.key === 'ArrowLeft') {
      this.workspace.position.set(this.workspace.x + 10, this.workspace.y);
    }
    if (event.key === 'ArrowRight') {
      this.workspace.position.set(this.workspace.x - 10, this.workspace.y);
    }
    if (event.key === 'l' && event.ctrlKey) {
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
              LayoutController.editorController = new EditorController(textures.newComponent, this);
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
        reader.onload = _ => {
          try {
            /** @type {SerializedLayout} */
            const data = JSON.parse(reader.result);
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
    data.layers.forEach((layer, index) => {
      if (index > 0) {
        this.newLayer();
      }
      layer.components.forEach((component) => {
        let newComp = Component.deserialize(this.trackData.bundles[0].assets.find((a) => a.alias == component.type), component, this.layers[index]);
        this.layers[index].addChild(newComp);
        this.layers[index].overlay.attach(...(newComp.children.filter((component) => component.renderPipeId == "graphics")));
      });
      // Clear between layers
      Connection.connectionDB.clear();
    });
  }

  /**
   * 
   * @param {SerializedLayout} data
   * @returns {Boolean} True if the data is valid, false otherwise
   */
  static _validateImportData(data) {
    let validations = [
      data,
      data?.version === 1,
      data?.date,
      data?.layers,
      data?.layers?.length > 0
    ]
    if (validations.every(v => v) === false) {
      return false;
    }
    // TODO: Add validation that checks every component in every layer to see if the `type` can't be found in the manifest
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
        LayoutController.dragTarget.closeConnections();
      }

      LayoutController.dragTarget.position.set(a.x + LayoutController.dragTarget.dragStartPos.x, a.y + LayoutController.dragTarget.dragStartPos.y);
    }
  }

  static onDragEnd() {
    window.app.stage.off('pointerupoutside', LayoutController.onDragEnd);
    if (LayoutController.dragTarget) {
      window.app.stage.off('pointermove', LayoutController.onDragMove);
      LayoutController.dragTarget.alpha = 1;
      LayoutController.dragTarget = null;
    } else {
      window.app.stage.off('pointermove', LayoutController.onPan);
      if (LayoutController.isPanning) {
        LayoutController.isPanning = false;
      } else if (LayoutController.selectedComponent) {
        LayoutController.selectComponent(null);
      }
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
    }
  }

  static selectComponent(component) {
    if (LayoutController.selectedComponent) {
      LayoutController.selectedComponent.tint = 0xffffff;
    }
    LayoutController.selectedComponent = component;
    if (LayoutController.selectedComponent) {
      LayoutController.selectedComponent.tint = 0xffff00;
    }
  }

  static deleteComponent(component) {
    if (LayoutController.selectedComponent === component) {
      LayoutController.selectedComponent = null;
    }
    component.destroy();
    component = null;
  }
  
  static deleteSelectedComponent() {
    if (LayoutController.selectedComponent) {
      let nextComp = LayoutController.selectedComponent.getAdjacentComponent();
      LayoutController.deleteComponent(LayoutController.selectedComponent);
      if (nextComp) {
        LayoutController.selectComponent(nextComp);
      }
    }
  }

  static rotateSelectedComponent() {
    if (LayoutController.selectedComponent) {
      LayoutController.selectedComponent.rotate();
    }
  }

  drawGrid() {
    let grid = this.grid;
    let gridSize = 512 * this.workspace.scale.x;
    let gridWidth = this.app.screen.width;
    let gridHeight = this.app.screen.height;
    let xOffset = this.workspace.x % gridSize;
    let yOffset = this.workspace.y % gridSize;
    grid.clear();
    for (let i = 0; i < gridWidth + gridSize; i += gridSize) {
      grid.moveTo(i + xOffset, 0);
      grid.lineTo(i + xOffset, gridHeight);
    }
    for (let i = 0; i < gridHeight + gridSize; i += gridSize) {
      grid.moveTo(0, i + yOffset);
      grid.lineTo(gridWidth, i + yOffset);
    }
    this.grid.stroke({ color: 0xffffff, pixelLine: true, width: 1 });
  }

  /**
   * Hide the file menu.
   */
  hideFileMenu() {
    document.getElementById('toolbar')?.classList.remove('open');
  }
}
