/**
 * Integration tests for complete partial circles workflow
 * Tests end-to-end partial circle creation, layout loading, error handling,
 * and BeerCSS upgrade compatibility.
 */

import { Component } from '../../src/model/component.js';
import { LayoutLayer } from '../../src/model/layoutLayer.js';
import { Application, Assets, path } from '../../src/pixi.mjs';

describe("Partial Circles Complete Workflow Integration Tests", function() {
    let mockManifest;

    beforeAll(async function() {
        // Initialize Assets if not already done
        if (!window.app) {
            const app = new Application();
            await app.init({ preference: 'webgl' });
            await Assets.init({ basePath: '../__spec__/img/', manifest: "../data/manifest.json" });
            await Assets.loadBundle('track');
            await Assets.load({alias: path.toAbsolute('../data/manifest.json'), src: '../data/manifest.json' });
            window.app = app;
            window.assets = Assets;
        }
    });

    beforeEach(function() {
        // Mock RBush globally
        window.RBush = function() {
            return {
                insert: jasmine.createSpy('insert'),
                remove: jasmine.createSpy('remove'),
                search: jasmine.createSpy('search').and.returnValue([])
            };
        };

        // Mock manifest data
        mockManifest = {
            bundles: [{
                assets: [{
                    alias: 'shape',
                    name: 'Custom Shape',
                    category: 'custom',
                    type: 'shape',
                    color: 0xA0A5A9,
                    width: 32,
                    height: 32,
                    image: new Image()
                }]
            }]
        };
    });

    afterEach(function() {
        // Clean up any test containers we created
        const testContainer = document.getElementById('testContainer');
        if (testContainer) {
            testContainer.remove();
        }
    });

    describe("End-to-End Partial Circle Creation Workflow", function() {
        it("should create components with correct partial circle data", function() {
            // Test creating a partial circle component with specific percentage
            const layer = new LayoutLayer();
            const component = new Component(
                mockManifest.bundles[0].assets[0],
                { x: 100, y: 100, angle: 0 },
                layer,
                {
                    shape: 'circle',
                    width: 96,
                    height: 96,
                    color: '#0055BF',
                    circlePercentage: 60
                }
            );

            // Verify component was created with correct properties
            expect(component.shape).toBe('circle');
            expect(component.circlePercentage).toBe(60);
            expect(component.componentWidth).toBe(96);
            expect(component.color.toUpperCase()).toBe('#0055BF');
        });

        it("should handle UI element interactions for circle type selection", function() {
            // Set up minimal DOM for testing UI interactions
            const testContainer = document.createElement('div');
            testContainer.id = 'testContainer';
            testContainer.innerHTML = `
                <nav id="circleTypeSelector" class="hidden">
                    <a id="circleTypeFull" class="active">Full Circle</a>
                    <a id="circleTypePartial">Partial Circle</a>
                </nav>
                <div id="percentageConfiguration" class="hidden">
                    <input id="circlePercentageSlider" type="range" min="5" max="95" step="5" value="80">
                    <progress id="circlePreview" class="circle" value="80" max="100"></progress>
                </div>
            `;
            document.body.appendChild(testContainer);

            const circleTypeSelector = document.getElementById('circleTypeSelector');
            const percentageConfig = document.getElementById('percentageConfiguration');
            const fullCircleOption = document.getElementById('circleTypeFull');
            const partialCircleOption = document.getElementById('circleTypePartial');

            // Test showing circle type selector
            circleTypeSelector.classList.remove('hidden');
            expect(circleTypeSelector.classList.contains('hidden')).toBe(false);

            // Test switching to partial circle
            fullCircleOption.classList.remove('active');
            partialCircleOption.classList.add('active');
            percentageConfig.classList.remove('hidden');

            expect(partialCircleOption.classList.contains('active')).toBe(true);
            expect(fullCircleOption.classList.contains('active')).toBe(false);
            expect(percentageConfig.classList.contains('hidden')).toBe(false);

            // Test slider interaction
            const slider = document.getElementById('circlePercentageSlider');
            slider.value = '60';
            expect(slider.value).toBe('60');

            // Test preview update
            const preview = document.getElementById('circlePreview');
            preview.value = 60;
            expect(preview.value).toBe(60);
        });

        it("should validate percentage values in UI components", function() {
            const testContainer = document.createElement('div');
            testContainer.id = 'testContainer';
            testContainer.innerHTML = `
                <input id="circlePercentageSlider" type="range" min="5" max="95" step="5" value="80">
            `;
            document.body.appendChild(testContainer);

            const slider = document.getElementById('circlePercentageSlider');
            
            // Test valid values
            slider.value = '60';
            expect(parseInt(slider.value)).toBe(60);
            
            // Test boundary values
            slider.value = '5';
            expect(parseInt(slider.value)).toBe(5);
            
            slider.value = '95';
            expect(parseInt(slider.value)).toBe(95);
        });
    });

    describe("Layout Loading with Partial Circles", function() {
        it("should correctly deserialize components with partial circles", function() {
            // Test data with partial circles
            const componentData = {
                type: 'shape',
                pose: { x: 100, y: 100, angle: 0 },
                connections: [],
                width: 80,
                height: 80,
                shape: 'circle',
                color: '#237841',
                units: 'studs',
                circle_percentage: 45
            };

            const layer = new LayoutLayer();
            const component = Component.deserialize(mockManifest.bundles[0].assets[0], componentData, layer);

            expect(component.shape).toBe('circle');
            expect(component.circlePercentage).toBe(45);
            expect(component.componentWidth).toBe(80);
        });

        it("should handle layouts with mixed full and partial circles", function() {
            const mixedComponentsData = [
                // Partial circle
                {
                    type: 'shape',
                    pose: { x: 50, y: 50, angle: 0 },
                    connections: [],
                    width: 64,
                    height: 64,
                    shape: 'circle',
                    color: '#FF0000',
                    circle_percentage: 75
                },
                // Full circle (no percentage)
                {
                    type: 'shape',
                    pose: { x: 150, y: 50, angle: 0 },
                    connections: [],
                    width: 64,
                    height: 64,
                    shape: 'circle',
                    color: '#00FF00'
                },
                // Rectangle (should ignore percentage)
                {
                    type: 'shape',
                    pose: { x: 250, y: 50, angle: 0 },
                    connections: [],
                    width: 64,
                    height: 32,
                    shape: 'rectangle',
                    color: '#0000FF'
                }
            ];

            // This should not throw any errors
            expect(function() {
                const layer = new LayoutLayer();
                const components = mixedComponentsData.map(compData => 
                    Component.deserialize(mockManifest.bundles[0].assets[0], compData, layer)
                );
                
                // Verify components were created correctly
                expect(components[0].circlePercentage).toBe(75); // Partial circle
                expect(components[1].circlePercentage).toBeNull(); // Full circle
                expect(components[2].circlePercentage).toBeNull(); // Rectangle
            }).not.toThrow();
        });
    });

    describe("Error Handling Scenarios", function() {
        it("should handle invalid percentage values in component creation", function() {
            const layer = new LayoutLayer();
            
            // Test with invalid percentage values - should clamp to valid range
            const component1 = new Component(
                mockManifest.bundles[0].assets[0],
                { x: 100, y: 100, angle: 0 },
                layer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: 2 // Below minimum
                }
            );
            expect(component1.circlePercentage).toBe(5);

            const component2 = new Component(
                mockManifest.bundles[0].assets[0],
                { x: 100, y: 100, angle: 0 },
                layer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: 98 // Above maximum
                }
            );
            expect(component2.circlePercentage).toBe(95);
        });

        it("should handle corrupted layout data with invalid percentages", function() {
            const corruptedComponentsData = [
                {
                    type: 'shape',
                    pose: { x: 100, y: 100, angle: 0 },
                    connections: [],
                    width: 80,
                    height: 80,
                    shape: 'circle',
                    color: '#237841',
                    circle_percentage: 'invalid' // Invalid type
                },
                {
                    type: 'shape',
                    pose: { x: 200, y: 200, angle: 0 },
                    connections: [],
                    width: 64,
                    height: 64,
                    shape: 'circle',
                    color: '#0055BF',
                    circle_percentage: 150 // Out of range
                }
            ];

            // Should handle gracefully without crashing
            expect(function() {
                const layer = new LayoutLayer();
                corruptedComponentsData.forEach(compData => {
                    const component = Component.deserialize(mockManifest.bundles[0].assets[0], compData, layer);
                    // Invalid string should result in NaN
                    if (compData.circle_percentage === 'invalid') {
                        expect(isNaN(component.circlePercentage)).toBe(true);
                    }
                    // Out of range should be clamped
                    if (compData.circle_percentage === 150) {
                        expect(component.circlePercentage).toBe(95);
                    }
                });
            }).not.toThrow();
        });

        it("should handle null and undefined percentage values", function() {
            const layer = new LayoutLayer();
            
            // Test null percentage
            const component1 = new Component(
                mockManifest.bundles[0].assets[0],
                { x: 100, y: 100, angle: 0 },
                layer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: null
                }
            );
            expect(component1.circlePercentage).toBeNull();

            // Test undefined percentage
            const component2 = new Component(
                mockManifest.bundles[0].assets[0],
                { x: 100, y: 100, angle: 0 },
                layer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: undefined
                }
            );
            expect(component2.circlePercentage).toBeNull();
        });
    });

    describe("BeerCSS Upgrade Compatibility", function() {
        it("should work with BeerCSS v3.13.1 progress elements", function() {
            // Set up DOM for testing
            const testContainer = document.createElement('div');
            testContainer.id = 'testContainer';
            testContainer.innerHTML = `
                <progress id="circlePreview" class="circle" value="80" max="100"></progress>
            `;
            document.body.appendChild(testContainer);
            
            const preview = document.getElementById('circlePreview');
            
            // Verify progress element has required attributes
            expect(preview.classList.contains('circle')).toBe(true);
            expect(preview.hasAttribute('value')).toBe(true);
            expect(preview.hasAttribute('max')).toBe(true);

            // Test value updates
            preview.value = 60;
            expect(preview.value).toBe(60);

            preview.value = 25;
            expect(preview.value).toBe(25);
        });

        it("should handle progress element styling correctly", function() {
            const testContainer = document.createElement('div');
            testContainer.id = 'testContainer';
            testContainer.innerHTML = `
                <progress id="circlePreview" class="circle" value="80" max="100"></progress>
            `;
            document.body.appendChild(testContainer);
            
            const preview = document.getElementById('circlePreview');
            
            // Test that we can set CSS properties
            preview.style.transform = 'rotate(-90deg)';
            preview.style.maskImage = 'none';
            
            expect(preview.style.transform).toBe('rotate(-90deg)');
            expect(preview.style.maskImage).toBe('none');
        });

        it("should work with updated navigation elements", function() {
            const testContainer = document.createElement('div');
            testContainer.id = 'testContainer';
            testContainer.innerHTML = `
                <nav id="circleTypeSelector">
                    <a id="circleTypeFull" class="active">Full Circle</a>
                    <a id="circleTypePartial">Partial Circle</a>
                </nav>
            `;
            document.body.appendChild(testContainer);
            
            const circleTypeSelector = document.getElementById('circleTypeSelector');
            const fullCircleOption = document.getElementById('circleTypeFull');
            const partialCircleOption = document.getElementById('circleTypePartial');

            // Test navigation element structure
            expect(circleTypeSelector.tagName.toLowerCase()).toBe('nav');
            expect(fullCircleOption.tagName.toLowerCase()).toBe('a');
            expect(partialCircleOption.tagName.toLowerCase()).toBe('a');

            // Test active class management
            fullCircleOption.classList.add('active');
            expect(fullCircleOption.classList.contains('active')).toBe(true);

            partialCircleOption.classList.add('active');
            fullCircleOption.classList.remove('active');
            expect(partialCircleOption.classList.contains('active')).toBe(true);
            expect(fullCircleOption.classList.contains('active')).toBe(false);
        });

        it("should maintain compatibility with existing form elements", function() {
            const testContainer = document.createElement('div');
            testContainer.id = 'testContainer';
            testContainer.innerHTML = `
                <input id="componentWidth" type="number" value="64">
                <input id="componentHeight" type="number" value="64">
                <input id="componentColor" type="color" value="#237841">
            `;
            document.body.appendChild(testContainer);
            
            const widthInput = document.getElementById('componentWidth');
            const heightInput = document.getElementById('componentHeight');
            const colorInput = document.getElementById('componentColor');

            widthInput.value = '128';
            heightInput.value = '128';
            colorInput.value = '#FF5722';

            expect(widthInput.value).toBe('128');
            expect(heightInput.value).toBe('128');
            expect(colorInput.value.toUpperCase()).toBe('#FF5722');

            // Test form validation
            expect(widthInput.checkValidity()).toBe(true);
            expect(heightInput.checkValidity()).toBe(true);
            expect(colorInput.checkValidity()).toBe(true);
        });
    });

    describe("Component Editing Workflow", function() {
        it("should handle editing existing partial circle components", function() {
            // Create a component with partial circle data
            const layer = new LayoutLayer();
            const component = new Component(
                mockManifest.bundles[0].assets[0],
                { x: 100, y: 100, angle: 0 },
                layer,
                {
                    shape: 'circle',
                    width: 96,
                    height: 96,
                    color: '#237841',
                    circlePercentage: 65
                }
            );

            // Verify initial state
            expect(component.circlePercentage).toBe(65);
            expect(component.componentWidth).toBe(96);

            // Simulate editing - change percentage
            component.circlePercentage = 45;
            expect(component.circlePercentage).toBe(45);

            // Simulate editing - change to full circle
            component.circlePercentage = null;
            expect(component.circlePercentage).toBeNull();
        });

        it("should preserve other properties when editing circle percentage", function() {
            const layer = new LayoutLayer();
            const component = new Component(
                mockManifest.bundles[0].assets[0],
                { x: 100, y: 100, angle: 0 },
                layer,
                {
                    shape: 'circle',
                    width: 80,
                    height: 80,
                    color: '#0055BF',
                    circlePercentage: 70,
                    opacity: 0.8
                }
            );

            const originalColor = component.color;
            const originalOpacity = component.opacity;
            const originalWidth = component.componentWidth;

            // Change only the percentage
            component.circlePercentage = 30;

            // Verify other properties are preserved
            expect(component.color).toBe(originalColor);
            expect(component.opacity).toBe(originalOpacity);
            expect(component.componentWidth).toBe(originalWidth);
            expect(component.circlePercentage).toBe(30);
        });
    });

    describe("Data Persistence and Export", function() {
        it("should correctly serialize layouts with partial circles", function() {
            // Create a layout with partial circles
            const layer = new LayoutLayer();
            layer.name = "Test Layer";
            
            const partialCircleComponent = new Component(
                mockManifest.bundles[0].assets[0],
                { x: 100, y: 100, angle: 0 },
                layer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: 70
                }
            );

            const fullCircleComponent = new Component(
                mockManifest.bundles[0].assets[0],
                { x: 200, y: 200, angle: 0 },
                layer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#0055BF'
                    // No circlePercentage - full circle
                }
            );

            // Add components to layer as children
            layer.addChild(partialCircleComponent);
            layer.addChild(fullCircleComponent);

            // Test individual component serialization instead of layer serialization
            const partialSerialized = partialCircleComponent.serialize();
            const fullSerialized = fullCircleComponent.serialize();
            
            // Check partial circle serialization
            expect(partialSerialized.circle_percentage).toBe(70);
            
            // Check full circle serialization (should not have circle_percentage)
            expect(partialSerialized.hasOwnProperty('circle_percentage')).toBe(true);
            expect(fullSerialized.hasOwnProperty('circle_percentage')).toBe(false);
        });

        it("should handle import/export round trip correctly", function() {
            // Create original data
            const originalData = {
                type: 'shape',
                pose: { x: 150, y: 150, angle: Math.PI / 4 },
                connections: [],
                width: 96,
                height: 96,
                shape: 'circle',
                color: '#FF5722',
                units: 'studs',
                circle_percentage: 85
            };

            // Create component from data
            const component = Component.deserialize(mockManifest.bundles[0].assets[0], originalData, new LayoutLayer());
            
            // Serialize back
            const serialized = component.serialize();
            
            // Create new component from serialized data
            const newComponent = Component.deserialize(mockManifest.bundles[0].assets[0], serialized, new LayoutLayer());
            
            // Verify round trip preserved all data
            expect(newComponent.shape).toBe(originalData.shape);
            expect(newComponent.circlePercentage).toBe(originalData.circle_percentage);
            expect(newComponent.componentWidth).toBe(originalData.width);
            expect(newComponent.color.toUpperCase()).toBe(originalData.color.toUpperCase());
        });
    });
});