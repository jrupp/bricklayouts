import { LayoutController, SerializedLayout } from "../../src/controller/layoutController.js";
import { Component } from "../../src/model/component.js";
import { Connection } from "../../src/model/connection.js";
import { LayoutLayer } from "../../src/model/layoutLayer.js";
import { Pose } from "../../src/model/pose.js";
import { Application, Assets, Color, Graphics, RenderLayer, Sprite } from '../../src/pixi.mjs';
import layoutFileOne from './layout1.json' with { "type": "json" };
import layoutFileTwo from './layout2.json' with { "type": "json" };
import layoutFileThree from './layout3.json' with { "type": "json" };
import layoutFileFour from './layout4.json' with { "type": "json" };
import layoutFileFive from './layout5.json' with { "type": "json" };

function ui(s) {
}
window.ui = ui;
Color.prototype.toYiq = function () {
  return ((this._components[0] * 299 + this._components[1] * 587 + this._components[2] * 114) /  1000) * 255;
};

describe("LayoutController", function() {
    let componentWidth;
    let componentWidthError;
    let componentHeight;
    let componentHeightError;
    let componentSizeUnits;
    let componentColorSelect;
    let componentOpacity;
    let componentBorder;
    let componentBorderColor;
    beforeAll(async () => {
        const app = new Application();
        await app.init();
        await Assets.init({ basePath: '../__spec__/img/', manifest: "../data/manifest.json" });
        await Assets.loadBundle('track');
        window.app = app;
        window.assets = Assets;
        let geiSpy = spyOn(document, 'getElementById');
        geiSpy.withArgs('componentBrowser').and.returnValue(document.createElement('div'));
        geiSpy.withArgs('categories').and.returnValue(document.createElement('select'));
        geiSpy.withArgs('searchText').and.returnValue(document.createElement('input'));
        geiSpy.withArgs('searchClearButton').and.returnValue(document.createElement('span'));
        geiSpy.withArgs('buttonRotate').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('buttonRemove').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('buttonDownload').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('buttonImport').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('buttonExport').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('buttonMenu').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('outsideMenu').and.returnValue(document.createElement('div'));
        geiSpy.withArgs('buttonConfig').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('configurationEditorClose').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('configurationEditorSave').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('configurationEditorCancel').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('toolbar').and.returnValue(document.createElement('div'));
        geiSpy.withArgs('layerAdd').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('mobileLayerAdd').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('layerEditor').and.returnValue(document.createElement('article'));
        geiSpy.withArgs('mobileLayerEditor').and.returnValue(document.createElement('dialog'));
        geiSpy.withArgs('layerList').and.returnValue(document.createElement('ul'));
        geiSpy.withArgs('mobileLayerList').and.returnValue(document.createElement('ul'));
        geiSpy.withArgs('saveLayerDialog').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('layerName').and.returnValue(document.createElement('input'));
        geiSpy.withArgs('exportloading').and.returnValue(document.createElement('main'));
        geiSpy.withArgs('createComponentDialog').and.returnValue(document.createElement('button'));
        componentWidth = document.createElement('input');
        componentWidthError = document.createElement('span');
        geiSpy.withArgs('componentWidth').and.returnValue(componentWidth);
        geiSpy.withArgs('componentWidthError').and.returnValue(componentWidthError);
        componentHeight = document.createElement('input');
        componentHeightError = document.createElement('span');
        geiSpy.withArgs('componentHeight').and.returnValue(componentHeight);
        geiSpy.withArgs('componentHeightError').and.returnValue(componentHeightError);
        componentColorSelect = document.createElement('div');
        let i = document.createElement('i');
        i.setAttribute('data-color', 'green');
        i.style.color = '#237841';
        componentColorSelect.appendChild(i);
        geiSpy.withArgs('componentColorSelect').and.returnValue(componentColorSelect);
        geiSpy.withArgs('componentColorMenu').and.returnValue(document.createElement('menu'));
        geiSpy.withArgs('componentColorName').and.returnValue(document.createElement('input'));
        geiSpy.withArgs('componentColorFilter').and.returnValue(document.createElement('input'));
        geiSpy.withArgs('componentColorClear').and.returnValue(document.createElement('i'));
        geiSpy.withArgs('componentText').and.returnValue(document.createElement('input'));
        geiSpy.withArgs('componentFont').and.returnValue(document.createElement('select'));
        geiSpy.withArgs('componentFontSize').and.returnValue(document.createElement('select'));
        componentSizeUnits = document.createElement('select');
        geiSpy.withArgs('componentSizeUnits').and.returnValue(componentSizeUnits);
        geiSpy.withArgs('componentShapeOptions').and.returnValue(document.createElement('div'));
        componentBorder = document.createElement('input');
        componentBorder.type = 'checkbox';
        componentBorder.checked = false;
        geiSpy.withArgs('componentBorder').and.returnValue(componentBorder);
        componentBorderColor = document.createElement('input');
        componentBorderColor.type = 'color';
        geiSpy.withArgs('componentBorderColor').and.returnValue(componentBorderColor);
        componentOpacity = document.createElement('input');
        componentOpacity.type = 'range';
        componentOpacity.value = '100';
        geiSpy.withArgs('componentOpacity').and.returnValue(componentOpacity);
        window.Slip = class Slip {
            constructor() {
            }
        };
        const layoutController = LayoutController.getInstance(app);
        window.layoutController = layoutController;
        return layoutController.init();
    });

    describe("reset", function() {
        it("resets the layout", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            expect(trackData).toBeDefined();
            layoutController.addComponent(trackData);
            layoutController.workspace.scale.set(2);
            layoutController.reset();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(1);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(RenderLayer);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(layoutController.workspace.position.equals({ x: 0, y: 0 })).toBeTrue();
            expect(layoutController.workspace.scale.x).toBe(0.5);
            expect(layoutController.workspace.scale.y).toBe(0.5);
            expect(LayoutController.selectedComponent).toBeNull();
            expect(LayoutController.dragTarget).toBeNull();
        });
    });

    describe("exportLayout", function() {
        beforeAll(function() {
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.reset();
            layoutController.addComponent(trackData);
            layoutController.addComponent(trackData);
            layoutController.addComponent(trackData);
            layoutController.addComponent(trackData);
            /** @type {SerializedLayout} */
            this.exportedLayout = {
              version: 1,
              date: Date.now(),
              layers: layoutController.layers.map((layer) => layer.serialize())
            };
        });

        it("exports the layout", function() {
            expect(this.exportedLayout.layers).toHaveSize(1);
            expect(this.exportedLayout.layers[0].components).toHaveSize(4);
        });

        it("exports the layout with proper data", function() {
            expect(LayoutController._validateImportData(this.exportedLayout)).toBeTrue();
        });
    });

    describe("onCreateCustomComponent", function() {
        beforeEach(function() {
            window.layoutController.reset();
        });

        it("creates a custom shape component", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(window.layoutController, 'addComponent').and.callThrough();
            window.layoutController.onCreateCustomComponent();
            let layoutController = window.layoutController;
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.objectContaining({type: "shape"}), false, {color: "#237841", width: 1600, height: 1600});
        });

        it("creates using studs as units", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(window.layoutController, 'addComponent').and.callThrough();
            window.layoutController.onCreateCustomComponent();
            let layoutController = window.layoutController;
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: 1600, height: 1600});
            expect(layoutController.currentLayer.children[0].sprite.width).toBe(1600);
            expect(layoutController.currentLayer.children[0].sprite.height).toBe(1600);
        });

        it("creates using centimeters as units", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('centimeters');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(window.layoutController, 'addComponent').and.callThrough();
            window.layoutController.onCreateCustomComponent();
            let layoutController = window.layoutController;
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: 2000, height: 2000});
            expect(layoutController.currentLayer.children[0].sprite.width).toBe(2000);
            expect(layoutController.currentLayer.children[0].sprite.height).toBe(2000);
        });

        it("creates using millimeters as units", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('millimeters');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(window.layoutController, 'addComponent').and.callThrough();
            window.layoutController.onCreateCustomComponent();
            let layoutController = window.layoutController;
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: 200, height: 200});
            expect(layoutController.currentLayer.children[0].sprite.width).toBe(200);
            expect(layoutController.currentLayer.children[0].sprite.height).toBe(200);
        });

        it("creates using inches as units", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('inches');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(window.layoutController, 'addComponent').and.callThrough();
            window.layoutController.onCreateCustomComponent();
            let layoutController = window.layoutController;
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: 5120, height: 5120});
            expect(layoutController.currentLayer.children[0].sprite.width).toBe(5120);
            expect(layoutController.currentLayer.children[0].sprite.height).toBe(5120);
        });

        it("creates using feet as units", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('feet');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(window.layoutController, 'addComponent').and.callThrough();
            window.layoutController.onCreateCustomComponent();
            let layoutController = window.layoutController;
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: 61440, height: 61440});
            expect(layoutController.currentLayer.children[0].sprite.width).toBe(61440);
            expect(layoutController.currentLayer.children[0].sprite.height).toBe(61440);
        });

        it("shows error when width is not a number", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('not a number');
            spyOnProperty(componentWidth, 'parentElement', 'get').and.returnValue({ classList: { add: () => {} } });
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let widthError = spyOnProperty(componentWidthError, 'innerText', 'set').and.stub();
            let heightError = spyOnProperty(componentHeightError, 'innerText', 'set').and.stub();
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let layoutController = window.layoutController;
            let addSpy = spyOn(layoutController, 'addComponent').and.stub();
            layoutController.onCreateCustomComponent();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(1);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(widthError).toHaveBeenCalled();
            expect(heightError).not.toHaveBeenCalled();
            expect(uiSpy).not.toHaveBeenCalled();
            expect(addSpy).not.toHaveBeenCalled();
        });

        it("shows error when height is not a number", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'parentElement', 'get').and.returnValue({ classList: { add: () => {} } });
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('not a number');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let widthError = spyOnProperty(componentWidthError, 'innerText', 'set').and.stub();
            let heightError = spyOnProperty(componentHeightError, 'innerText', 'set').and.stub();
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let layoutController = window.layoutController;
            let addSpy = spyOn(layoutController, 'addComponent').and.stub();
            layoutController.onCreateCustomComponent();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(1);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(widthError).not.toHaveBeenCalled();
            expect(heightError).toHaveBeenCalled();
            expect(uiSpy).not.toHaveBeenCalled();
            expect(addSpy).not.toHaveBeenCalled();
        });

        it("shows an error when width is 0", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('0');
            spyOnProperty(componentWidth, 'parentElement', 'get').and.returnValue({ classList: { add: () => {} } });
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let widthError = spyOnProperty(componentWidthError, 'innerText', 'set').and.stub();
            let heightError = spyOnProperty(componentHeightError, 'innerText', 'set').and.stub();
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let layoutController = window.layoutController;
            let addSpy = spyOn(layoutController, 'addComponent').and.stub();
            layoutController.onCreateCustomComponent();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(1);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(widthError).toHaveBeenCalled();
            expect(heightError).not.toHaveBeenCalled();
            expect(uiSpy).not.toHaveBeenCalled();
            expect(addSpy).not.toHaveBeenCalled();
        });

        it("shows an error when height is 0", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'parentElement', 'get').and.returnValue({ classList: { add: () => {} } });
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('0');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let widthError = spyOnProperty(componentWidthError, 'innerText', 'set').and.stub();
            let heightError = spyOnProperty(componentHeightError, 'innerText', 'set').and.stub();
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let layoutController = window.layoutController;
            let addSpy = spyOn(layoutController, 'addComponent').and.stub();
            layoutController.onCreateCustomComponent();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(1);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(widthError).not.toHaveBeenCalled();
            expect(heightError).toHaveBeenCalled();
            expect(uiSpy).not.toHaveBeenCalled();
            expect(addSpy).not.toHaveBeenCalled();
        });

        it("shows an error when width is empty", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('');
            spyOnProperty(componentWidth, 'parentElement', 'get').and.returnValue({ classList: { add: () => {} } });
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let widthError = spyOnProperty(componentWidthError, 'innerText', 'set').and.stub();
            let heightError = spyOnProperty(componentHeightError, 'innerText', 'set').and.stub();
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let layoutController = window.layoutController;
            let addSpy = spyOn(layoutController, 'addComponent').and.stub();
            layoutController.onCreateCustomComponent();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(1);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(widthError).toHaveBeenCalled();
            expect(heightError).not.toHaveBeenCalled();
            expect(uiSpy).not.toHaveBeenCalled();
            expect(addSpy).not.toHaveBeenCalled();
        });

        it("shows an error when height is empty", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'parentElement', 'get').and.returnValue({ classList: { add: () => {} } });
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let widthError = spyOnProperty(componentWidthError, 'innerText', 'set').and.stub();
            let heightError = spyOnProperty(componentHeightError, 'innerText', 'set').and.stub();
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let layoutController = window.layoutController;
            let addSpy = spyOn(layoutController, 'addComponent').and.stub();
            layoutController.onCreateCustomComponent();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(1);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(widthError).not.toHaveBeenCalled();
            expect(heightError).toHaveBeenCalled();
            expect(uiSpy).not.toHaveBeenCalled();
            expect(addSpy).not.toHaveBeenCalled();
        });

        it("creates with 50% opacity", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('16');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('16');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            spyOnProperty(componentOpacity, 'value', 'get').and.returnValue('50');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(window.layoutController, 'addComponent').and.callThrough();
            window.layoutController.onCreateCustomComponent();
            let layoutController = window.layoutController;
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: jasmine.any(Number), height: jasmine.any(Number), opacity: 0.5});
            expect(layoutController.currentLayer.children[0].sprite.alpha).toBe(0.5);
        });
        
        it("creates with a border", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('16');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('16');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            spyOnProperty(componentBorder, 'checked', 'get').and.returnValue(true);
            spyOnProperty(componentBorderColor, 'value', 'get').and.returnValue('#ff0000');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(window.layoutController, 'addComponent').and.callThrough();
            window.layoutController.onCreateCustomComponent();
            let layoutController = window.layoutController;
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: jasmine.any(Number), height: jasmine.any(Number), outlineColor: '#ff0000'});
            expect(layoutController.currentLayer.children[0].sprite.strokeStyle.width).toBe(8);
            expect(layoutController.currentLayer.children[0].sprite.strokeStyle.color).toBe(16711680); // #ff0000 in hex
        });

        it("creates with no border", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('16');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('16');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            spyOnProperty(componentBorder, 'checked', 'get').and.returnValue(false);
            spyOnProperty(componentBorderColor, 'value', 'get').and.returnValue('#ff0000');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(window.layoutController, 'addComponent').and.callThrough();
            window.layoutController.onCreateCustomComponent();
            let layoutController = window.layoutController;
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.objectContaining({type: "shape"}), false, {color: "#237841", width: jasmine.any(Number), height: jasmine.any(Number)});
            expect(layoutController.currentLayer.children[0].sprite.strokeStyle.width).toBe(1);
        });
    });

    describe("addComponent", function() {
        beforeEach(function() {
            window.layoutController.reset();
        });

        it("adds a component", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.addComponent(trackData);
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(2);
        });

        it("automatically connects components", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railCurved9V");
            for (let i = 0; i < 16; i++) {
                layoutController.addComponent(trackData, true);
            }
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
        });

        it("not automatically connects components", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railCurved9V");
            for (let i = 0; i < 16; i++) {
                layoutController.addComponent(trackData);
            }
            expect(layoutController.layers[0].openConnections).toHaveSize(2);
        });

        it("automatically connects multiple open connections", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railCrossing9V");
            layoutController.addComponent(trackData, true);
            let firstComp = layoutController.currentLayer.children[0];
            layoutController.addComponent(trackData, true);
            let midComp = layoutController.currentLayer.children[1];
            layoutController.addComponent(trackData, true);
            LayoutController.selectComponent(midComp);
            layoutController.addComponent(trackData, true);
            LayoutController.selectComponent(midComp);
            layoutController.addComponent(trackData, true);
            LayoutController.selectComponent(midComp);
            layoutController.deleteSelectedComponent();
            midComp = undefined;
            LayoutController.selectComponent(firstComp);
            layoutController.addComponent(trackData, true);
            firstComp = undefined;
            expect(layoutController.layers[0].openConnections).withContext("All Open Connections").toHaveSize(12);
            let o = layoutController.currentLayer.children.length - 2;
            expect(layoutController.currentLayer.children[o].getOpenConnections()).withContext("Middle component open connections").toHaveSize(0);
        });

        it("doesn't add a component when connections full", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.addComponent(trackData);
            let firstComp = layoutController.currentLayer.children[0];
            layoutController.addComponent(trackData);
            LayoutController.selectComponent(firstComp);
            layoutController.addComponent(trackData);
            LayoutController.selectComponent(firstComp);
            expect(layoutController.layers[0].children).withContext("Children before trying to add another").toHaveSize(4); // 3 components and 1 render layer
            layoutController.addComponent(trackData);
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).withContext("Children after trying to add another").toHaveSize(4); // 3 components and 1 render layer
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].children[1]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].children[2]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].children[3]).toBeInstanceOf(RenderLayer);
            expect(layoutController.layers[0].openConnections).withContext("All Open Connections").toHaveSize(2);
            expect(firstComp.getOpenConnections()).withContext("Middle component open connections").toHaveSize(0);
        });

        it("adds component next to selected component if no connections", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "lancaster30x60");
            layoutController.addComponent(trackData);
            let firstPose = layoutController.currentLayer.children[0].getPose();
            layoutController.addComponent(trackData);
            let secondPose = layoutController.currentLayer.children[1].getPose();
            expect(layoutController.currentLayer.children).toHaveSize(3);
            expect(layoutController.currentLayer.children[0]).toBeInstanceOf(Component);
            expect(layoutController.currentLayer.children[1]).toBeInstanceOf(Component);
            expect(layoutController.currentLayer.children[2]).toBeInstanceOf(RenderLayer);
            expect(secondPose.x).withContext("X position of new component").toBe(firstPose.x + layoutController.currentLayer.children[1].sprite.width);
            expect(secondPose.y).withContext("Y position of new component").toBe(firstPose.y);
            expect(secondPose.angle).toBe(firstPose.angle);
        });

        it("adds component next to rotated selected component if no connections", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "lancaster30x60");
            layoutController.addComponent(trackData);
            LayoutController.selectedComponent.rotate();
            let firstPose = layoutController.currentLayer.children[0].getPose();
            layoutController.addComponent(trackData);
            let secondPose = layoutController.currentLayer.children[1].getPose();
            expect(layoutController.currentLayer.children).toHaveSize(3);
            expect(layoutController.currentLayer.children[0]).toBeInstanceOf(Component);
            expect(layoutController.currentLayer.children[1]).toBeInstanceOf(Component);
            expect(layoutController.currentLayer.children[2]).toBeInstanceOf(RenderLayer);
            const offsetDistance = layoutController.currentLayer.children[1].sprite.width;
            const dx = Math.cos(firstPose.angle) * offsetDistance;
            const dy = Math.sin(firstPose.angle) * offsetDistance;
            expect(secondPose.x).withContext("X position of new component").toBeCloseTo(Math.fround(firstPose.x + dx), 4);
            expect(secondPose.y).withContext("Y position of new component").toBeCloseTo(Math.fround(firstPose.y + dy), 3);
            expect(secondPose.angle).toBe(firstPose.angle);
        });
    });

    describe("_validateImportData", function() {
        beforeEach(function() {
            /**
             * @type {SerializedLayout}
             */
            this.perfectMinimalImportData = {
                "version": 1,
                "date": "2021-09-01T00:00:00.000Z",
                "layers": [
                    {
                        "components": []
                    }
                ],
                "config": {}
            }
            /**
             * @type {SerializedLayout}
             */
            this.perfectImportData = {
                "version": 1,
                "date": "2021-09-01T00:00:00.000Z",
                "layers": [
                    {
                        "components": [
                            {
                                "type": "railStraight9V",
                                "pose": {
                                    "x": 542,
                                    "y": 420,
                                    "angle": 0
                                },
                                "connections": [
                                    {
                                        "uuid": "7944efd3-78de-400e-8534-d9529d421f0e",
                                        "otherConnection": ""
                                    },
                                    {
                                        "uuid": "b2584add-d96b-4720-bd02-a3b1b8218c86",
                                        "otherConnection": ""
                                    }
                                ]
                            },
                            {
                                "type": "baseplate",
                                "pose": {
                                    "x": 240,
                                    "y": 880,
                                    "angle": 0
                                },
                                "connections": [],
                                "width": 192,
                                "height": 192,
                                "color": "#a0a5a9"
                            },
                        ],
                        "name": "Layer 2",
                        "visible": true
                    },
                    {
                        "name": "Test Layer",
                        "visible": true,
                        "components": [
                            {
                                "type": "railStraight9V",
                                "pose": {
                                    "x": 0,
                                    "y": 0,
                                    "angle": 0
                                },
                                "connections": [
                                    {
                                        "uuid": "2235bb96-e4bb-4ef8-985f-9a1e38bd9dd0",
                                        "otherConnection": "402cbcf9-21d8-4fdf-91e4-976af48bd204"
                                    },
                                    {
                                        "uuid": "ebed056f-4987-44a8-9318-72a43f5b834e",
                                        "otherConnection": ""
                                    }
                                ]
                            },
                            {
                                "type": "railStraight9V",
                                "pose": {
                                    "x": 1174,
                                    "y": 275,
                                    "angle": 3.141592653589793
                                },
                                "connections": [
                                    {
                                        "uuid": "dad179d1-b328-4ffd-aa25-c289d97230d1",
                                        "otherConnection": "a407fe20-dd56-44c1-9d77-64bd5ffd40bd"
                                    },
                                    {
                                        "uuid": "402cbcf9-21d8-4fdf-91e4-976af48bd204",
                                        "otherConnection": "2235bb96-e4bb-4ef8-985f-9a1e38bd9dd0"
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "config": {}
            }
        });

        it("properly validates import data", function() {
            expect(LayoutController._validateImportData(this.perfectImportData)).toBe(true);
        });

        it("properly validates minimal import data", function() {
            expect(LayoutController._validateImportData(this.perfectMinimalImportData)).toBe(true);
        });

        it("validates layout 1", function() {
            expect(LayoutController._validateImportData(layoutFileOne)).toBeTrue();
        });

        it("validates layout 2", function() {
            expect(LayoutController._validateImportData(layoutFileTwo)).toBeTrue();
        });

        it("validates layout 4", function() {
            expect(LayoutController._validateImportData(layoutFileFour)).toBeTrue();
        });

        it("validates layout 5", function() {
            expect(LayoutController._validateImportData(layoutFileFive)).toBeTrue();
        });

        it("throws errors with invalid version", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.version = 0;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with 0 layers", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers = [];
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("allows with only 1 layer", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers = [this.perfectImportData.layers[0]];
            expect(LayoutController._validateImportData(testData)).toBeTrue();
        });

        it("throws errors with no version", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.version;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with no date", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.date;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with no layers element", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with blank layer", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0] = {};
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("allows a layer with 0 components", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0].components = [];
            expect(LayoutController._validateImportData(testData)).toBeTrue();
        });

        it("allows a layer with no name", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].name;
            expect(LayoutController._validateImportData(testData)).toBeTrue();
        });

        it("allows a layer with no visible", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].visible;
            expect(LayoutController._validateImportData(testData)).toBeTrue();
        });

        it("allows an invisible layer", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0].visible = false;
            expect(LayoutController._validateImportData(testData)).toBeTrue();
        });

        it("throws errors with no component type", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].components[0].type;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with invalid component type", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0].components[0].type = 123;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with blank component type", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0].components[0].type = "";
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with non-existence component type", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0].components[0].type = "thiswillneverexist";
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with no component pose", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].components[0].pose;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with no component pose.x", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].components[0].pose.x;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with no component pose.y", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].components[0].pose.y;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with no component pose.angle", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].components[0].pose.angle;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with no component connections", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].components[0].connections;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with invalid component connections", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0].components[0].connections = "test";
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with no component connection uuid", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].components[0].connections[0].uuid;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with invalid component connection uuid", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0].components[0].connections[0].uuid = "test";
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with no component connection other", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].components[0].connections[0].otherConnection;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with invalid component width", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0].components[1].width = "test";
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with invalid component height", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0].components[1].height = "test";
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws errors with invalid component color", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.layers[0].components[1].color = "test";
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });
    });

    describe("_importLayout", function() {
        it("imports layout 1", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            layoutController._importLayout(layoutFileOne);
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].openConnections).toHaveSize(4);
            expect(layoutController.layers[0].children).toHaveSize(34);
            layoutController.layers[0].children.forEach((child, index) => {
                if (index == 33) {
                    expect(child).toBeInstanceOf(RenderLayer);
                    return;
                }
                expect(child).toBeInstanceOf(Component);
                expect(child.connections.length).toBeGreaterThanOrEqual(2);
                expect(child.connections.length).toBeLessThanOrEqual(4);
            });
        });

        it("imports layout 2", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            layoutController._importLayout(layoutFileTwo);
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(layoutController.layers[0].children).toHaveSize(34);
            layoutController.layers[0].children.forEach((child, index) => {
                if (index == 33) {
                    expect(child).toBeInstanceOf(RenderLayer);
                    return;
                }
                expect(child).toBeInstanceOf(Component);
                expect(child.connections.length).toBeGreaterThanOrEqual(2);
                expect(child.connections.length).toBeLessThanOrEqual(4);
                child.connections.forEach((connection) => {
                    expect(connection).withContext(`Connection ${connection.uuid}`).toBeInstanceOf(Connection);
                    expect(connection.otherConnection).withContext(`Connection ${connection.uuid}`).not.toBeNull();
                });
            });
        });

        it("imports layout 4", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            layoutController._importLayout(layoutFileFour);
            expect(layoutController.layers).toHaveSize(3);

            // Verify the layers are in the correct order
            expect(layoutController.layers[0].label).toBe("Layer 3");
            expect(layoutController.layers[1].label).toBe("Layer 2");
            expect(layoutController.layers[2].label).toBe("Layer 1");

            // Verify the layers are visible (or not)
            expect(layoutController.layers[0].visible).toBeTrue();
            expect(layoutController.layers[1].visible).toBeFalse();
            expect(layoutController.layers[2].visible).toBeTrue();

            // Verify only the top layer is active
            expect(layoutController.layers[0].eventMode).toBe("none");
            expect(layoutController.layers[0].interactiveChildren).toBeFalse();
            expect(layoutController.layers[1].eventMode).toBe("none");
            expect(layoutController.layers[1].interactiveChildren).toBeFalse();
            expect(layoutController.layers[2].eventMode).toBe("passive");
            expect(layoutController.layers[2].interactiveChildren).toBeTrue();
        });

        it("imports layout 5", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            layoutController._importLayout(layoutFileFive);
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(layoutController.layers[0].children).toHaveSize(6);
            layoutController.layers[0].children.forEach((child, index) => {
                if (index == 5) {
                    expect(child).toBeInstanceOf(RenderLayer);
                    expect(child.renderLayerChildren).toHaveSize(0);
                    return;
                }
                expect(child).toBeInstanceOf(Component);
                if (index == 0) {
                    expect(child.sprite).toBeInstanceOf(Sprite);
                } else {
                    expect(child.sprite).toBeInstanceOf(Graphics);
                    if (index == 4) {
                        expect(child.sprite.alpha).toBe(0.5);
                        expect(child.sprite.strokeStyle.width).toBe(8);
                        expect(child.sprite.strokeStyle.color).toBe(6836680); // #6851C8
                        expect(child.sprite.fillStyle.color).toBe(13179401); // #C91A09
                    } else {
                        expect(child.sprite.alpha).toBe(1);
                        if (index == 3) {
                           expect(child.sprite.strokeStyle.width).toBe(1);
                        } else if (index == 2 || index == 1) {
                            expect(child.sprite.strokeStyle.width).toBe(8);
                            expect(child.sprite.strokeStyle.color).toBe(0); // #000000
                            expect(child.sprite.fillStyle.color).toBe(2324545); // #237841
                        }
                    }
                }
                expect(child.connections.length).toBe(0);
            });
        });
    });


    describe("Connection", function() {
        it("keeps track of open connections", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.reset();
            layoutController.addComponent(trackData);
            layoutController.addComponent(trackData);
            layoutController.addComponent(trackData);
            layoutController.addComponent(trackData);
            let layer = layoutController.layers[0];
            expect(layer.openConnections).toHaveSize(2);
            let component = layer.children[1];
            let connection = component.connections[0];
            connection.disconnect();
            expect(layer.openConnections).toHaveSize(4);
            connection.connectTo(layer.openConnections.values().next().value);
            expect(layer.openConnections).toHaveSize(2);
        });

        it("handles UUID changes", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.reset();
            layoutController.addComponent(trackData);
            let layer = layoutController.layers[0];
            let component = layer.children[0];
            expect(layer.openConnections).toHaveSize(2);
            expect(layer.openConnections.has(component.connections[0].uuid)).toBeTrue();
            let oldUUID = component.connections[0].uuid;
            let newUUID = crypto.randomUUID();
            component.connections[0].uuid = newUUID;
            expect(layer.openConnections).toHaveSize(2);
            expect(layer.openConnections.has(newUUID)).toBeTrue();
            expect(layer.openConnections.has(oldUUID)).toBeFalse();
            expect(layer.openConnections.has(component.connections[1].uuid)).toBeTrue();
        });
    });

    describe("Component", function() {
        it("checks for open connection on rotate", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            layoutController._importLayout(layoutFileThree);
            /** @type {Component} */
            let curveTrack = layoutController.currentLayer.children.find(/** @param {Component} c */(c) => c.baseData.alias == "railCurved9V");
            expect(curveTrack).toBeDefined();
            expect(curveTrack.getOpenConnections()).withContext("List of open connections").toHaveSize(1);
            curveTrack.rotate();
            expect(curveTrack.getOpenConnections()).withContext("List of open connections after rotate").toHaveSize(0);
        });
    });
});

describe("Pose", function() {
    it("normalizes angles", function() {
        let pose = new Pose(0, 0, 7 * Math.PI);
        expect(pose.angle).toBeCloseTo(Math.PI);
    });

    it("doesn't modify angles less than 2π", function() {
        let pose = new Pose(0, 0, Math.PI);
        expect(pose.angle).toBe(Math.PI);
    });

    it("checks equality", function() {
        let pose1 = new Pose(100, 50, Math.PI / 4);
        let pose2 = new Pose(100, 50, Math.PI / 4);
        expect(pose1.equals(pose2)).toBeTrue();

        let pose3 = new Pose(50, 100, Math.PI / 2);
        expect(pose1.equals(pose3)).toBeFalse();
    });

    it("checks if a pose is within a radius", function() {
        let pose1 = new Pose(0, 0, 0);
        let pose2 = new Pose(1, 1, 0);
        expect(pose1.isInRadius(pose2, 1)).toBeTrue();
        expect(pose1.isInRadius(pose2, 0.5)).toBeFalse();
    });

    it("checks if a pose has an opposite angle", function() {
        let pose1 = new Pose(0, 0, 0);
        let pose2 = new Pose(0, 0, Math.PI - 1e-11);
        expect(pose1.hasOppositeAngle(pose2)).toBeTrue();
        expect(pose1.hasOppositeAngle(pose2, 1e-10)).toBeTrue();
        expect(pose1.hasOppositeAngle(pose2, 1e-20)).withContext("larger epsilon").toBeFalse();
        let pose3 = new Pose(0, 0, Math.PI / 2);
        expect(pose1.hasOppositeAngle(pose3)).toBeFalse();
    });

    it("normalizes negative angles", function() {
        let pose = new Pose(0, 0, -Math.PI);
        expect(pose.angle).toBeCloseTo(Math.PI);
    });
});

describe("LayoutLayer", function() {
    it("creates a new LayoutLayer", function() {
        let layoutLayer = new LayoutLayer();
        expect(layoutLayer).toBeInstanceOf(LayoutLayer);
        expect(layoutLayer.children).toHaveSize(1);
        expect(layoutLayer.openConnections).toHaveSize(0);
        expect(layoutLayer.overlay).toBeInstanceOf(RenderLayer);
    });

    it("destroys a LayoutLayer", function() {
        let layoutLayer = new LayoutLayer();
        layoutLayer.destroy();
        expect(layoutLayer.overlay).toBeNull();
    });

    it("validates a valid serialized layout layer", function() {
        let compSpy = spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [1],
            name: "Test Layer",
            visible: true
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeTrue();
        expect(compSpy).toHaveBeenCalledTimes(1);
    });

    it("validates a valid minimal serialized layout layer", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [1]
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeTrue();
    });

    it("validates a layer with no components", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: []
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeTrue();
    });

    it("does not validate a serialized with bad name", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [1],
            name: 1
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeFalse();
    });

    it("does not validate a serialized with blank name", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [1],
            name: ""
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeFalse();
    });

    it("does not validate a serialized with bad visible", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [1],
            visible: "hello"
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeFalse();
    });

    it("deserializes a minimal serialized layout layer", function() {
        let serialized = {
            components: [1],
        };
        let layoutLayer = new LayoutLayer();
        layoutLayer.deserialize(serialized);
        expect(layoutLayer.label).toBe("New Layer");
        expect(layoutLayer.visible).toBeTrue();
    });

    it("deserializes a serialized layout layer", function() {
        let serialized = {
            components: [1],
            name: "Test Layer",
            visible: false
        };
        let layoutLayer = new LayoutLayer();
        layoutLayer.deserialize(serialized);
        expect(layoutLayer.label).toBe("Test Layer");
        expect(layoutLayer.visible).toBeFalse();
    });

    it("throws an error when deserializing a serialized layout layer with no data", function() {
        let layoutLayer = new LayoutLayer();
        expect(() => layoutLayer.deserialize()).toThrowError("Invalid data");
    });

    it("serializes a valid layout layer", function() {
        let layoutLayer = new LayoutLayer();
        layoutLayer.label = "Test Layer";
        layoutLayer.visible = true;
        let serialized = layoutLayer.serialize();
        expect(serialized).toEqual({
            components: [],
            name: "Test Layer",
            visible: true
        });
    });
});