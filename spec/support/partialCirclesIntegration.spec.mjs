/**
 * Integration tests for the partial circles feature
 * Tests the complete workflow from shape selection to component creation,
 * backward compatibility, serialization/deserialization, and error handling.
 */

import { Component } from '../../src/model/component.js';
import { LayoutLayer } from '../../src/model/layoutLayer.js';
import { Pose } from '../../src/model/pose.js';
import { Connection } from '../../src/model/connection.js';
import { Application, Assets, path } from '../../src/pixi.mjs';

describe("Partial Circles Integration Tests", function() {
    let mockLayer;
    let mockTrackData;

    beforeAll(async function() {
        // Initialize Assets if not already done
        if (!window.app) {
            const app = new Application();
            await app.init();
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

        // Mock track data
        mockTrackData = {
            alias: 'shape',
            name: 'Custom Shape',
            category: 'custom',
            type: 'shape',
            color: 0xA0A5A9,
            width: 32,
            height: 32,
            image: new Image()
        };

        // Create a mock layer
        mockLayer = new LayoutLayer();
        mockLayer.tree = {
            insert: jasmine.createSpy('insert'),
            remove: jasmine.createSpy('remove'),
            search: jasmine.createSpy('search').and.returnValue([])
        };
    });

    describe("Component Creation and Rendering Tests", function() {
        it("should create full circle components correctly", function() {
            // Create a full circle component
            const component = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841'
                    // No circlePercentage - should be full circle
                }
            );

            // Verify it's treated as a full circle
            expect(component.circlePercentage).toBeNull();
            expect(component.shape).toBe('circle');
            expect(component.componentWidth).toBe(64);
        });

        it("should create partial circle components correctly", function() {
            // Create a partial circle component
            const component = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: 40
                }
            );

            // Verify it's treated as a partial circle
            expect(component.circlePercentage).toBe(40);
            expect(component.shape).toBe('circle');
            expect(component.componentWidth).toBe(64);
        });

        it("should clamp percentage values to valid range", function() {
            // Test below minimum
            const component1 = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: 2 // Below minimum of 5
                }
            );
            expect(component1.circlePercentage).toBe(5);
            
            // Test above maximum
            const component2 = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: 98 // Above maximum of 95
                }
            );
            expect(component2.circlePercentage).toBe(95);
        });
    });

    describe("Backward Compatibility Tests", function() {
        it("should serialize full circles without circle_percentage property", function() {
            // Create a full circle component
            const component = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    units: 'studs'
                    // No circlePercentage - should be full circle
                }
            );

            const serialized = component.serialize();
            
            // Verify circle_percentage is not included for full circles
            expect(serialized.hasOwnProperty('circle_percentage')).toBe(false);
            expect(serialized.shape).toBe('circle');
        });

        it("should serialize partial circles with circle_percentage property", function() {
            // Create a partial circle component
            const component = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    units: 'studs',
                    circlePercentage: 65
                }
            );

            const serialized = component.serialize();
            
            // Verify circle_percentage is included for partial circles
            expect(serialized.circle_percentage).toBe(65);
            expect(serialized.shape).toBe('circle');
        });
    });

    describe("Serialization/Deserialization Tests", function() {
        it("should correctly deserialize partial circle components", function() {
            const serializedData = {
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

            const component = Component.deserialize(mockTrackData, serializedData, mockLayer);
            
            expect(component.shape).toBe('circle');
            expect(component.circlePercentage).toBe(45);
            expect(component.componentWidth).toBe(80);
        });

        it("should validate circle_percentage range during deserialization", function() {
            const serializedData = {
                type: 'shape',
                pose: { x: 100, y: 100, angle: 0 },
                connections: [],
                width: 80,
                height: 80,
                shape: 'circle',
                color: '#237841',
                units: 'studs',
                circle_percentage: 150 // Invalid - should be clamped
            };

            const component = Component.deserialize(mockTrackData, serializedData, mockLayer);
            
            // Should be clamped to valid range
            expect(component.circlePercentage).toBe(95);
        });

        it("should handle round-trip serialization/deserialization", function() {
            // Create original component
            const originalComponent = new Component(
                mockTrackData,
                { x: 75, y: 125, angle: Math.PI / 4 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 96,
                    height: 96,
                    color: '#0055BF',
                    units: 'studs',
                    circlePercentage: 30
                }
            );

            // Serialize
            const serialized = originalComponent.serialize();
            
            // Deserialize
            const deserializedComponent = Component.deserialize(mockTrackData, serialized, mockLayer);
            
            // Verify all properties match
            expect(deserializedComponent.shape).toBe(originalComponent.shape);
            expect(deserializedComponent.circlePercentage).toBe(originalComponent.circlePercentage);
            expect(deserializedComponent.componentWidth).toBe(originalComponent.componentWidth);
            expect(deserializedComponent.color).toBe(originalComponent.color);
            expect(deserializedComponent.units).toBe(originalComponent.units);
        });
    });

    describe("Error Handling Tests", function() {
        it("should handle null percentage values", function() {
            // Create component with null percentage (should be full circle)
            const component = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: null
                }
            );

            expect(component.circlePercentage).toBeNull();
            expect(component.shape).toBe('circle');
        });

        it("should handle undefined percentage values", function() {
            // Create component with undefined percentage (should be full circle)
            const component = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: undefined
                }
            );

            expect(component.circlePercentage).toBeNull();
            expect(component.shape).toBe('circle');
        });

        it("should validate data during import", function() {
            // Test with invalid serialized data
            const invalidData = {
                type: 'shape',
                pose: { x: 100, y: 100, angle: 0 },
                connections: [],
                width: 80,
                height: 80,
                shape: 'circle',
                color: '#237841',
                units: 'studs',
                circle_percentage: 'invalid' // Invalid type
            };

            // Should handle gracefully and not crash
            expect(function() {
                Component._validateImportData(invalidData);
            }).not.toThrow();
        });
    });

    describe("Data Validation Tests", function() {
        it("should validate circle_percentage in import data", function() {
            // Test valid data
            const validData = {
                type: 'shape',
                pose: { x: 100, y: 100, angle: 0 },
                connections: [],
                width: 80,
                height: 80,
                shape: 'circle',
                color: '#237841',
                units: 'studs',
                circle_percentage: 50
            };

            expect(Component._validateImportData(validData)).toBe(true);
        });

        it("should reject invalid circle_percentage values", function() {
            // Test with percentage below minimum
            const invalidData1 = {
                type: 'shape',
                pose: { x: 100, y: 100, angle: 0 },
                connections: [],
                width: 80,
                height: 80,
                shape: 'circle',
                color: '#237841',
                units: 'studs',
                circle_percentage: 3 // Below minimum of 5
            };

            expect(Component._validateImportData(invalidData1)).toBe(false);

            // Test with percentage above maximum
            const invalidData2 = {
                type: 'shape',
                pose: { x: 100, y: 100, angle: 0 },
                connections: [],
                width: 80,
                height: 80,
                shape: 'circle',
                color: '#237841',
                units: 'studs',
                circle_percentage: 97 // Above maximum of 95
            };

            expect(Component._validateImportData(invalidData2)).toBe(false);
        });

        it("should accept data without circle_percentage", function() {
            // Test data without circle_percentage (full circle)
            const dataWithoutPercentage = {
                type: 'shape',
                pose: { x: 100, y: 100, angle: 0 },
                connections: [],
                width: 80,
                height: 80,
                shape: 'circle',
                color: '#237841',
                units: 'studs'
                // No circle_percentage property
            };

            expect(Component._validateImportData(dataWithoutPercentage)).toBe(true);
        });
    });

    describe("Component Property Management Tests", function() {
        it("should handle setting and getting circle percentage", function() {
            const component = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841'
                }
            );

            // Initially should be null (full circle)
            expect(component.circlePercentage).toBeNull();

            // Set to partial circle
            component.circlePercentage = 75;
            expect(component.circlePercentage).toBe(75);

            // Set back to full circle
            component.circlePercentage = null;
            expect(component.circlePercentage).toBeNull();
        });

        it("should only allow circle percentage on circle shapes", function() {
            const rectangleComponent = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'rectangle',
                    width: 64,
                    height: 64,
                    color: '#237841'
                }
            );

            // Should not allow setting circle percentage on rectangle
            rectangleComponent.circlePercentage = 50;
            expect(rectangleComponent.circlePercentage).toBeNull();
        });

        it("should validate percentage range when setting property", function() {
            const component = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841'
                }
            );

            // Test below minimum
            component.circlePercentage = 2;
            expect(component.circlePercentage).toBe(5);

            // Test above maximum
            component.circlePercentage = 98;
            expect(component.circlePercentage).toBe(95);

            // Test valid value
            component.circlePercentage = 60;
            expect(component.circlePercentage).toBe(60);
        });
    });

    describe("Integration with Existing Features Tests", function() {
        it("should work with component cloning", function() {
            // Create original partial circle component
            const originalComponent = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: 35
                }
            );

            // Clone the component
            const clonedComponent = originalComponent.clone(mockLayer);

            // Verify clone has same properties
            expect(clonedComponent.shape).toBe(originalComponent.shape);
            expect(clonedComponent.circlePercentage).toBe(originalComponent.circlePercentage);
            expect(clonedComponent.componentWidth).toBe(originalComponent.componentWidth);
            expect(clonedComponent.color).toBe(originalComponent.color);
        });

        it("should work with component resizing", function() {
            const component = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: 70
                }
            );

            // Resize the component
            component.resize(96, 96, 'studs');

            // Verify percentage is preserved
            expect(component.circlePercentage).toBe(70);
            expect(component.componentWidth).toBe(96);
            expect(component.componentHeight).toBe(96);
        });

        it("should maintain percentage when changing other properties", function() {
            const component = new Component(
                mockTrackData,
                { x: 50, y: 50, angle: 0 },
                mockLayer,
                {
                    shape: 'circle',
                    width: 64,
                    height: 64,
                    color: '#237841',
                    circlePercentage: 55
                }
            );

            // Change color
            component.color = '#0055BF';
            expect(component.circlePercentage).toBe(55);

            // Change opacity
            component.opacity = 0.5;
            expect(component.circlePercentage).toBe(55);

            // Change outline color
            component.outlineColor = '#FF0000';
            expect(component.circlePercentage).toBe(55);
        });
    });
});