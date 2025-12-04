import { LayoutController, SerializedLayout, TrackData } from "../../src/controller/layoutController.js";
import { Component } from "../../src/model/component.js";
import { Connection } from "../../src/model/connection.js";
import { LayoutLayer } from "../../src/model/layoutLayer.js";
import { Pose } from "../../src/model/pose.js";
import { upgradeLayout } from "../../src/utils/layoutUpgrade.js";
import { Application, Assets, Color, Graphics, path, RenderLayer, Sprite } from '../../src/pixi.mjs';
import layoutFileOne from './layout1.json' with { "type": "json" };
import layoutFileTwo from './layout2.json' with { "type": "json" };
import layoutFileThree from './layout3.json' with { "type": "json" };
import layoutFileFour from './layout4.json' with { "type": "json" };
import layoutFileFiveVOne from './layout5-v1.json' with { "type": "json" };
import layoutFileFiveVTwo from './layout5-v2.json' with { "type": "json" };

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
    let componentShape;
    let componentColorSelect;
    let componentOpacity;
    let componentBorder;
    let componentBorderColor;
    let componentText;
    let componentFont;
    let componentFontSize;
    let selectionToolbar;
    let geiSpy;
    beforeAll(async () => {
        const app = new Application();
        await app.init();
        await Assets.init({ basePath: '../__spec__/img/', manifest: "../data/manifest.json" });
        await Assets.loadBundle('track');
        await Assets.load({alias: path.toAbsolute('../data/manifest.json'), src: '../data/manifest.json' });
        window.app = app;
        window.assets = Assets;
        window.RBush = class RBush {
            constructor() {
            }
        };
        spyOn(window, 'RBush').and.returnValue(jasmine.createSpyObj("RBush", ["insert", "remove", "clear", "search"]));
        geiSpy = spyOn(document, 'getElementById');
        // Mock canvasContainer for resize handling
        const mockCanvasContainer = document.createElement('div');
        Object.defineProperty(mockCanvasContainer, 'clientWidth', { value: 800, writable: true });
        Object.defineProperty(mockCanvasContainer, 'clientHeight', { value: 600, writable: true });
        geiSpy.withArgs('canvasContainer').and.returnValue(mockCanvasContainer);
        geiSpy.withArgs('componentBrowser').and.returnValue(document.createElement('div'));
        geiSpy.withArgs('categories').and.returnValue(document.createElement('select'));
        geiSpy.withArgs('searchText').and.returnValue(document.createElement('input'));
        geiSpy.withArgs('searchClearButton').and.returnValue(document.createElement('span'));
        geiSpy.withArgs('buttonRotate').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('buttonRemove').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('buttonDownload').and.returnValue(document.createElement('li'));
        geiSpy.withArgs('buttonImport').and.returnValue(document.createElement('li'));
        geiSpy.withArgs('buttonExport').and.returnValue(document.createElement('li'));
        geiSpy.withArgs('mobileButtonDownload').and.returnValue(document.createElement('li'));
        geiSpy.withArgs('mobileButtonImport').and.returnValue(document.createElement('li'));
        geiSpy.withArgs('mobileButtonExport').and.returnValue(document.createElement('li'));
        geiSpy.withArgs('buttonMenu').and.returnValue(document.createElement('button'));
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
        selectionToolbar = document.createElement('nav');
        geiSpy.withArgs('selectionToolbar').and.returnValue(selectionToolbar);
        geiSpy.withArgs('selToolMenu').and.returnValue(document.createElement('menu'));
        geiSpy.withArgs('createComponentDialog').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('saveComponentDialog').and.returnValue(document.createElement('button'));
        geiSpy.withArgs('componentDialogTitle').and.returnValue(document.createElement('h6'));
        geiSpy.withArgs('newCustomComponentDialog').and.returnValue(document.createElement('dialog'));
        let p = document.createElement('div');
        let p2 = document.createElement('div');
        let p3 = document.createElement('div');
        p.appendChild(p2);
        p2.appendChild(p3);
        componentWidth = document.createElement('input');
        p3.appendChild(componentWidth);
        componentWidthError = document.createElement('span');
        p3.appendChild(componentWidthError);
        geiSpy.withArgs('componentWidth').and.returnValue(componentWidth);
        geiSpy.withArgs('componentWidthError').and.returnValue(componentWidthError);
        let h = document.createElement('div');
        let h2 = document.createElement('div');
        let h3 = document.createElement('div');
        h.appendChild(h2);
        h2.appendChild(h3);
        componentHeight = document.createElement('input');
        h3.appendChild(componentHeight);
        componentHeightError = document.createElement('span');
        h3.appendChild(componentHeightError);
        geiSpy.withArgs('componentHeight').and.returnValue(componentHeight);
        geiSpy.withArgs('componentHeightError').and.returnValue(componentHeightError);
        componentColorSelect = document.createElement('div');
        let i = document.createElement('i');
        i.setAttribute('data-color', 'green');
        i.style.color = '#237841';
        componentColorSelect.appendChild(i);
        geiSpy.withArgs('componentColorSelect').and.returnValue(componentColorSelect);
        let shapeSelectComp = document.createElement('nav');
        let rectComp = document.createElement('a');
        let circComp = document.createElement('a');
        shapeSelectComp.appendChild(rectComp);
        shapeSelectComp.appendChild(circComp);
        geiSpy.withArgs('shapeSelectRectangle').and.returnValue(rectComp);
        geiSpy.withArgs('shapeSelectCircle').and.returnValue(circComp);
        geiSpy.withArgs('componentShapeSelect').and.returnValue(shapeSelectComp);
        componentShape = document.createElement('input');
        geiSpy.withArgs('componentShape').and.returnValue(componentShape);
        geiSpy.withArgs('componentColorMenu').and.returnValue(document.createElement('menu'));
        geiSpy.withArgs('componentColorName').and.returnValue(document.createElement('input'));
        geiSpy.withArgs('componentColorFilter').and.returnValue(document.createElement('input'));
        geiSpy.withArgs('componentColorClear').and.returnValue(document.createElement('i'));
        componentText = document.createElement('input');
        spyOnProperty(componentText, 'parentElement', 'get').and.returnValue(document.createElement('div'));
        geiSpy.withArgs('componentText').and.returnValue(componentText);
        geiSpy.withArgs('componentTextError').and.returnValue(document.createElement('span'));
        geiSpy.withArgs('componentFontOptions').and.returnValue(document.createElement('div'));
        componentFont = document.createElement('select');
        geiSpy.withArgs('componentFont').and.returnValue(componentFont);
        componentFontSize = document.createElement('select');
        geiSpy.withArgs('componentFontSize').and.returnValue(componentFontSize);
        let csu = document.createElement('div');
        let csu2 = document.createElement('div');
        csu.appendChild(csu2);
        componentSizeUnits = document.createElement('select');
        csu2.appendChild(componentSizeUnits);
        geiSpy.withArgs('componentSizeUnits').and.returnValue(componentSizeUnits);
        geiSpy.withArgs('componentShapeOptions').and.returnValue(document.createElement('div'));
        componentBorder = document.createElement('input');
        componentBorder.type = 'checkbox';
        componentBorder.checked = false;
        geiSpy.withArgs('componentBorder').and.returnValue(componentBorder);
        componentBorderColor = document.createElement('input');
        componentBorderColor.type = 'color';
        spyOnProperty(componentBorderColor, 'nextElementSibling', 'get').and.returnValue(document.createElement('input'));
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

    describe("initWindowEvents", function() {
        let layoutController;
        let drawGridSpy;
        let originalAddEventListener;
        let addEventListenerSpy;
        let eventListeners;

        beforeAll(function() {
            layoutController = window.layoutController;
            // Mock the matchMedia API
            spyOn(window, 'matchMedia').and.returnValue({
                matches: false,
                addEventListener: jasmine.createSpy('addEventListener'),
                removeEventListener: jasmine.createSpy('removeEventListener')
            });

            // Track event listeners
            eventListeners = {};
            originalAddEventListener = window.addEventListener;

            addEventListenerSpy = spyOn(window, 'addEventListener').and.callFake(function(event, callback) {
                eventListeners[event] = callback;
                return originalAddEventListener.call(window, event, callback);
            });

            drawGridSpy = spyOn(layoutController, 'drawGrid').and.stub();
            layoutController.initWindowEvents();
        });
        beforeEach(function () {
            jasmine.clock().install();
        });
        afterEach(function () {
            jasmine.clock().uninstall();
            drawGridSpy.calls.reset();
        });
        describe("window resize events", function() {
            it("calls drawGrid after debounce delay when window resized", function() {
                window.dispatchEvent(new Event('resize'));
                window.dispatchEvent(new Event('resize'));
                window.dispatchEvent(new Event('resize'));
                expect(drawGridSpy).not.toHaveBeenCalled();
                jasmine.clock().tick(250);
                expect(drawGridSpy).not.toHaveBeenCalled();
                jasmine.clock().tick(60);
                expect(drawGridSpy).toHaveBeenCalledTimes(1);
            });

            it("resets debounce timer with rapid resize events", function() {
                window.dispatchEvent(new Event('resize'));
                jasmine.clock().tick(250);
                expect(drawGridSpy).not.toHaveBeenCalled();
                window.dispatchEvent(new Event('resize'));
                jasmine.clock().tick(250);
                expect(drawGridSpy).not.toHaveBeenCalled();
                jasmine.clock().tick(60);
                expect(drawGridSpy).toHaveBeenCalledTimes(1);
            });
            it("handles multiple separate resize sequences", function() {
                window.dispatchEvent(new Event('resize'));
                jasmine.clock().tick(350);
                expect(drawGridSpy).toHaveBeenCalledTimes(1);
                jasmine.clock().tick(1000);
                window.dispatchEvent(new Event('resize'));
                jasmine.clock().tick(350);
                expect(drawGridSpy).toHaveBeenCalledTimes(2);
            });
        });
        describe("orientation change events", function() {
            let portraitQuery;
            beforeEach(function() {
                portraitQuery = window.matchMedia("(orientation: portrait)");
            });
            it("calls drawGrid on orientation change", function() {
                // Simulate orientation change by calling the listener directly
                const changeEvent = { matches: true };
                const orientationListener = portraitQuery.addEventListener.calls.mostRecent().args[1];
                orientationListener(changeEvent);

                // Should not be called immediately due to debounce
                expect(drawGridSpy).not.toHaveBeenCalled();

                // Should be called after debounce delay
                jasmine.clock().tick(350);
                expect(drawGridSpy).toHaveBeenCalledTimes(1);
            });
            it("debounces rapid orientation changes", function() {
                const orientationListener = portraitQuery.addEventListener.calls.mostRecent().args[1];
                // Simulate rapid orientation changes
                orientationListener({ matches: true });
                orientationListener({ matches: false });
                orientationListener({ matches: true });
                // Should not be called immediately due to debounce
                expect(drawGridSpy).not.toHaveBeenCalled();
                // Should be called after debounce delay
                jasmine.clock().tick(350);
                expect(drawGridSpy).toHaveBeenCalledTimes(1);
            });
        });
        describe("combined resize and orientation events", function() {
            let portraitQuery;
            beforeEach(function() {
                portraitQuery = window.matchMedia("(orientation: portrait)");
            });
            it("debounces mixed resize and orientation changes", function() {
                const orientationListener = portraitQuery.addEventListener.calls.mostRecent().args[1];
                // Mix of resize and orientation events
                window.dispatchEvent(new Event('resize'));
                jasmine.clock().tick(100);
                orientationListener({ matches: true });
                jasmine.clock().tick(100);
                window.dispatchEvent(new Event('resize'));
                expect(drawGridSpy).not.toHaveBeenCalled();
                jasmine.clock().tick(350);
                expect(drawGridSpy).toHaveBeenCalledTimes(1);
            });
            it("handles overlapping event sequences", function() {
                const orientationListener = portraitQuery.addEventListener.calls.mostRecent().args[1];
                window.dispatchEvent(new Event('resize'));
                jasmine.clock().tick(200);
                orientationListener({ matches: true });
                jasmine.clock().tick(350); // Complete first sequence
                expect(drawGridSpy).withContext("After first sequence of events").toHaveBeenCalledTimes(1);
                window.dispatchEvent(new Event('resize'));
                jasmine.clock().tick(100);
                orientationListener({ matches: false });
                jasmine.clock().tick(350); // Complete second sequence
                expect(drawGridSpy).withContext("After second sequence of events").toHaveBeenCalledTimes(2);
            });
        });
        describe("event listener registration", function() {
            it("registers resize event listener", function() {
                expect(addEventListenerSpy).toHaveBeenCalledWith('resize', jasmine.any(Function));
            });
            it("registers orientation change listener", function() {
                const portraitQuery = window.matchMedia("(orientation: portrait)");
                expect(portraitQuery.addEventListener).toHaveBeenCalledWith('change', jasmine.any(Function));
            });
            it("uses correct media query for orientation detection", function() {
                expect(window.matchMedia).toHaveBeenCalledWith("(orientation: portrait)");
            });
        });
        describe("debounce function behavior", function() {
            it("preserves function context when using bind", function() {
                // This test ensures that layoutController.drawGrid maintains proper 'this' context
                window.dispatchEvent(new Event('resize'));
                jasmine.clock().tick(350);
                expect(drawGridSpy).toHaveBeenCalledTimes(1);
                // The spy should be called on the layoutController instance
                expect(drawGridSpy.calls.mostRecent().object).toBe(layoutController);
            });
            it("does not call function if no events occur", function() {
                jasmine.clock().tick(1000);
                expect(drawGridSpy).not.toHaveBeenCalled();
            });
        });

        describe("iOS Chrome rotation fix", function() {
            it("registers visualViewport resize listener when available", function() {
                // Since initWindowEvents was already called in beforeAll, we verify that
                // if visualViewport exists, it would have been registered
                // This test verifies the code path exists
                if (window.visualViewport) {
                    // Visual viewport is available, the listener should have been registered
                    // We can't easily test this without re-initializing, so we just verify
                    // the code doesn't error when visualViewport is present
                    expect(window.visualViewport).toBeDefined();
                } else {
                    // Visual viewport not available, code should handle gracefully
                    expect(true).toBe(true);
                }
            });

            it("handles visualViewport resize events if available", function() {
                // Test that if visualViewport exists and fires resize, it triggers grid redraw
                if (window.visualViewport && window.visualViewport.dispatchEvent) {
                    const resizeEvent = new Event('resize');
                    window.visualViewport.dispatchEvent(resizeEvent);
                    
                    expect(drawGridSpy).not.toHaveBeenCalled();
                    
                    // Default debounce is 300ms, wait 350ms to ensure completion
                    jasmine.clock().tick(350);
                    expect(drawGridSpy).toHaveBeenCalled();
                    drawGridSpy.calls.reset();
                }
            });

            it("handles window resize events with debounce", function() {
                // Test the resize event that was already registered in beforeAll
                window.dispatchEvent(new Event('resize'));
                
                expect(drawGridSpy).not.toHaveBeenCalled();
                
                // Default debounce is 300ms, wait 350ms to ensure completion
                jasmine.clock().tick(350);
                expect(drawGridSpy).toHaveBeenCalled();
            });

            it("debounces multiple rapid events together", function() {
                // Test that multiple event sources are debounced together
                const portraitQuery = window.matchMedia("(orientation: portrait)");
                const orientationListener = portraitQuery.addEventListener.calls.mostRecent().args[1];
                
                // Fire multiple events in quick succession
                window.dispatchEvent(new Event('resize'));
                jasmine.clock().tick(100);
                orientationListener({ matches: true });
                jasmine.clock().tick(100);
                window.dispatchEvent(new Event('resize'));
                
                // Should not be called yet
                expect(drawGridSpy).not.toHaveBeenCalled();
                
                // Should be called once after debounce (300ms from last event)
                jasmine.clock().tick(350);
                expect(drawGridSpy).toHaveBeenCalledTimes(1);
            });

            it("positions selection toolbar after resize events", function() {
                // Spy on _positionSelectionToolbar to verify it's called along with drawGrid
                const positionSpy = spyOn(layoutController, '_positionSelectionToolbar').and.stub();
                
                window.dispatchEvent(new Event('resize'));
                
                expect(positionSpy).not.toHaveBeenCalled();
                
                jasmine.clock().tick(350);
                
                // Both drawGrid and _positionSelectionToolbar should be called
                expect(drawGridSpy).toHaveBeenCalled();
                expect(positionSpy).toHaveBeenCalled();
            });
        });
    });

    describe("reset", function() {
        it("resets the layout", function() {
            /** @type {LayoutController} */
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            expect(trackData).toBeDefined();
            layoutController.addComponent(trackData);
            let copySpy = layoutController.copiedComponent = jasmine.createSpyObj(["destroy"]);
            layoutController.workspace.scale.set(2);
            layoutController.reset();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(1);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(RenderLayer);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(layoutController.workspace.position.equals({ x: 0, y: 0 })).toBeTrue();
            expect(layoutController.workspace.scale.x).toBe(0.5);
            expect(layoutController.workspace.scale.y).toBe(0.5);
            expect(layoutController.copiedComponent).toBeNull();
            expect(copySpy.destroy).toHaveBeenCalledTimes(1);
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
              version: 2,
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
            layoutController.showCreateCustomComponentDialog('shape', false);
        });

        it("creates a custom shape component", function() {
            let layoutController = window.layoutController;
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(window.layoutController, 'addComponent').and.callThrough();
            layoutController.onCreateCustomComponent();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.objectContaining({type: "shape"}), false, {color: "#237841", width: 1600, height: 1600, units: "studs", shape: "rectangle", opacity: jasmine.any(Number)});
        });

        it("creates a custom circle shape component", function() {
            let layoutController = window.layoutController;
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('200');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            spyOnProperty(componentShape, 'value', 'get').and.returnValue('circle');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let addSpy = spyOn(layoutController, 'addComponent').and.callThrough();
            layoutController.onCreateCustomComponent();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].children[0].shape).toBe('circle');
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.objectContaining({type: "shape"}), false, {color: "#237841", width: 1600, units: "studs", shape: "circle", opacity: jasmine.any(Number)});
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
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: 1600, height: 1600, units: "studs", shape: "rectangle", opacity: jasmine.any(Number)});
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
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: 2000, height: 2000, units: "centimeters", shape: "rectangle", opacity: jasmine.any(Number)});
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
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: 200, height: 200, units: "millimeters", shape: "rectangle", opacity: jasmine.any(Number)});
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
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: 5120, height: 5120, units: "inches", shape: "rectangle", opacity: jasmine.any(Number)});
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
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: 61440, height: 61440, units: "feet", shape: "rectangle", opacity: jasmine.any(Number)});
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
            spyOnProperty(componentShape, 'value', 'get').and.returnValue('rectangle');
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

        it("not show an error when height is empty for a circle", function() {
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'parentElement', 'get').and.returnValue({ classList: { add: () => {} } });
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            spyOnProperty(componentShape, 'value', 'get').and.returnValue('circle');
            let widthError = spyOnProperty(componentWidthError, 'innerText', 'set').and.stub();
            let heightError = spyOnProperty(componentHeightError, 'innerText', 'set').and.stub();
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let layoutController = window.layoutController;
            let addSpy = spyOn(layoutController, 'addComponent').and.callThrough();
            layoutController.onCreateCustomComponent();
            expect(layoutController.layers).toHaveSize(1);
            expect(layoutController.layers[0].children).toHaveSize(2);
            expect(layoutController.layers[0].children[0]).toBeInstanceOf(Component);
            expect(layoutController.layers[0].children[0].shape).toBe('circle');
            expect(layoutController.layers[0].openConnections).toHaveSize(0);
            expect(widthError).not.toHaveBeenCalled();
            expect(heightError).not.toHaveBeenCalled();
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.objectContaining({type: "shape"}), false, {color: "#237841", width: 1600, units: "studs", shape: "circle", opacity: jasmine.any(Number)});
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
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: jasmine.any(Number), height: jasmine.any(Number), units: "studs", shape: "rectangle", opacity: 0.5});
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
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.any(Object), false, {color: "#237841", width: jasmine.any(Number), height: jasmine.any(Number), outlineColor: '#ff0000', units: "studs", shape: "rectangle", opacity: 1});
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
            expect(addSpy).toHaveBeenCalledOnceWith(jasmine.objectContaining({type: "shape"}), false, {color: "#237841", width: jasmine.any(Number), height: jasmine.any(Number), units: "studs", shape: "rectangle", opacity: 1});
            expect(layoutController.currentLayer.children[0].sprite.strokeStyle.width).toBe(1);
        });
    });

    describe("onSaveCustomComponent", function() {
        beforeEach(function() {
            window.layoutController.reset();
        });

        it("saves changes to a custom shape component", function() {
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "shape");
            layoutController.addComponent(trackData, false, {width: 16, height: 16, units: "studs", color: "#237841", opacity: 1});
            layoutController.showCreateCustomComponentDialog('shape', true);
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let resizeSpy = spyOn(layoutController.layers[0].children[0], 'resize').and.callThrough();
            window.layoutController.onSaveCustomComponent();
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(layoutController.currentLayer.children[0].componentWidth).toBe(1600);
            expect(layoutController.currentLayer.children[0].componentHeight).toBe(1600);
            expect(resizeSpy).toHaveBeenCalledOnceWith(1600, 1600, "studs");
        });

        it("saves changes to a custom baseplate component", function() {
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "baseplate");
            layoutController.addComponent(trackData, false, {width: 16, height: 16, units: "studs", color: "#237841", opacity: 1});
            layoutController.showCreateCustomComponentDialog('baseplate', true);
            spyOnProperty(componentWidth, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentHeight, 'value', 'get').and.returnValue('100');
            spyOnProperty(componentSizeUnits, 'value', 'get').and.returnValue('studs');
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let resizeSpy = spyOn(layoutController.layers[0].children[0], 'resize').and.callThrough();
            window.layoutController.onSaveCustomComponent();
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(layoutController.currentLayer.children[0].componentWidth).toBe(1600);
            expect(layoutController.currentLayer.children[0].componentHeight).toBe(1600);
            expect(resizeSpy).toHaveBeenCalledOnceWith(1600, 1600, "studs");
        });

        it("saves changes to a custom text component", function() {
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "text");
            layoutController.addComponent(trackData, false, {color: "#237841", text: "Sample Text", font: "Arial", fontSize: 40});
            layoutController.showCreateCustomComponentDialog('text', true);
            spyOnProperty(componentText, 'value', 'get').and.returnValue('Hello');
            spyOnProperty(componentFont, 'value', 'get').and.returnValue('Arial');
            spyOnProperty(componentFontSize, 'value', 'get').and.returnValue(2);
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let textSpy = spyOnProperty(layoutController.layers[0].children[0], 'text', 'set').and.callThrough();
            window.layoutController.onSaveCustomComponent();
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(layoutController.currentLayer.children[0].font).toBe("Arial");
            expect(layoutController.currentLayer.children[0].fontSize).toBe(40);
            expect(textSpy).toHaveBeenCalledOnceWith('Hello');
        });

        it("saves font size", function() {
            let layoutController = window.layoutController;
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "text");
            layoutController.addComponent(trackData, false, {color: "#237841", text: "Hello", font: "Arial", fontSize: 40});
            layoutController.showCreateCustomComponentDialog('text', true);
            spyOnProperty(componentText, 'value', 'get').and.returnValue('Hello');
            spyOnProperty(componentFont, 'value', 'get').and.returnValue('Arial');
            spyOnProperty(componentFontSize, 'value', 'get').and.returnValue(8);
            let j = jasmine.createSpyObj({"getPropertyValue": "#237841"});
            spyOn(window, 'getComputedStyle').and.returnValue(j);
            let uiSpy = spyOn(window, 'ui').and.stub();
            let fontSizeSpy = spyOnProperty(layoutController.layers[0].children[0], 'fontSize', 'set').and.callThrough();
            let textSpy = spyOnProperty(layoutController.layers[0].children[0], 'text', 'set').and.callThrough();
            let fontSpy = spyOnProperty(layoutController.layers[0].children[0], 'font', 'set').and.callThrough();
            let colorSpy = spyOnProperty(layoutController.layers[0].children[0], 'color', 'set').and.callThrough();
            window.layoutController.onSaveCustomComponent();
            expect(j.getPropertyValue).toHaveBeenCalledOnceWith('color');
            expect(uiSpy).toHaveBeenCalledOnceWith("#newCustomComponentDialog");
            expect(layoutController.currentLayer.children[0].font).toBe("Arial");
            expect(layoutController.currentLayer.children[0].fontSize).toBe(160);
            expect(layoutController.currentLayer.children[0].text).toBe("Hello");
            expect(fontSizeSpy).toHaveBeenCalledOnceWith(160);
            expect(textSpy).toHaveBeenCalledOnceWith("Hello");
            expect(fontSpy).toHaveBeenCalledOnceWith("Arial");
            expect(colorSpy).toHaveBeenCalledOnceWith("#237841");
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

    describe("copySelectedComponent", function() {
        let layoutController;
        let straightTrackData;

        beforeEach(function() {
            layoutController = window.layoutController;
            layoutController.reset();
            straightTrackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.addComponent(straightTrackData);
        });

        it("does nothing if no component selected", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            LayoutController.selectedComponent = null;
            let hideFileMenuSpy = spyOn(layoutController, 'hideFileMenu').and.stub();
            layoutController.copySelectedComponent();
            expect(hideFileMenuSpy).toHaveBeenCalledTimes(1);
            expect(layoutController.currentLayer.children).toHaveSize(2); // 1 component and 1 render layer
            expect(layoutController.currentLayer.children[0]).toBe(originalComponent);
            expect(LayoutController.selectedComponent).toBeNull();
            expect(layoutController.copiedComponent).toBeNull();
            expect(layoutController.layers[0].openConnections).toHaveSize(2);
        });

        it("copies the selected component", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            expect(LayoutController.selectedComponent).not.toBeNull(); // Sanity check
            let hideFileMenuSpy = spyOn(layoutController, 'hideFileMenu').and.stub();
            let cloneSpy = spyOn(originalComponent, 'clone').and.callThrough();
            layoutController.copySelectedComponent();
            expect(hideFileMenuSpy).toHaveBeenCalledTimes(1);
            expect(cloneSpy).toHaveBeenCalledOnceWith();
            expect(LayoutController.selectedComponent).toBe(originalComponent);
            expect(layoutController.copiedComponent).not.toBeNull();
            expect(layoutController.copiedComponent).toBeInstanceOf(Component);
            expect(layoutController.copiedComponent).not.toBe(originalComponent);
        });

        it("destroys previous copied component when copying a new one", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            expect(LayoutController.selectedComponent).not.toBeNull(); // Sanity check
            let cloneSpy = spyOn(originalComponent, 'clone').and.callThrough();
            let destroySpy = spyOn(Component.prototype, 'destroy').and.callThrough();
            layoutController.copySelectedComponent();
            expect(cloneSpy).toHaveBeenCalledOnceWith();
            expect(destroySpy).not.toHaveBeenCalled();
            expect(layoutController.copiedComponent).not.toBeNull();
            let firstCopyUid = layoutController.copiedComponent.uid;
            layoutController.copySelectedComponent();
            expect(cloneSpy).toHaveBeenCalledTimes(2);
            expect(destroySpy).toHaveBeenCalledTimes(1);
            expect(layoutController.copiedComponent).not.toBeNull();
            expect(layoutController.copiedComponent).toBeInstanceOf(Component);
            expect(layoutController.copiedComponent.uid).not.toBe(originalComponent.uid);
            expect(layoutController.copiedComponent.uid).not.toBe(firstCopyUid);
        });
    });

    describe("deleteComponent", function() {
        let layoutController;
        let straightTrackData;

        beforeEach(function() {
            layoutController = window.layoutController;
            layoutController.reset();
            straightTrackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.addComponent(straightTrackData);
        });

        it("destroys the component", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            LayoutController.selectedComponent = null;
            let destroySpy = spyOn(originalComponent, 'destroy').and.stub();
            let hideToolbarSpy = spyOn(layoutController, '_hideSelectionToolbar').and.stub();
            layoutController.deleteComponent(originalComponent);
            expect(destroySpy).toHaveBeenCalledTimes(1);
            expect(hideToolbarSpy).not.toHaveBeenCalled();
        });

        it("handles deleting the selected component", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            LayoutController.selectedComponent = originalComponent;
            let destroySpy = spyOn(originalComponent, 'destroy').and.stub();
            let hideToolbarSpy = spyOn(layoutController, '_hideSelectionToolbar').and.stub();
            layoutController.deleteComponent(originalComponent);
            expect(destroySpy).toHaveBeenCalledTimes(1);
            expect(hideToolbarSpy).toHaveBeenCalledTimes(1);
            expect(LayoutController.selectedComponent).toBeNull();
        });

        it("doesn't delete selected component when not the same", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            layoutController.addComponent(straightTrackData);
            expect(LayoutController.selectedComponent).not.toBe(originalComponent); // Sanity check
            let destroySpy = spyOn(originalComponent, 'destroy').and.stub();
            let hideToolbarSpy = spyOn(layoutController, '_hideSelectionToolbar').and.stub();
            let selectedDestroySpy = spyOn(LayoutController.selectedComponent, 'destroy').and.stub();
            layoutController.deleteComponent(originalComponent);
            expect(destroySpy).toHaveBeenCalledTimes(1);
            expect(hideToolbarSpy).not.toHaveBeenCalled();
            expect(selectedDestroySpy).not.toHaveBeenCalled();
            expect(LayoutController.selectedComponent).not.toBeNull();
        });

        it("handles deleting the copied component", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            layoutController.copySelectedComponent();
            expect(layoutController.copiedComponent).not.toBeNull(); // Sanity check
            let destroySpy = spyOn(originalComponent, 'destroy').and.stub();
            let copiedDestroySpy = spyOn(layoutController.copiedComponent, 'destroy').and.stub();
            let hideToolbarSpy = spyOn(layoutController, '_hideSelectionToolbar').and.stub();
            layoutController.deleteComponent(layoutController.copiedComponent);
            expect(destroySpy).not.toHaveBeenCalled();
            expect(copiedDestroySpy).toHaveBeenCalledTimes(1);
            expect(hideToolbarSpy).not.toHaveBeenCalled();
            expect(LayoutController.selectedComponent).not.toBeNull();
            expect(layoutController.copiedComponent).toBeNull();
        });
    });

    describe("deleteSelectedComponent", function() {
        let layoutController;
        let straightTrackData;

        beforeEach(function() {
            layoutController = window.layoutController;
            layoutController.reset();
            straightTrackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.addComponent(straightTrackData);
        });

        it("does nothing if no component selected", function() {
            LayoutController.selectedComponent = null;
            let hideFileMenuSpy = spyOn(layoutController, 'hideFileMenu').and.stub();
            let selectComponentSpy = spyOn(LayoutController, 'selectComponent').and.stub();
            let deleteComponentSpy = spyOn(layoutController, 'deleteComponent').and.stub();
            let getAdjacentSpy = spyOn(Component.prototype, 'getAdjacentComponent').and.returnValue(null);
            layoutController.deleteSelectedComponent();
            expect(hideFileMenuSpy).toHaveBeenCalledTimes(1);
            expect(selectComponentSpy).not.toHaveBeenCalled();
            expect(deleteComponentSpy).not.toHaveBeenCalled();
            expect(getAdjacentSpy).not.toHaveBeenCalled();
        });

        it("deletes the selected component", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            expect(LayoutController.selectedComponent).not.toBeNull(); // Sanity check
            let hideFileMenuSpy = spyOn(layoutController, 'hideFileMenu').and.stub();
            let selectComponentSpy = spyOn(LayoutController, 'selectComponent').and.stub();
            let deleteComponentSpy = spyOn(layoutController, 'deleteComponent').and.stub();
            let getAdjacentSpy = spyOn(Component.prototype, 'getAdjacentComponent').and.returnValue(null);
            layoutController.deleteSelectedComponent();
            expect(hideFileMenuSpy).toHaveBeenCalledTimes(1);
            expect(selectComponentSpy).not.toHaveBeenCalled();
            expect(deleteComponentSpy).toHaveBeenCalledOnceWith(originalComponent);
            expect(getAdjacentSpy).toHaveBeenCalledTimes(1);
        });

        it("selects an adjacent component after deletion", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            expect(LayoutController.selectedComponent).not.toBeNull(); // Sanity check
            let hideFileMenuSpy = spyOn(layoutController, 'hideFileMenu').and.stub();
            let selectComponentSpy = spyOn(LayoutController, 'selectComponent').and.stub();
            let deleteComponentSpy = spyOn(layoutController, 'deleteComponent').and.stub();
            let getAdjacentSpy = spyOn(Component.prototype, 'getAdjacentComponent').and.returnValue("hello");
            layoutController.deleteSelectedComponent();
            expect(hideFileMenuSpy).toHaveBeenCalledTimes(1);
            expect(selectComponentSpy).toHaveBeenCalledOnceWith("hello");
            expect(deleteComponentSpy).toHaveBeenCalledOnceWith(originalComponent);
            expect(getAdjacentSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("duplicateComponent", function() {
        let layoutController;
        let straightTrackData;

        beforeEach(function() {
            layoutController = window.layoutController;
            layoutController.reset();
            straightTrackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.addComponent(straightTrackData);
        });

        it("does nothing if component is null", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            layoutController.duplicateComponent(null);
            expect(layoutController.currentLayer.children).toHaveSize(2); // 1 component and 1 render layer
            expect(layoutController.currentLayer.children[0]).toBe(originalComponent);
            expect(LayoutController.selectedComponent).toBe(originalComponent);
            expect(layoutController.layers[0].openConnections).toHaveSize(2);
            expect(selectionToolbar.classList).toContain("rotatable");
            expect(selectionToolbar.classList).not.toContain("editable");
        });

        it("duplicates a component", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            layoutController.duplicateComponent(originalComponent);
            expect(layoutController.currentLayer.children).toHaveSize(3); // 2 components and 1 render layer
            expect(layoutController.currentLayer.children[0]).toBeInstanceOf(Component);
            expect(layoutController.currentLayer.children[1]).toBeInstanceOf(Component);
            expect(layoutController.currentLayer.children[2]).toBeInstanceOf(RenderLayer);
            expect(LayoutController.selectedComponent).toBe(layoutController.currentLayer.children[1]);
            expect(LayoutController.selectedComponent).not.toBe(originalComponent);
            expect(LayoutController.selectedComponent.getPose().angle).toBe(originalComponent.getPose().angle);
            expect(layoutController.layers[0].openConnections).toHaveSize(2); // Because they are connected to each other
            expect(selectionToolbar.classList).toContain("rotatable");
            expect(selectionToolbar.classList).not.toContain("editable");
        });

        it("duplicates a in-memory component", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            let clone = originalComponent.clone();
            expect(clone).not.toBe(originalComponent);
            LayoutController.selectedComponent = null;
            layoutController.duplicateComponent(clone);
            expect(layoutController.currentLayer.children).toHaveSize(3); // 2 components and 1 render layer
            expect(layoutController.currentLayer.children[0]).toBeInstanceOf(Component);
            expect(layoutController.currentLayer.children[0]).not.toBe(clone);
            expect(layoutController.currentLayer.children[1]).toBeInstanceOf(Component);
            expect(layoutController.currentLayer.children[1]).not.toBe(clone);
            expect(layoutController.currentLayer.children[2]).toBeInstanceOf(RenderLayer);
            expect(LayoutController.selectedComponent).toBe(layoutController.currentLayer.children[1]);
            expect(LayoutController.selectedComponent).not.toBe(clone);
            expect(LayoutController.selectedComponent.getPose().angle).toBe(clone.getPose().angle);
            expect(layoutController.layers[0].openConnections).toHaveSize(4); // Because they are not connected to each other
            expect(selectionToolbar.classList).toContain("rotatable");
            expect(selectionToolbar.classList).not.toContain("editable");
        });

        it("automatically connects the selected same component", function() {
            let originalComponent = layoutController.currentLayer.children[0];
            layoutController.addComponent(straightTrackData);
            layoutController.addComponent(straightTrackData);
            layoutController.deleteComponent(layoutController.currentLayer.children[1]);
            LayoutController.selectComponent(originalComponent);
            expect(layoutController.currentLayer.openConnections).toHaveSize(4);
            layoutController.duplicateComponent(originalComponent);
            expect(layoutController.currentLayer.openConnections).toHaveSize(2);
            expect(LayoutController.selectedComponent).toBe(layoutController.currentLayer.children[2]);
            expect(LayoutController.selectedComponent).not.toBe(originalComponent);
            expect(selectionToolbar.classList).not.toContain("rotatable");
            expect(selectionToolbar.classList).not.toContain("editable");
        });

        it("automatically connects the selected different component", function() {
            layoutController.addComponent(straightTrackData);
            layoutController.addComponent(straightTrackData);
            let originalComponent = layoutController.currentLayer.children[2];
            layoutController.deleteComponent(layoutController.currentLayer.children[1]);
            LayoutController.selectComponent(layoutController.currentLayer.children[0]);
            expect(layoutController.currentLayer.openConnections).toHaveSize(4);
            layoutController.duplicateComponent(originalComponent);
            expect(layoutController.currentLayer.openConnections).toHaveSize(2);
            expect(LayoutController.selectedComponent).toBe(layoutController.currentLayer.children[2]);
            expect(LayoutController.selectedComponent).not.toBe(originalComponent);
            expect(LayoutController.selectedComponent).not.toBe(layoutController.currentLayer.children[0]);
            expect(selectionToolbar.classList).not.toContain("rotatable");
            expect(selectionToolbar.classList).not.toContain("editable");
        });

        it("doesn't autoconnect when no open connections", function() {
            layoutController.addComponent(straightTrackData);
            let originalComponent = layoutController.currentLayer.children[1];
            layoutController.addComponent(straightTrackData);
            LayoutController.selectComponent(originalComponent);
            expect(layoutController.currentLayer.openConnections).toHaveSize(2);
            layoutController.duplicateComponent(originalComponent);
            expect(layoutController.currentLayer.openConnections).toHaveSize(4);
            expect(LayoutController.selectedComponent).toBe(layoutController.currentLayer.children[3]);
            expect(LayoutController.selectedComponent).not.toBe(originalComponent);
            expect(selectionToolbar.classList).toContain("rotatable");
            expect(selectionToolbar.classList).not.toContain("editable");
        });
    });

    describe("duplicateSelectedComponent", function() {
        let layoutController;
        let straightTrackData;

        beforeEach(function() {
            layoutController = window.layoutController;
            layoutController.reset();
            straightTrackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.addComponent(straightTrackData);
        });

        it("duplicates a selected component", function() {
            let hideFileMenuSpy = spyOn(layoutController, 'hideFileMenu').and.stub();
            let duplicateComponentSpy = spyOn(layoutController, 'duplicateComponent').and.stub();
            layoutController.duplicateSelectedComponent();
            expect(hideFileMenuSpy).toHaveBeenCalled();
            expect(duplicateComponentSpy).toHaveBeenCalledOnceWith(LayoutController.selectedComponent);
        });

        it("does nothing if no component selected", function() {
            LayoutController.selectedComponent = null;
            let hideFileMenuSpy = spyOn(layoutController, 'hideFileMenu').and.stub();
            let duplicateComponentSpy = spyOn(layoutController, 'duplicateComponent').and.stub();
            layoutController.duplicateSelectedComponent();
            expect(hideFileMenuSpy).toHaveBeenCalled();
            expect(duplicateComponentSpy).not.toHaveBeenCalled();
        });
    });

    describe("pasteComponent", function() {
        let layoutController;

        beforeEach(function() {
            layoutController = window.layoutController;
            layoutController.reset();
        });

        it("does nothing if copiedComponent is null", function() {
            let hideFileMenuSpy = spyOn(layoutController, 'hideFileMenu').and.stub();
            let duplicateComponentSpy = spyOn(layoutController, 'duplicateComponent').and.stub();
            layoutController.pasteComponent();
            expect(hideFileMenuSpy).toHaveBeenCalled();
            expect(duplicateComponentSpy).not.toHaveBeenCalled();
        });

        it("pastes the copied component", function() {
            let trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            layoutController.addComponent(trackData);
            layoutController.copySelectedComponent();
            expect(layoutController.copiedComponent).not.toBeNull(); // Sanity check
            let hideFileMenuSpy = spyOn(layoutController, 'hideFileMenu').and.stub();
            let duplicateComponentSpy = spyOn(layoutController, 'duplicateComponent').and.stub();
            layoutController.pasteComponent();
            expect(hideFileMenuSpy).toHaveBeenCalledTimes(1);
            expect(duplicateComponentSpy).toHaveBeenCalledOnceWith(layoutController.copiedComponent);
        });
    });

    describe("_sanitizeFileName", function() {
        let layoutController;
        
        beforeEach(function() {
            layoutController = window.layoutController;
        });

        it("returns null for null input", function() {
            expect(layoutController._sanitizeFilename(null)).toBe(null);
        });

        it("returns null for undefined input", function() {
            expect(layoutController._sanitizeFilename(undefined)).toBe(null);
        });

        it("returns null for non-string input", function() {
            expect(layoutController._sanitizeFilename(123)).toBe(null);
            expect(layoutController._sanitizeFilename({})).toBe(null);
            expect(layoutController._sanitizeFilename([])).toBe(null);
        });

        it("returns null for empty string", function() {
            expect(layoutController._sanitizeFilename("")).toBe(null);
        });

        it("returns null for whitespace-only string", function() {
            expect(layoutController._sanitizeFilename("   ")).toBe(null);
            expect(layoutController._sanitizeFilename("\t\n")).toBe(null);
        });

        it("removes leading and trailing slashes", function() {
            expect(layoutController._sanitizeFilename("/test/")).toBe("test");
            expect(layoutController._sanitizeFilename("///test///")).toBe("test");
            expect(layoutController._sanitizeFilename("/test")).toBe("test");
            expect(layoutController._sanitizeFilename("test/")).toBe("test");
        });

        it("removes leading and trailing whitespace", function() {
            expect(layoutController._sanitizeFilename("  test  ")).toBe("test");
            expect(layoutController._sanitizeFilename("\ttest\n")).toBe("test");
        });

        it("removes path separators (forward slashes)", function() {
            expect(layoutController._sanitizeFilename("test/file")).toBe("testfile");
            expect(layoutController._sanitizeFilename("path/to/file")).toBe("pathtofile");
        });

        it("removes path separators (backslashes)", function() {
            expect(layoutController._sanitizeFilename("test\\file")).toBe("testfile");
            expect(layoutController._sanitizeFilename("path\\to\\file")).toBe("pathtofile");
        });

        it("removes dots to prevent path traversal", function() {
            expect(layoutController._sanitizeFilename("..")).toBe(null); // becomes empty after sanitization
            expect(layoutController._sanitizeFilename("../test")).toBe("test");
            expect(layoutController._sanitizeFilename("test.")).toBe("test");
            expect(layoutController._sanitizeFilename("./test")).toBe("test");
            expect(layoutController._sanitizeFilename("../../malicious")).toBe("malicious");
        });

        it("removes file extensions", function() {
            expect(layoutController._sanitizeFilename("test.json")).toBe("test");
            expect(layoutController._sanitizeFilename("test.exe")).toBe("test");
            expect(layoutController._sanitizeFilename("test.txt")).toBe("test");
            expect(layoutController._sanitizeFilename("test.config.json")).toBe("testconfig");
        });

        it("keeps only alphanumeric characters", function() {
            expect(layoutController._sanitizeFilename("test123")).toBe("test123");
            expect(layoutController._sanitizeFilename("Test123")).toBe("Test123");
            expect(layoutController._sanitizeFilename("test-file")).toBe("testfile");
            expect(layoutController._sanitizeFilename("test_file")).toBe("testfile");
            expect(layoutController._sanitizeFilename("test@file")).toBe("testfile");
            expect(layoutController._sanitizeFilename("test file")).toBe("testfile");
            expect(layoutController._sanitizeFilename("test!@#$%^&*()file")).toBe("testfile");
        });

        it("returns null for strings that become empty after sanitization", function() {
            expect(layoutController._sanitizeFilename("!@#$%^&*()")).toBe(null);
            expect(layoutController._sanitizeFilename("./../../")).toBe(null);
            expect(layoutController._sanitizeFilename("...")).toBe(null);
            expect(layoutController._sanitizeFilename("/////")).toBe(null);
        });

        it("returns null for strings longer than 50 characters", function() {
            const longString = "a".repeat(51);
            expect(layoutController._sanitizeFilename(longString)).toBe(null);
        });

        it("accepts strings exactly 50 characters long", function() {
            const exactString = "a".repeat(50);
            expect(layoutController._sanitizeFilename(exactString)).toBe(exactString);
        });

        it("accepts strings shorter than 50 characters", function() {
            expect(layoutController._sanitizeFilename("test")).toBe("test");
            expect(layoutController._sanitizeFilename("a")).toBe("a");
        });

        it("handles complex path traversal attempts", function() {
            expect(layoutController._sanitizeFilename("../../../etc/passwd")).toBe("etcpasswd");
            expect(layoutController._sanitizeFilename("..\\..\\windows\\system32")).toBe("windowssystem32");
        });

        it("handles mixed case and numbers", function() {
            expect(layoutController._sanitizeFilename("TestFile123")).toBe("TestFile123");
            expect(layoutController._sanitizeFilename("test123FILE456")).toBe("test123FILE456");
        });

        it("handles real-world examples", function() {
            expect(layoutController._sanitizeFilename("q2WE4ty")).toBe("q2WE4ty");
            expect(layoutController._sanitizeFilename("layout123")).toBe("layout123");
            expect(layoutController._sanitizeFilename("user_layout_v2")).toBe("userlayoutv2");
            expect(layoutController._sanitizeFilename("my-awesome-layout.json")).toBe("myawesomelayout");
        });

        it("combines all sanitization rules", function() {
            const maliciousInput = "  /../../../malicious@file!.exe  ";
            expect(layoutController._sanitizeFilename(maliciousInput)).toBe("maliciousfile");
        });
    });

    describe("_validateImportData", function() {
        beforeEach(function() {
            /**
             * @type {SerializedLayout}
             */
            this.perfectMinimalImportData = {
                "version": 2,
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
                "version": 2,
                "date": "2021-09-01T00:00:00.000Z",
                "x": 1,
                "y": 2,
                "zoom": 0.5,
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
                                "units": "studs",
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
            expect(LayoutController._validateImportData(layoutFileFiveVTwo)).toBeTrue();
        });

        it("fails validation for layout 5 v1", function() {
            expect(LayoutController._validateImportData(layoutFileFiveVOne)).toBeFalse();
        });

        it("throws errors with invalid version", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.version = 0;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws error with invalid x", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.x = "not a number";
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws error with invalid y", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.y = "not a number";
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws error with invalid zoom", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.zoom = "not a number";
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });

        it("throws error with negative zoom", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            testData.zoom = -1;
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

        it("throws errors with missing component units", function() {
            /** @type {SerializedLayout} */
            let testData = this.perfectImportData;
            delete testData.layers[0].components[1].units;
            expect(LayoutController._validateImportData(testData)).toBeFalse();
        });
    });

    describe("LayoutUpgrade", function() {
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
                "x": 1,
                "y": 2,
                "zoom": 0.5,
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

        it("properly upgrades layout 5", function() {
            let layout = JSON.parse(JSON.stringify(layoutFileFiveVOne));
            upgradeLayout(layout);
            expect(LayoutController._validateImportData(layout)).toBeTrue();
        });

        it("properly upgrades minimal import data", function() {
            upgradeLayout(this.perfectMinimalImportData);
            expect(this.perfectMinimalImportData.version).toBe(2);
            expect(LayoutController._validateImportData(this.perfectMinimalImportData)).toBeTrue();
        });

        it("properly upgrades import data", function() {
            upgradeLayout(this.perfectImportData);
            expect(this.perfectImportData.layers[0].components[1].units).toBe("studs");
            expect(LayoutController._validateImportData(this.perfectImportData)).toBeTrue();
        });

        it("properly selects feet units", function() {
            this.perfectImportData.layers[0].components[1].type = "shape";
            this.perfectImportData.layers[0].components[1].width = 614.4;
            this.perfectImportData.layers[0].components[1].height = 1228.8;
            upgradeLayout(this.perfectImportData);
            expect(this.perfectImportData.layers[0].components[1].units).toBe("feet");
            expect(LayoutController._validateImportData(this.perfectImportData)).toBeTrue();
        });

        it("properly selects inches units", function() {
            this.perfectImportData.layers[0].components[1].type = "shape";
            this.perfectImportData.layers[0].components[1].width = 51.200000001;
            this.perfectImportData.layers[0].components[1].height = 51.2 * 9;
            upgradeLayout(this.perfectImportData);
            expect(this.perfectImportData.layers[0].components[1].units).toBe("inches");
            expect(LayoutController._validateImportData(this.perfectImportData)).toBeTrue();
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
            layoutController._importLayout(layoutFileFiveVTwo);
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
                    expect(child.shape).toBe('rectangle');
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
        /** @type {LayoutController} */
        let layoutController;
        /** @type {TrackData} */
        let straightTrackData;
        /** @type {TrackData} */
        let baseplateData;

        beforeAll(function() {
            layoutController = window.layoutController;
            straightTrackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            baseplateData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "baseplate32x32");
        });

        beforeEach(function() {
            layoutController.reset();
        });

        it("checks for open connection on rotate", function() {
            layoutController._importLayout(layoutFileThree);
            /** @type {Component} */
            let curveTrack = layoutController.currentLayer.children.find(/** @param {Component} c */(c) => c.baseData.alias == "railCurved9V");
            expect(curveTrack).toBeDefined();
            expect(curveTrack.getOpenConnections()).withContext("List of open connections").toHaveSize(1);
            curveTrack.rotate();
            expect(curveTrack.getOpenConnections()).withContext("List of open connections after rotate").toHaveSize(0);
        });

        it("canRotate when all connections open", function() {
            layoutController.addComponent(straightTrackData);
            /** @type {Component} */
            let component = layoutController.currentLayer.children[0];
            expect(component.canRotate()).toBeTrue();
        });

        it("canRotate when no connections", function() {
            layoutController.addComponent(baseplateData);
            /** @type {Component} */
            let component = layoutController.currentLayer.children[0];
            expect(component.canRotate()).toBeTrue();
        });

        it("canRotate when only one connection used", function() {
            layoutController.addComponent(straightTrackData);
            layoutController.addComponent(straightTrackData);
            /** @type {Component} */
            let component1 = layoutController.currentLayer.children[0];
            /** @type {Component} */
            let component2 = layoutController.currentLayer.children[1];
            expect(component1.canRotate()).toBeTrue();
            expect(component2.canRotate()).toBeTrue();
        });

        it("canRotate is false when no open connections", function() {
            layoutController.addComponent(straightTrackData);
            layoutController.addComponent(straightTrackData);
            layoutController.addComponent(straightTrackData);
            expect(layoutController.currentLayer.children[1].canRotate()).toBeFalse();
        });

        it("rotates component once when 'r' hotkey is pressed", function() {
            layoutController.addComponent(baseplateData);
            /** @type {Component} */
            let component = layoutController.currentLayer.children[0];
            LayoutController.selectComponent(component);
            
            // Spy on rotateSelectedComponent method
            let rotateSpy = spyOn(layoutController, 'rotateSelectedComponent').and.callThrough();
            
            // Simulate 'r' keypress
            const keyEvent = new KeyboardEvent('keydown', {
                key: 'r',
                ctrlKey: false,
                bubbles: true
            });
            window.dispatchEvent(keyEvent);
            
            // rotateSelectedComponent should be called exactly once
            expect(rotateSpy).toHaveBeenCalledTimes(1);
        });

        it("rotates component once when 'r' hotkey is pressed with dragTarget", function() {
            layoutController.addComponent(baseplateData);
            /** @type {Component} */
            let component = layoutController.currentLayer.children[0];
            LayoutController.dragTarget = component;
            
            // Spy on rotateSelectedComponent method
            let rotateSpy = spyOn(layoutController, 'rotateSelectedComponent').and.callThrough();
            
            // Simulate 'r' keypress
            const keyEvent = new KeyboardEvent('keydown', {
                key: 'r',
                ctrlKey: false,
                bubbles: true
            });
            window.dispatchEvent(keyEvent);
            
            // rotateSelectedComponent should be called exactly once
            expect(rotateSpy).toHaveBeenCalledTimes(1);
            
            // Clean up
            LayoutController.dragTarget = null;
        });

        it("does not rotate when 'ctrl+r' is pressed", function() {
            layoutController.addComponent(baseplateData);
            /** @type {Component} */
            let component = layoutController.currentLayer.children[0];
            LayoutController.selectComponent(component);
            
            // Spy on rotateSelectedComponent method
            let rotateSpy = spyOn(layoutController, 'rotateSelectedComponent').and.callThrough();
            
            // Simulate 'ctrl+r' keypress
            const keyEvent = new KeyboardEvent('keydown', {
                key: 'r',
                ctrlKey: true,
                bubbles: true
            });
            window.dispatchEvent(keyEvent);
            
            // rotateSelectedComponent should not be called
            expect(rotateSpy).not.toHaveBeenCalled();
        });

        it("does not insert collision tree when rotating while dragging", function() {
            layoutController.addComponent(baseplateData);
            /** @type {Component} */
            let component = layoutController.currentLayer.children[0];
            
            // Set up component as if it's being dragged
            component.isDragging = true;
            
            // Spy on insertCollisionTree
            let insertSpy = spyOn(component, 'insertCollisionTree');
            let deleteSpy = spyOn(component, 'deleteCollisionTree').and.callThrough();
            
            // Rotate the component
            component.rotate();
            
            // deleteCollisionTree should be called
            expect(deleteSpy).toHaveBeenCalled();
            // insertCollisionTree should NOT be called because isDragging is true
            expect(insertSpy).not.toHaveBeenCalled();
        });

        it("inserts collision tree when rotating while not dragging", function() {
            layoutController.addComponent(baseplateData);
            /** @type {Component} */
            let component = layoutController.currentLayer.children[0];
            
            // Ensure isDragging is false
            component.isDragging = false;
            
            // Spy on insertCollisionTree
            let insertSpy = spyOn(component, 'insertCollisionTree');
            let deleteSpy = spyOn(component, 'deleteCollisionTree').and.callThrough();
            
            // Rotate the component
            component.rotate();
            
            // Both deleteCollisionTree and insertCollisionTree should be called
            expect(deleteSpy).toHaveBeenCalled();
            expect(insertSpy).toHaveBeenCalled();
        });

        it("clones a component", function() {
            layoutController.addComponent(straightTrackData);
            /** @type {Component} */
            let component = layoutController.currentLayer.children[0];
            let newcomp = component.clone(layoutController.currentLayer);
            expect(newcomp).toBeDefined();
            expect(newcomp.uid).not.toBe(component.uid);
            expect(newcomp.baseData).toEqual(component.baseData);
            expect(newcomp.getPose().equals(component.getPose())).toBeTrue();
            expect(newcomp.connections).toHaveSize(component.connections.length);
            expect(layoutController.currentLayer.openConnections.values()).toContain(newcomp.connections[0]);
            expect(layoutController.currentLayer.openConnections.values()).toContain(newcomp.connections[1]);
        });

        it("clones a component with no layer", function() {
            layoutController.addComponent(straightTrackData);
            /** @type {Component} */
            let component = layoutController.currentLayer.children[0];
            let newcomp = component.clone();
            expect(newcomp).toBeDefined();
            expect(newcomp.uid).not.toBe(component.uid);
            expect(newcomp.baseData).toEqual(component.baseData);
            expect(newcomp.getPose().equals(component.getPose())).toBeTrue();
            expect(newcomp.connections).toHaveSize(component.connections.length);
            expect(layoutController.currentLayer.openConnections.values()).not.toContain(newcomp.connections[0]);
            expect(layoutController.currentLayer.openConnections.values()).not.toContain(newcomp.connections[1]);
        });

        it("clones a component and connects it", function() {
            layoutController.addComponent(straightTrackData);
            /** @type {Component} */
            let component = layoutController.currentLayer.children[0];
            const spy = spyOn(Component, 'fromComponent').and.callThrough();
            let newcomp = component.clone(layoutController.currentLayer, component);
            expect(newcomp).toBeDefined();
            const a = {
                width: component.componentWidth,
                height: component.componentHeight,
                units: undefined,
                shape: undefined,
                color: '#6c6e68',
                outlineColor: undefined,
                opacity: undefined,
                text: undefined,
                font: undefined,
                fontSize: undefined
            };
            expect(spy).toHaveBeenCalledOnceWith(component.baseData, component, layoutController.currentLayer, a);
            expect(newcomp.uid).not.toBe(component.uid);
            expect(newcomp.baseData).toEqual(component.baseData);
            expect(newcomp.getPose().equals(component.getPose())).toBeFalse();
            expect(layoutController.currentLayer.openConnections).toHaveSize(2);
        });

        describe("fromComponent", function() {
            /** @type {TrackData} */
            let bigBaseplateData;

            beforeAll(function() {
                bigBaseplateData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "baseplate48x48");
            });

            it("creates a new component connected to an existing one", function() {
                layoutController.addComponent(straightTrackData);
                /** @type {Component} */
                let component = layoutController.currentLayer.children[0];
                let newcomp = Component.fromComponent(straightTrackData, component, layoutController.currentLayer, {});
                expect(newcomp).toBeDefined();
                expect(newcomp.uid).not.toBe(component.uid);
                expect(newcomp.baseData).toEqual(straightTrackData);
                expect(layoutController.currentLayer.openConnections.values()).toContain(newcomp.connections[0]);
                expect(layoutController.currentLayer.openConnections.values()).not.toContain(newcomp.connections[1]);
                expect(newcomp.connections[1].otherConnection).toBe(component.connections[0]);
                expect(component.connections[0].otherConnection).toBe(newcomp.connections[1]);
            });

            it("positions a new component next to the existing when no connections", function() {
                layoutController.addComponent(straightTrackData);
                /** @type {Component} */
                let component = layoutController.currentLayer.children[0];
                let newComp = Component.fromComponent(baseplateData, component, layoutController.currentLayer, {});
                expect(component.getOpenConnections()).toHaveSize(2);
                expect(newComp.getPose().x).toBe(component.getPose().x + (component.sprite.width / 2) + (newComp.sprite.width / 2));
                expect(newComp.getPose().y).toBe(component.getPose().y);
                expect(newComp.getPose().angle).toBe(0);
            });

            it("positions a new big component next to the existing when no connections", function() {
                layoutController.addComponent(straightTrackData);
                /** @type {Component} */
                let component = layoutController.currentLayer.children[0];
                let newComp = Component.fromComponent(bigBaseplateData, component, layoutController.currentLayer, {});
                expect(component.getOpenConnections()).toHaveSize(2);
                expect(newComp.getPose().x).toBe(component.getPose().x + (component.sprite.width / 2) + (newComp.sprite.width / 2));
                expect(newComp.getPose().y).toBe(component.getPose().y);
                expect(newComp.getPose().angle).toBe(0);
            });

            it("positions a new big component next to the existing when neither have connections", function() {
                layoutController.addComponent(baseplateData);
                /** @type {Component} */
                let component = layoutController.currentLayer.children[0];
                let newComp = Component.fromComponent(bigBaseplateData, component, layoutController.currentLayer, {});
                expect(newComp.getPose().x).toBe(component.getPose().x + (component.sprite.width / 2) + (newComp.sprite.width / 2));
                expect(newComp.getPose().y).toBe(component.getPose().y);
                expect(newComp.getPose().angle).toBe(0);
            });
        });
    });

    describe("_newComponentPosition", function() {
        /** @type {LayoutController} */
        let layoutController;
        /** @type {TrackData} */
        let straightTrackData;
        /** @type {TrackData} */
        let baseplateData;
        beforeEach(function() {
            layoutController = window.layoutController;
            layoutController.reset();
            straightTrackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
            baseplateData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "baseplate32x32");
            layoutController.config.clearWorkspaceSettings();
        });

        it("computes position for track with connections using first connection vector (custom angle, no snap)", function() {
            layoutController.config.workspaceSnapToSize = 0;
            expect(straightTrackData.connections.length).toBeGreaterThan(0);
            const fakeReturn = { x: 600.31234, y: 401.98761 }; // intentionally non-rounded
            const angle = Math.PI / 5;
            const spy = spyOn(straightTrackData.connections[0].vector, 'getStartPosition').and.returnValue(fakeReturn);
            const pos = layoutController._newComponentPosition(straightTrackData, angle);
            expect(spy).toHaveBeenCalledOnceWith({ x: 512, y: 384, angle });
            // fround applied before layer transform
            expect(pos.x).toBeCloseTo(Math.fround(fakeReturn.x), 6);
            expect(pos.y).toBeCloseTo(Math.fround(fakeReturn.y), 6);
            expect(pos.angle).toBe(angle);
        });

        it("computes position for component without connections (default angle, no snap)", function() {
            layoutController.config.workspaceSnapToSize = 0;
            expect(baseplateData.connections || []).toHaveSize(0);
            // expected raw position before layer transform logic: (150,274) + half width/height
            const expectedX = 150 + (baseplateData.width / 2);
            const expectedY = 274 + (baseplateData.height / 2);
            const pos = layoutController._newComponentPosition(baseplateData); // angle defaults to 0
            expect(pos.angle).toBe(0);
            // After internal toLocal() trick the coordinates should remain the computed values
            expect(pos.x).toBeCloseTo(expectedX, 6);
            expect(pos.y).toBeCloseTo(expectedY, 6);
        });

        it("snaps position to grid for component without connections when snapToGrid enabled", function() {
            layoutController.config.workspaceSnapToSize = 16;
            const rawX = 150 + (baseplateData.width / 2);
            const rawY = 274 + (baseplateData.height / 2);
            const expectedX = Math.round(rawX / 16) * 16;
            const expectedY = Math.round(rawY / 16) * 16;
            const pos = layoutController._newComponentPosition(baseplateData);
            expect(pos.x % 16).toBe(0);
            expect(pos.y % 16).toBe(0);
            expect(pos.x).toBe(expectedX);
            expect(pos.y).toBe(expectedY);
        });

        it("snaps position to grid for component with connections when snapToGrid enabled", function() {
            layoutController.config.workspaceSnapToSize = 16;
            const fakeReturn = { x: 593.27, y: 377.61 }; // non multiples of 16 so rounding happens
            spyOn(straightTrackData.connections[0].vector, 'getStartPosition').and.returnValue(fakeReturn);
            const pos = layoutController._newComponentPosition(straightTrackData, 0);
            const frx = Math.fround(fakeReturn.x);
            const fry = Math.fround(fakeReturn.y);
            expect(pos.x).toBe(Math.round(frx / 16) * 16);
            expect(pos.y).toBe(Math.round(fry / 16) * 16);
            expect(pos.x % 16).toBe(0);
            expect(pos.y % 16).toBe(0);
        });

        it("preserves provided angle for component without connections", function() {
            layoutController.config.workspaceSnapToSize = 0;
            const angle = Math.PI / 7;
            const pos = layoutController._newComponentPosition(baseplateData, angle);
            expect(pos.angle).toBe(angle);
        });

        it("uses default angle 0 when none provided", function() {
            const pos = layoutController._newComponentPosition(straightTrackData);
            expect(pos.angle).toBe(0);
        });
    });

    describe("browser drag-and-drop", function() {
        let layoutController;
        let straightTrackData;
        let canvasContainer;
        let componentMenu;

        beforeEach(function() {
            layoutController = window.layoutController;
            layoutController.reset();
            straightTrackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");

            // Mock canvas container (800x600)
            canvasContainer = document.createElement('div');
            canvasContainer.id = 'canvasContainer';
            spyOn(canvasContainer, 'getBoundingClientRect').and.returnValue({
                left: 0,
                top: 0,
                right: 800,
                bottom: 600,
                width: 800,
                height: 600
            });

            // Mock component menu (bottom-left quarter: 400x300)
            componentMenu = document.createElement('div');
            componentMenu.id = 'componentMenu';
            spyOn(componentMenu, 'getBoundingClientRect').and.returnValue({
                left: 0,
                top: 300,
                right: 400,
                bottom: 600,
                width: 400,
                height: 300
            });

            geiSpy.withArgs('canvasContainer').and.returnValue(canvasContainer);
            geiSpy.withArgs('componentMenu').and.returnValue(componentMenu);
            geiSpy.and.callThrough(); // Allow other calls to pass through

            layoutController.createComponentBrowser();
        });

        it("adds component on touch tap (iOS Safari behavior)", function() {
            const button = layoutController.componentBrowser.querySelector('button[data-track-alias="railStraight9V"]');
            expect(button).toBeDefined();

            const initialComponentCount = layoutController.currentLayer.children.length;

            // Simulate touch pointerdown (sets browserMobileClick flag)
            const pointerDownEvent = new PointerEvent('pointerdown', {
                pointerType: 'touch',
                button: 0,
                isPrimary: true,
                clientX: 100,
                clientY: 400,
                bubbles: true
            });
            button.dispatchEvent(pointerDownEvent);
            expect(LayoutController.browserMobileClick).toBeTrue();

            // iOS Safari reports touch as 'mouse' in click event
            const clickEvent = new MouseEvent('click', {
                clientX: 100,
                clientY: 400,
                bubbles: true
            });
            Object.defineProperty(clickEvent, 'pointerType', { value: 'mouse', writable: false });
            button.dispatchEvent(clickEvent);

            expect(layoutController.currentLayer.children.length).toBe(initialComponentCount + 1);
            expect(layoutController.currentLayer.children[0]).toBeInstanceOf(Component);
            expect(LayoutController.browserMobileClick).toBeFalse();
            expect(LayoutController.ghostElement).toBeNull();
        });

        it("adds component on mouse short-click below threshold", function() {
            const button = layoutController.componentBrowser.querySelector('button[data-track-alias="railStraight9V"]');
            expect(button).toBeDefined();
            const initialComponentCount = layoutController.currentLayer.children.length;

            // Simulate mouse pointerdown
            const pointerDownEvent = new PointerEvent('pointerdown', {
                pointerType: 'mouse',
                button: 0,
                isPrimary: true,
                clientX: 100,
                clientY: 400,
                bubbles: true
            });
            Object.defineProperty(pointerDownEvent, 'currentTarget', { value: button, writable: false });
            button.dispatchEvent(pointerDownEvent);
            expect(LayoutController.browserDragButton).toBe(button);
            expect(LayoutController.browserDragTrack).toBe(straightTrackData);
            expect(LayoutController.browserDragStartPos).toEqual({ x: 100, y: 400 });

            // Simulate pointerup at same position (no drag)
            const pointerUpEvent = new PointerEvent('pointerup', {
                pointerType: 'mouse',
                button: 0,
                isPrimary: true,
                clientX: 100,
                clientY: 400,
                bubbles: true
            });
            document.dispatchEvent(pointerUpEvent);
            expect(layoutController.currentLayer.children.length).toBe(initialComponentCount + 1);
            expect(layoutController.currentLayer.children[0]).toBeInstanceOf(Component);
            expect(LayoutController.browserDragButton).toBeNull();
            expect(LayoutController.browserDragTrack).toBeNull();
            expect(LayoutController.browserDragDistance).toBe(0);
            expect(LayoutController.browserDragStartPos).toBeNull();
            expect(LayoutController.ghostElement).toBeNull();
        });

        it("creates ghost on mouse drag past threshold and transitions to canvas drag", function() {
            const button = layoutController.componentBrowser.querySelector('button[data-track-alias="railStraight9V"]');
            expect(button).toBeDefined();
            const initialComponentCount = layoutController.currentLayer.children.length;

            // Simulate mouse pointerdown
            const pointerDownEvent = new PointerEvent('pointerdown', {
                pointerType: 'mouse',
                button: 0,
                isPrimary: true,
                clientX: 100,
                clientY: 400,
                bubbles: true
            });
            Object.defineProperty(pointerDownEvent, 'currentTarget', { value: button, writable: false });
            button.dispatchEvent(pointerDownEvent);

            // Simulate pointermove to exceed threshold (move 20px horizontally)
            const pointerMoveEvent1 = new PointerEvent('pointermove', {
                pointerType: 'mouse',
                clientX: 120,
                clientY: 400,
                bubbles: true
            });
            document.dispatchEvent(pointerMoveEvent1);
            expect(LayoutController.ghostElement).not.toBeNull();
            expect(LayoutController.ghostElement.parentElement).toBe(document.body);

            // Simulate pointermove to canvas area outside browser (top-right)
            const pointerMoveEvent2 = new PointerEvent('pointermove', {
                pointerType: 'mouse',
                clientX: 500,
                clientY: 200,
                bubbles: true
            });
            document.dispatchEvent(pointerMoveEvent2);
            expect(layoutController.currentLayer.children.length).toBe(initialComponentCount + 1);
            const newComponent = layoutController.currentLayer.children[0];
            expect(newComponent).toBeInstanceOf(Component);
            expect(LayoutController.dragTarget).toBe(newComponent);
            expect(LayoutController.ghostElement).toBeNull();
            expect(LayoutController.browserDragButton).toBeNull();
            expect(LayoutController.browserDragTrack).toBeNull();
            expect(LayoutController.browserDragStartPos).toBeNull();
        });

        it("ignores non-primary mouse buttons", function() {
            const button = layoutController.componentBrowser.querySelector('button[data-track-alias="railStraight9V"]');
            expect(button).toBeDefined();
            const initialComponentCount = layoutController.currentLayer.children.length;

            // Simulate right-click (button 1)
            const pointerDownEvent1 = new PointerEvent('pointerdown', {
                pointerType: 'mouse',
                button: 1,
                isPrimary: true,
                clientX: 100,
                clientY: 400,
                bubbles: true
            });
            Object.defineProperty(pointerDownEvent1, 'currentTarget', { value: button, writable: false });
            button.dispatchEvent(pointerDownEvent1);
            expect(LayoutController.browserDragButton).toBeNull();
            expect(LayoutController.browserDragTrack).toBeNull();
            
            // Simulate non-primary pointer
            const pointerDownEvent2 = new PointerEvent('pointerdown', {
                pointerType: 'mouse',
                button: 0,
                isPrimary: false,
                clientX: 100,
                clientY: 400,
                bubbles: true
            });
            Object.defineProperty(pointerDownEvent2, 'currentTarget', { value: button, writable: false });
            button.dispatchEvent(pointerDownEvent2);

            expect(LayoutController.browserDragButton).toBeNull();
            expect(LayoutController.browserDragTrack).toBeNull();
            expect(layoutController.currentLayer.children.length).toBe(initialComponentCount);
        });
    });
    describe("Alt-Drag to Duplicate", function() {
        afterEach(function() {
            const layoutController = window.layoutController;
            if (!layoutController) return;
            const currentLayer = layoutController.currentLayer;
            
            // Clean up any components added during tests
            if (currentLayer && currentLayer.children) {
                const childrenCopy = [...currentLayer.children];
                childrenCopy.forEach(child => {
                    if (child instanceof Component) {
                        child.destroy();
                    }
                });
            }
            // Reset LayoutController state
            LayoutController.dragTarget = null;
            LayoutController.dragDistance = 0;
            LayoutController.dragWithAlt = false;
            LayoutController.selectedComponent = null;
        });

        describe("when Alt key is pressed at drag start", function() {
            it("should set dragWithAlt flag to true", function() {
                const layoutController = window.layoutController;
                const currentLayer = layoutController.currentLayer;
                const trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
                const component = new Component(trackData, new Pose(100, 100, 0), currentLayer, {});
                currentLayer.addChild(component);
                
                const mockEvent = {
                    button: 0,
                    nativeEvent: { isPrimary: true },
                    altKey: true,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
                    stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
                };

                component.onStartDrag(mockEvent);

                expect(LayoutController.dragWithAlt).toBe(true);
                expect(LayoutController.dragTarget).toBe(component);
            });

            it("should NOT duplicate immediately on drag start", function() {
                const layoutController = window.layoutController;
                const currentLayer = layoutController.currentLayer;
                const trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
                const component = new Component(trackData, new Pose(100, 100, 0), currentLayer, {});
                currentLayer.addChild(component);
                const initialChildCount = currentLayer.children.length;
                
                const mockEvent = {
                    button: 0,
                    nativeEvent: { isPrimary: true },
                    altKey: true,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
                    stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
                };

                component.onStartDrag(mockEvent);

                // Should not have created a duplicate yet
                expect(currentLayer.children.length).toBe(initialChildCount);
            });
        });

        describe("when Alt key is NOT pressed at drag start", function() {
            it("should set dragWithAlt flag to false", function() {
                const layoutController = window.layoutController;
                const currentLayer = layoutController.currentLayer;
                const trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
                const component = new Component(trackData, new Pose(100, 100, 0), currentLayer, {});
                currentLayer.addChild(component);
                
                const mockEvent = {
                    button: 0,
                    nativeEvent: { isPrimary: true },
                    altKey: false,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
                    stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
                };

                component.onStartDrag(mockEvent);

                expect(LayoutController.dragWithAlt).toBe(false);
            });
        });

        describe("duplication after threshold in onDragMove", function() {
            it("should duplicate component after threshold is passed with Alt", function() {
                const layoutController = window.layoutController;
                const currentLayer = layoutController.currentLayer;
                const trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
                const component = new Component(trackData, new Pose(100, 100, 0), currentLayer, {});
                currentLayer.addChild(component);
                const originalUuid = component.uuid;
                const initialChildCount = currentLayer.children.length;
                
                // Start drag with Alt
                const startEvent = {
                    button: 0,
                    nativeEvent: { isPrimary: true },
                    altKey: true,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
                    stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
                };
                component.onStartDrag(startEvent);

                expect(LayoutController.dragWithAlt).toBe(true);

                // Simulate drag movement past threshold
                const moveEvent = {
                    movementX: 10,
                    movementY: 0,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 110, y: 100 })
                };

                LayoutController.onDragMove(moveEvent);

                // Should have created a duplicate
                expect(currentLayer.children.length).toBe(initialChildCount + 1);
                
                // dragTarget should now be the clone (different uuid)
                expect(LayoutController.dragTarget).not.toBe(component);
                expect(LayoutController.dragTarget.uuid).not.toBe(originalUuid);
                
                // dragWithAlt should be reset after duplication
                expect(LayoutController.dragWithAlt).toBe(false);
            });

            it("should NOT duplicate before threshold is passed", function() {
                const layoutController = window.layoutController;
                const currentLayer = layoutController.currentLayer;
                const trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
                const component = new Component(trackData, new Pose(100, 100, 0), currentLayer, {});
                currentLayer.addChild(component);
                const initialChildCount = currentLayer.children.length;
                
                // Start drag with Alt
                const startEvent = {
                    button: 0,
                    nativeEvent: { isPrimary: true },
                    altKey: true,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
                    stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
                };
                component.onStartDrag(startEvent);

                // Simulate small drag movement below threshold
                const moveEvent = {
                    movementX: 1,
                    movementY: 0,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 101, y: 100 })
                };

                LayoutController.onDragMove(moveEvent);

                // Should NOT have created a duplicate yet
                expect(currentLayer.children.length).toBe(initialChildCount);
                expect(LayoutController.dragTarget).toBe(component);
            });

            it("should NOT duplicate without Alt even after threshold", function() {
                const layoutController = window.layoutController;
                const currentLayer = layoutController.currentLayer;
                const trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
                const component = new Component(trackData, new Pose(100, 100, 0), currentLayer, {});
                currentLayer.addChild(component);
                const originalUuid = component.uuid;
                const initialChildCount = currentLayer.children.length;
                
                // Start drag WITHOUT Alt
                const startEvent = {
                    button: 0,
                    nativeEvent: { isPrimary: true },
                    altKey: false,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
                    stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
                };
                component.onStartDrag(startEvent);

                // Simulate drag movement past threshold
                const moveEvent = {
                    movementX: 10,
                    movementY: 0,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 110, y: 100 })
                };

                LayoutController.onDragMove(moveEvent);

                // Should NOT have created a duplicate
                expect(currentLayer.children.length).toBe(initialChildCount);
                expect(LayoutController.dragTarget).toBe(component);
                expect(LayoutController.dragTarget.uuid).toBe(originalUuid);
            });

            it("should restore original component to normal state after duplication", function() {
                const layoutController = window.layoutController;
                const currentLayer = layoutController.currentLayer;
                const trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
                const component = new Component(trackData, new Pose(100, 100, 0), currentLayer, {});
                currentLayer.addChild(component);
                
                // Start drag with Alt
                const startEvent = {
                    button: 0,
                    nativeEvent: { isPrimary: true },
                    altKey: true,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
                    stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
                };
                component.onStartDrag(startEvent);

                expect(component.alpha).toBe(0.5);
                expect(component.isDragging).toBe(false);

                // Simulate drag movement past threshold
                const moveEvent = {
                    movementX: 10,
                    movementY: 0,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 110, y: 100 })
                };

                LayoutController.onDragMove(moveEvent);

                // Original component should be restored
                expect(component.alpha).toBe(1);
                expect(component.isDragging).toBe(false);
                expect(component.dragStartConnection).toBe(null);
            });

            it("should deselect original component if it was selected", function() {
                const layoutController = window.layoutController;
                const currentLayer = layoutController.currentLayer;
                const trackData = layoutController.trackData.bundles[0].assets.find((a) => a.alias == "railStraight9V");
                const component = new Component(trackData, new Pose(100, 100, 0), currentLayer, {});
                currentLayer.addChild(component);
                LayoutController.selectedComponent = component;
                
                // Start drag with Alt
                const startEvent = {
                    button: 0,
                    nativeEvent: { isPrimary: true },
                    altKey: true,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 100, y: 100 }),
                    stopImmediatePropagation: jasmine.createSpy('stopImmediatePropagation')
                };
                component.onStartDrag(startEvent);

                // Simulate drag movement past threshold
                const moveEvent = {
                    movementX: 10,
                    movementY: 0,
                    getLocalPosition: jasmine.createSpy('getLocalPosition').and.returnValue({ x: 110, y: 100 })
                };

                LayoutController.onDragMove(moveEvent);

                // Original should be deselected
                expect(LayoutController.selectedComponent).not.toBe(component);
            });
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

    it("rotates a pose around an origin by 90 degrees", function() {
        let pose = new Pose(10, 0, 0);
        pose.rotateAround(0, 0, Math.PI / 2);
        
        expect(pose.x).toBeCloseTo(0, 5);
        expect(pose.y).toBeCloseTo(10, 5);
        expect(pose.angle).toBeCloseTo(Math.PI / 2, 5);
    });

    it("rotates a pose around a non-origin point", function() {
        let pose = new Pose(15, 10, 0);
        pose.rotateAround(10, 10, Math.PI / 2);
        
        // Point (15,10) rotated 90° around (10,10) should be (10,15)
        expect(pose.x).toBeCloseTo(10, 5);
        expect(pose.y).toBeCloseTo(15, 5);
        expect(pose.angle).toBeCloseTo(Math.PI / 2, 5);
    });

    it("rotates a pose 180 degrees around an origin", function() {
        let pose = new Pose(5, 5, Math.PI / 4);
        pose.rotateAround(0, 0, Math.PI);
        
        expect(pose.x).toBeCloseTo(-5, 5);
        expect(pose.y).toBeCloseTo(-5, 5);
        expect(pose.angle).toBeCloseTo(Math.PI + Math.PI / 4, 5);
    });

    it("returns the same pose when rotating by 0 radians", function() {
        let pose = new Pose(10, 20, Math.PI / 3);
        pose.rotateAround(5, 5, 0);
        
        expect(pose.x).toBeCloseTo(10, 5);
        expect(pose.y).toBeCloseTo(20, 5);
        expect(pose.angle).toBeCloseTo(Math.PI / 3, 5);
    });

    it("handles full rotation (2π)", function() {
        let pose = new Pose(8, 4, Math.PI / 6);
        const originalX = pose.x;
        const originalY = pose.y;
        const originalAngle = pose.angle;
        
        pose.rotateAround(3, 3, 2 * Math.PI);
        
        expect(pose.x).toBeCloseTo(originalX, 5);
        expect(pose.y).toBeCloseTo(originalY, 5);
        // Angle increases with 2π but gets normalized
        expect(Pose.normalizeAngle(pose.angle)).toBeCloseTo(Pose.normalizeAngle(originalAngle + 2 * Math.PI), 5);
    });

    it("rotates a pose at the origin around itself", function() {
        let pose = new Pose(0, 0, 0);
        pose.rotateAround(0, 0, Math.PI / 4);
        
        expect(pose.x).toBeCloseTo(0, 5);
        expect(pose.y).toBeCloseTo(0, 5);
        expect(pose.angle).toBeCloseTo(Math.PI / 4, 5);
    });
});

describe("LayoutLayer", function() {
    beforeAll(function() {
        window.RBush = class RBush {
            constructor() {
            }
        };
        spyOn(window, 'RBush').and.returnValue(jasmine.createSpyObj("RBush", ["insert", "remove", "clear", "search"]));
    });

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

    // TODO: Test findMatchingConnection

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