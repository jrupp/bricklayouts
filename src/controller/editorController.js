import { FederatedPointerEvent, Texture } from '../pixi.mjs';
import { LayoutController, DataTypes, TrackData } from "./layoutController.js";
import { Component } from "../model/component.js";
import { Connection } from "../model/connection.js";
import { PolarVector } from '../model/polarVector.js';
import { Pose } from '../model/pose.js';
import '../FileSaver.min.js';

/**
 * @module editorController
 */

/**
 * @class EditorController
 */
export class EditorController {
  static UNIT_MULTIPLIERS = {
    studs: 16,
    inches: 51.2,
    feet: 614.4,
    centimeters: 20,
    millimeters: 2
  };

  /**
   * @param {LayoutController} layoutController
   * @param {boolean} [isAdmin=false]
   */
  constructor(layoutController, isAdmin=false) {
    /** @type {LayoutController} */
    this.layoutController = layoutController;
    /** @type {boolean} */
    this.isAdmin = isAdmin;
    /** @type {?Texture} */
    this.texture = null;
    /** @type {?Component} */
    this.newComp = null;

    /** @type {TrackData} */
    this.baseData = {
      alias: 'newComponent',
      name: 'New Component',
      category: '9V',
      src: '',
      image: null,
      scale: 1.0,
      type: DataTypes.TRACK,
      connections: []
    };
    /**
     * Copies of the component being used for testing
     * @type {Array<Component>}
     */
    this.testComps = new Array();

    this.#bindEditorEvents();
  }

  #bindEditorEvents() {
    document.getElementById('connectionEditorClose').addEventListener('click', () => {
      let editor = document.getElementById('connectionEditor');
      editor.classList.add('hidden');
      editor.setAttribute('data-connection', '-1');
    });
    document.getElementById('connectionEditorRefresh').addEventListener('click', this.onEditConnectionRefresh.bind(this));
    let boundTrigger = this.onEditConnectionSave.bind(this);
    document.getElementById('connectionType').addEventListener('change', boundTrigger);
    document.getElementById('connectionType').addEventListener('keydown', (event) => { event.stopPropagation(); });
    document.getElementById('connectionNext').addEventListener('change', boundTrigger);
    document.getElementById('connectionNext').addEventListener('keydown', (event) => { event.stopPropagation(); });
    document.getElementById('connectionExitAngle').addEventListener('change', boundTrigger);
    document.getElementById('connectionExitAngle').addEventListener('keydown', (event) => { event.stopPropagation(); });
    document.getElementById('connectionAngle').addEventListener('change', boundTrigger);
    document.getElementById('connectionAngle').addEventListener('keydown', (event) => { event.stopPropagation(); });
    document.getElementById('connectionAngleLock').addEventListener('change', (event) => {
      document.getElementById('connectionAngle').readOnly = event.currentTarget.checked;
    });
    document.getElementById('connectionMagnitude').addEventListener('change', boundTrigger);
    document.getElementById('connectionMagnitude').addEventListener('keydown', (event) => { event.stopPropagation(); });
    document.getElementById('connectionMagnitudeLock').addEventListener('change', (event) => {
      document.getElementById('connectionMagnitude').readOnly = event.currentTarget.checked;
    });
    let boundSave = this.onComponentSave.bind(this);
    document.getElementById('componentAlias').addEventListener('change', boundSave);
    document.getElementById('componentAlias').addEventListener('keydown', (event) => { event.stopPropagation(); });
    document.getElementById('componentName').addEventListener('change', boundSave);
    document.getElementById('componentName').addEventListener('keydown', (event) => { event.stopPropagation(); });
    this.layoutController.categories.forEach((category, key) => {
      let option = document.createElement('option');
      option.value = key;
      option.title = category;
      option.innerHTML = '<span class="label">' + category + '</span>';
      if (category == this.baseData.category) {
        option.selected = true;
      }
      document.getElementById('componentCategories').appendChild(option);
    });
    document.getElementById('componentCategories').addEventListener('change', boundSave);
    document.getElementById('componentCategories').addEventListener('keydown', (event) => { event.stopPropagation(); });
    document.getElementById('componentScale').addEventListener('change', boundSave);
    document.getElementById('componentScale').addEventListener('keydown', (event) => { event.stopPropagation(); });
    document.getElementById('componentEditorConnectionsAdd').addEventListener('click', () => {
      let connection = { type: 0, vector:new PolarVector(), next: 0 };
      this.baseData.connections.push(connection);
      let newConnection = new Connection(this.newComp, connection.vector, connection.type, this.newComp.connections.length, connection.next);
      this.newComp.connections.push(newConnection);
      newConnection.circle.eventMode = 'static';
      newConnection.circle.on('pointerdown', /** @param {FederatedPointerEvent} event */(event) => {
        event.stopPropagation();
        this.onDragStart(event, newConnection);
      }).on('pointerup', this.onDragEnd, this);
      this.updateConnections();
      document.getElementById('componentEditorTest').removeAttribute('disabled');
    });
    let connectionsList = document.getElementById('componentEditorConnectionsList');
    connectionsList.addEventListener('slip:beforeswipe', function(e){e.preventDefault();}, false);
    connectionsList.addEventListener('slip:beforewait', function(e){
      if (e.target.className.indexOf('instant') > -1) e.preventDefault();
    }, false);
    connectionsList.addEventListener('slip:reorder', function(e){
      e.target.parentNode.insertBefore(e.target, e.detail.insertBefore);
      document.getElementById('connectionEditor').classList.add('hidden');
      // TODO: Reorder the connections in the baseData
      return false;
    }, false);
    new Slip(connectionsList);
    document.getElementById('componentEditorTest').addEventListener('click', () => {
      if (this.testComps.length > 0) {
        this.testComps.forEach((comp) => {
          comp.destroy();
        });
        this.testComps.length = 0;
      } else {
        this.newComp.connections.forEach((connection) => {
          let tempComp = Component.fromConnection(this.baseData, connection, this.layoutController.currentLayer);
          this.testComps.push(tempComp);
          this.layoutController.currentLayer.addChild(tempComp);
        });
      }
    });
    document.getElementById('componentEditorExport').addEventListener('click', this.exportComponent.bind(this));
  }

  /**
   * Displays the editor with the given texture. First prompts the user
   * for component size and units, then creates the component at that scale.
   * @param {Texture} texture
   */
  show(texture) {
    this.texture = texture;
    if (this.isAdmin) {
      this.#showEditor(texture.width, texture.height);
    } else {
      this.#showSizeDialog();
    }
  }

  #showSizeDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'no-padding border surface-container-high small-round';
    dialog.id = 'editorSizeDialog';
    dialog.innerHTML = `
      <div>
        <header class="fill top-round small-round small-padding right-padding" style="min-block-size: 3.2rem;">
          <nav>
            <h6 class="max">Component Size</h6>
            <button class="circle medium transparent" id="editorSizeDialogClose">
              <i class="medium bold">close</i>
            </button>
          </nav>
        </header>
        <div style="padding-left: 0.5rem; padding-right: 0.5rem;">
          <div class="grid vertical-margin">
            <div class="s8">
              <div class="field label prefix middle-align large-space border medium no-margin">
                <i class="large no-round">width</i>
                <input id="editorSizeWidth" type="number" min="1" placeholder=" " autofocus>
                <label>Width</label>
                <output class="invalid" id="editorSizeWidthError"></output>
              </div>
            </div>
            <div class="s4">
              <div class="field label suffix middle-align large-space border medium no-margin">
                <select id="editorSizeUnits">
                  <option value="studs" selected>Studs</option>
                  <option value="inches">Inches</option>
                  <option value="feet">Feet</option>
                  <option value="centimeters">Centimeters</option>
                  <option value="millimeters">Millimeters</option>
                </select>
                <label>Units</label>
                <i class="extra">arrow_drop_down</i>
              </div>
            </div>
          </div>
          <div class="grid vertical-margin">
            <div class="s8">
              <div class="field label prefix middle-align large-space border medium no-margin">
                <i class="large no-round">height</i>
                <input id="editorSizeHeight" type="number" min="1" placeholder=" ">
                <label>Height</label>
                <output class="invalid" id="editorSizeHeightError"></output>
              </div>
            </div>
          </div>
        </div>
        <hr>
        <nav class="no-padding no-space no-margin">
          <button class="no-round max extra-text left-button primary-text" id="editorSizeDialogConfirm"><span>Confirm</span></button>
          <button class="no-round max extra-text right-button error" id="editorSizeDialogCancel"><span>Cancel</span></button>
        </nav>
      </div>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();

    const closeDialog = () => {
      dialog.close();
      dialog.remove();
    };

    dialog.querySelector('#editorSizeDialogClose').addEventListener('click', closeDialog);
    dialog.querySelector('#editorSizeDialogCancel').addEventListener('click', closeDialog);
    dialog.addEventListener('close', () => dialog.remove());

    dialog.querySelector('#editorSizeDialogConfirm').addEventListener('click', () => {
      const widthInput = dialog.querySelector('#editorSizeWidth');
      const heightInput = dialog.querySelector('#editorSizeHeight');
      const unitsSelect = dialog.querySelector('#editorSizeUnits');
      const widthError = dialog.querySelector('#editorSizeWidthError');
      const heightError = dialog.querySelector('#editorSizeHeightError');
      const width = widthInput.value;
      const height = heightInput.value;

      widthError.innerText = '';
      heightError.innerText = '';
      widthInput.parentElement.classList.remove('invalid');
      heightInput.parentElement.classList.remove('invalid');

      if (width.length === 0 || isNaN(width) || parseFloat(width) <= 0) {
        widthError.innerText = 'Width must be a positive number';
        widthInput.parentElement.classList.add('invalid');
        widthInput.focus();
        return;
      }
      if (height.length === 0 || isNaN(height) || parseFloat(height) <= 0) {
        heightError.innerText = 'Height must be a positive number';
        heightInput.parentElement.classList.add('invalid');
        heightInput.focus();
        return;
      }

      const units = unitsSelect.value;
      const multiplier = EditorController.UNIT_MULTIPLIERS[units] || 16;
      const pixelWidth = parseFloat(width) * multiplier;
      const pixelHeight = parseFloat(height) * multiplier;

      closeDialog();
      this.#showEditor(pixelWidth, pixelHeight);
    });
  }

  /**
   * 
   * @param {number} width 
   * @param {number} height 
   */
  #showEditor(width, height) {
    this.baseData.image = this.texture;
    this.baseData.width = width;
    this.baseData.height = height;
    this.baseData.connections = [];

    if (this.newComp) {
      this.newComp.destroy();
      this.newComp = null;
    }
    this.testComps.forEach((comp) => comp.destroy());
    this.testComps.length = 0;

    this.newComp = new Component(this.baseData, { x: this.layoutController.app.screen.width, y: this.layoutController.app.screen.height, angle: 0 }, this.layoutController.currentLayer);
    this.layoutController.currentLayer.addChild(this.newComp);
    this.newComp.sprite.setSize(width, height);
    this.baseData.scale = this.newComp.sprite.scale.x;

    document.getElementById('componentScale').value = this.newComp.sprite.scale.x;
    document.getElementById('componentAlias').value = this.baseData.alias;
    document.getElementById('componentName').value = this.baseData.name;
    document.getElementById('componentEditor').classList.remove('hidden');
    document.getElementById('componentEditorConnectionsList').innerHTML = '';
    document.getElementById('componentEditorTest').setAttribute('disabled', 'disabled');
    if (this.isAdmin) {
      document.getElementById('componentEditorConnections').classList.remove('hidden');
      document.getElementById('componentAliasField').classList.remove('hidden');
      document.getElementById('componentScaleField').classList.remove('hidden');
    } else {
      document.getElementById('componentEditorConnections').classList.add('hidden');
      document.getElementById('componentAliasField').classList.add('hidden');
      document.getElementById('componentScaleField').classList.add('hidden');
    }
  }

  updateConnections() {
    /** @type {HTMLUListElement} */
    const connectionsList = document.getElementById('componentEditorConnectionsList');
    connectionsList.innerHTML = '';
    this.baseData.connections.forEach((connection, index) => {
      const connectionItem = document.createElement('li');
      connectionItem.innerHTML = `<span class="instant"></span>${EditorController.getOrdinal(index + 1)} Connection<span class="delete" data-connection="${index}"></span><span class="edit" data-connection="${index}"></span>`;
      connectionsList.appendChild(connectionItem);
    });
    var items = document.querySelectorAll(".instant");
    for (var i=0; i < items.length; i++) {
      var item = items[i]
      item.addEventListener('mousedown', function(){
        this.style.cursor = "grabbing";
      });
      item.addEventListener('mouseover', function(){
        this.style.cursor = "grab";
      });
      item.addEventListener('mouseup', function(){
        this.style.cursor = "grab";
      });
    }
    let editItems = connectionsList.querySelectorAll(".edit");
    let callback = undefined;
    if (editItems.length > 0) {
      callback = this.onEditConnection.bind(this);
    }
    for (let i=0; i < editItems.length; i++) {
      let item = editItems[i];
      item.addEventListener('click', callback);
    }
    let deleteItems = connectionsList.querySelectorAll(".delete");
    let deleteCallback = undefined;
    if (deleteItems.length > 0) {
      deleteCallback = this.onDeleteConnection.bind(this);
    }
    for (let i=0; i < deleteItems.length; i++) {
      let item = deleteItems[i];
      item.addEventListener('click', deleteCallback);
    }
  }

  onComponentSave() {
    console.log('Save Component');
    this.baseData.scale = parseFloat(document.getElementById('componentScale').value);
    this.newComp.sprite.scale.set(this.baseData.scale);
    let tempAlias = document.getElementById('componentAlias').value;
    
    // Validate alias - only allow letters, numbers, and underscores
    const validAlias = tempAlias.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Update input field if invalid characters were removed
    if (validAlias !== tempAlias) {
        document.getElementById('componentAlias').value = validAlias;
        tempAlias = validAlias;
    }
    this.baseData.alias = tempAlias;
    this.baseData.name = document.getElementById('componentName').value;
    let categories = document.getElementById('componentCategories');
    this.baseData.category = categories.options[categories.selectedIndex].value;
  }

  /**
   * 
   * @param {Event} event 
   */
  onDeleteConnection(event) {
    let index = parseInt(event.currentTarget.getAttribute('data-connection'));
    console.log(`Delete Connection ${index}`);
    // TODO: Implement this
  }

  /**
   * 
   * @param {Event} event 
   */
  onEditConnection(event) {
    let index = parseInt(event.currentTarget.getAttribute('data-connection'));
    console.log(`Edit Connection ${index}`);
    document.getElementById('connectionEditorTitle').innerHTML = `Edit Connection ${index + 1}`;
    let editor = document.getElementById('connectionEditor');
    let connectionNext = document.getElementById('connectionNext');
    connectionNext.innerHTML = '';
    this.baseData.connections.forEach((connection, i) => {
      let option = document.createElement('option');
      option.value = i;
      option.title = `Connection ${i+1}`;
      option.innerHTML = `Connection ${i+1}`;
      if (i == this.baseData.connections[index].next) {
        option.selected = true;
      }
      connectionNext.appendChild(option);
    });
    document.getElementById('connectionType').value = this.baseData.connections[index].type;
    connectionNext.value = this.baseData.connections[index].next;
    document.getElementById('connectionExitAngle').value = this.baseData.connections[index].vector.exitAngle / Math.PI;
    document.getElementById('connectionAngle').value = this.baseData.connections[index].vector.angle / Math.PI;
    document.getElementById('connectionAngle').readOnly = 1;
    document.getElementById('connectionAngleLock').checked = 1;
    document.getElementById('connectionMagnitude').value = this.baseData.connections[index].vector.magnitude;
    document.getElementById('connectionMagnitude').readOnly = 1;
    document.getElementById('connectionMagnitudeLock').checked = 1;
    editor.setAttribute('data-connection', index);
    editor.classList.remove('hidden');
  }

  /**
   * 
   * @param {Event} event 
   */
  onEditConnectionSave(event) {
    let index = parseInt(document.getElementById('connectionEditor').getAttribute('data-connection'));
    console.log(`Save Connection ${index}`);
    if (index < 0) {
      return;
    }
    // TODO: Validate the input
    this.baseData.connections[index].type = parseInt(document.getElementById('connectionType').value);
    this.baseData.connections[index].next = parseInt(document.getElementById('connectionNext').value);
    this.baseData.connections[index].vector.exitAngle = Pose.normalizeAngle(parseFloat(document.getElementById('connectionExitAngle').value) * Math.PI);
    if (!document.getElementById('connectionMagnitudeLock').checked) {
      this.baseData.connections[index].vector.magnitude = parseFloat(document.getElementById('connectionMagnitude').value);
    }
    if (!document.getElementById('connectionAngleLock').checked) {
      this.baseData.connections[index].vector.angle = Pose.normalizeAngle(parseFloat(document.getElementById('connectionAngle').value) * Math.PI);
    }
    if (this.newComp.connections[index]) {
      this.newComp.connections[index].type = this.baseData.connections[index].type;
      this.newComp.connections[index].nextConnectionIndex = this.baseData.connections[index].next;
      this.newComp.connections[index].offsetVector.exitAngle = this.baseData.connections[index].vector.exitAngle;
      if (!document.getElementById('connectionAngleLock').checked) {
        this.newComp.connections[index].offsetVector.angle = this.baseData.connections[index].vector.angle;
      }
      if (!document.getElementById('connectionMagnitudeLock').checked) {
        this.newComp.connections[index].offsetVector.magnitude = this.baseData.connections[index].vector.magnitude;
      }
      this.newComp.connections[index].updateCircle();
      if (this.newComp.connections[index].otherConnection) {
        let otherConnection = this.newComp.connections[index].otherConnection;
        let conPose = this.newComp.connections[index].getPose();
        conPose.turnAngle(Math.PI);
        let conIndex = 0;
        /** @type {Pose} */
        let newPos = otherConnection.component.baseData.connections[conIndex].vector.getStartPosition(conPose);
        otherConnection.component.x = Math.fround(newPos.x);
        otherConnection.component.y = Math.fround(newPos.y);
        otherConnection.component.sprite.rotation = newPos.angle;
        otherConnection.component.connections.forEach((connection) => {
          connection.updateCircle();
        });
      }
    }
  }

  onEditConnectionRefresh() {
    let index = parseInt(document.getElementById('connectionEditor').getAttribute('data-connection'));
    if (index < 0) {
      return;
    }
    if (this.newComp.connections[index]) {
      this.calculateConnectionVector(this.newComp.connections[index]);
      document.getElementById('connectionAngle').value = this.baseData.connections[index].vector.angle / Math.PI;
      document.getElementById('connectionMagnitude').value = this.baseData.connections[index].vector.magnitude;
      if (this.newComp.connections[index].otherConnection) {
        let otherConnection = this.newComp.connections[index].otherConnection;
        let conPose = this.newComp.connections[index].getPose();
        conPose.turnAngle(Math.PI);
        let conIndex = 0;
        /** @type {Pose} */
        let newPos = otherConnection.component.baseData.connections[conIndex].vector.getStartPosition(conPose);
        otherConnection.component.x = Math.fround(newPos.x);
        otherConnection.component.y = Math.fround(newPos.y);
        otherConnection.component.sprite.rotation = newPos.angle;
        otherConnection.component.connections.forEach((connection) => {
          connection.updateCircle();
        });
      }
    }
  }

  /**
   * For admins: Exports the component data to a JSON file so it can be easily added to the manifest later
   * For everyone else: Exports the newComp as an image.
   */
  async exportComponent() {
    if (this.isAdmin) {
      let data = JSON.stringify(this.baseData, ['alias', 'name', 'category', 'src', 'scale', 'connections', 'type', 'vector', 'next']);
      const blob = new Blob([data], { type: 'application/json' });
      saveAs(blob, `${this.baseData.alias}.json`);
    } else {
      this.layoutController.undoManager.suppress();
      for (const layer of this.layoutController.layers) {
        const children = [...layer.children];
        for (const child of children) {
          if (child !== this.newComp && child instanceof Component) {
            child.destroy();
          }
        }
      }
      this.layoutController.undoManager.unsuppress();

      const gridWasEnabled = this.layoutController.config.workspaceGridSettings.enabled;
      this.layoutController.config.updateWorkspaceGridSettings({ enabled: false });

      await this.layoutController.exportLayout();

      this.layoutController.config.updateWorkspaceGridSettings({ enabled: gridWasEnabled });
    }
  }

  /**
   * Calculates a connection's offsetVector using its circle's current position
   * @param {Connection} connection 
   */
  calculateConnectionVector(connection) {
    // TODO: Take component rotation into account (use rotate() method to "unrotate" the vector)
    const pv = PolarVector.fromPoses({x: 0, y: 0, angle: 0}, { x: connection.circle.x, y: connection.circle.y, angle: 0 });
    connection.offsetVector.magnitude = pv.magnitude;
    connection.offsetVector.angle = Pose.normalizeAngle(pv.angle);
    connection.updateCircle();
  }

  /**
   * 
   * @param {FederatedPointerEvent} event 
   * @param {Connection} connection 
   */
  onDragStart(event, connection) {
    if (event.button != 0 || !event.nativeEvent.isPrimary) {
      return;
    }
    let editor = document.getElementById('connectionEditor');
    editor.classList.add('hidden');
    editor.setAttribute('data-connection', '-1');
    this.dragTarget = connection;
    connection.circle.isDragging = true;
    connection.circle.dragStartPos = { x: connection.circle.x, y: connection.circle.y };
    connection.circle.alpha = 0.5;
    console.log(connection.uuid);
    window.app.stage.on('pointermove', this.onDragMove, this);
  }

  /**
   * 
   * @param {FederatedPointerEvent} event 
   */
  onDragMove(event) {
    if (this.dragTarget) {
      let a = event.getLocalPosition(this.dragTarget.component);
      this.dragTarget.circle.x = a.x;
      this.dragTarget.circle.y = a.y;
    }
  }

  onDragEnd() {
    if (this.dragTarget) {
      this.dragTarget.circle.isDragging = false;
      this.dragTarget.circle.alpha = 1.0;
      this.calculateConnectionVector(this.dragTarget);
      this.dragTarget = null;
    }
    window.app.stage.off('pointermove', this.onDragMove);
    //window.app.stage.off('pointerupoutside', EditorController.onDragEnd);
  }

  /**
   * Converts a number into its ordinal representation.
   * @param {Number} n - The number to convert
   * @returns {String} The number with its ordinal suffix (e.g., 1st, 2nd, 3rd, 4th)
   * @example
   * getOrdinal(1)  // returns "1st"
   * getOrdinal(2)  // returns "2nd"
   * getOrdinal(3)  // returns "3rd"
   * getOrdinal(4)  // returns "4th"
   * getOrdinal(21) // returns "21st"
   */
  static getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
}