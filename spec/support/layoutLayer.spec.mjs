import { Component } from "../../src/model/component.js";
import { LayoutLayer } from "../../src/model/layoutLayer.js";
import { LayoutController } from "../../src/controller/layoutController.js";
import { RenderLayer } from '../../src/pixi.mjs';


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
            visible: true,
            opacity: 100
        });
    });

    it("serializes a layer with custom opacity", function() {
        let layoutLayer = new LayoutLayer();
        layoutLayer.label = "Test Layer";
        layoutLayer.visible = true;
        layoutLayer.alpha = 0.5;
        let serialized = layoutLayer.serialize();
        expect(serialized).toEqual({
            components: [],
            name: "Test Layer",
            visible: true,
            opacity: 50
        });
    });

    it("deserializes a layer with opacity", function() {
        let serialized = {
            components: [],
            name: "Test Layer",
            visible: true,
            opacity: 75
        };
        let layoutLayer = new LayoutLayer();
        layoutLayer.deserialize(serialized);
        expect(layoutLayer.label).toBe("Test Layer");
        expect(layoutLayer.visible).toBeTrue();
        expect(layoutLayer.alpha).toBeCloseTo(0.75, 2);
    });

    it("deserializes a layer without opacity defaults to 100%", function() {
        let serialized = {
            components: [],
            name: "Test Layer",
            visible: true
        };
        let layoutLayer = new LayoutLayer();
        layoutLayer.deserialize(serialized);
        expect(layoutLayer.label).toBe("Test Layer");
        expect(layoutLayer.visible).toBeTrue();
        expect(layoutLayer.alpha).toBe(1.0);
    });

    it("validates a layer with valid opacity", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [],
            opacity: 50
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeTrue();
    });

    it("validates a layer with opacity 0", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [],
            opacity: 0
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeTrue();
    });

    it("validates a layer with opacity 100", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [],
            opacity: 100
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeTrue();
    });

    it("does not validate a layer with negative opacity", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [],
            opacity: -1
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeFalse();
    });

    it("does not validate a layer with opacity over 100", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [],
            opacity: 101
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeFalse();
    });

    it("does not validate a layer with non-number opacity", function() {
        spyOn(Component, '_validateImportData').and.returnValue(true);
        let serialized = {
            components: [],
            opacity: "50"
        };
        expect(LayoutLayer._validateImportData(serialized)).toBeFalse();
    });

    it("deserializes groups array and creates ComponentGroups", function() {
        // Mock LayoutController for ComponentGroup.destroy()
        const mockLayoutController = jasmine.createSpyObj('LayoutController', ['deleteComponent']);
        spyOn(LayoutController, 'getInstance').and.returnValue(mockLayoutController);
        
        let serialized = {
            components: [],
            name: "Test Layer",
            visible: true,
            groups: [
                { uuid: "group-1" },
                { uuid: "group-2", group: "group-1" }
            ]
        };
        let layoutLayer = new LayoutLayer();
        layoutLayer.deserialize(serialized);
        
        // Check that groups were created
        let groupLookupMap = layoutLayer.getGroupLookupMap();
        expect(groupLookupMap).not.toBeNull();
        expect(groupLookupMap.size).toBe(2);
        
        // Check top-level group
        let group1 = groupLookupMap.get("group-1");
        expect(group1).toBeDefined();
        expect(group1.isTemporary).toBeFalse();
        expect(group1.parent).toBe(layoutLayer);
        expect(group1.group).toBeNull();
        
        // Check nested group
        let group2 = groupLookupMap.get("group-2");
        expect(group2).toBeDefined();
        expect(group2.isTemporary).toBeFalse();
        expect(group2.parent).toBe(layoutLayer);
        expect(group2.group).toBe(group1);
        
        // Clean up
        layoutLayer.cleanupGroupDeserialization();
        expect(layoutLayer.getGroupLookupMap()).toBeNull();
    });

    it("handles missing parent group gracefully during deserialization", function() {
        // Mock LayoutController for ComponentGroup.destroy()
        const mockLayoutController = jasmine.createSpyObj('LayoutController', ['deleteComponent']);
        spyOn(LayoutController, 'getInstance').and.returnValue(mockLayoutController);
        
        let serialized = {
            components: [],
            name: "Test Layer",
            visible: true,
            groups: [
                { uuid: "orphan-group", group: "missing-parent" }
            ]
        };
        let layoutLayer = new LayoutLayer();
        spyOn(console, 'warn');
        
        layoutLayer.deserialize(serialized);
        
        // Check that orphan group was created as top-level
        let groupLookupMap = layoutLayer.getGroupLookupMap();
        expect(groupLookupMap).not.toBeNull();
        expect(groupLookupMap.size).toBe(1);
        
        let orphanGroup = groupLookupMap.get("orphan-group");
        expect(orphanGroup).toBeDefined();
        expect(orphanGroup.group).toBeNull(); // Should be treated as top-level
        expect(console.warn).toHaveBeenCalledWith('Group orphan-group references missing parent group missing-parent, treating as top-level group');
        
        // Clean up
        layoutLayer.cleanupGroupDeserialization();
    });

    it("deserializes ComponentGroup locked state correctly", function() {
        // Mock LayoutController for ComponentGroup.destroy()
        const mockLayoutController = jasmine.createSpyObj('LayoutController', ['deleteComponent']);
        spyOn(LayoutController, 'getInstance').and.returnValue(mockLayoutController);
        
        let serialized = {
            components: [],
            name: "Test Layer",
            visible: true,
            groups: [
                { uuid: "unlocked-group" }, // No locked property - should be unlocked
                { uuid: "locked-group", locked: 1 }, // locked: 1 - should be locked
                { uuid: "nested-locked-group", group: "unlocked-group", locked: 1 } // Nested locked group
            ]
        };
        let layoutLayer = new LayoutLayer();
        layoutLayer.deserialize(serialized);
        
        let groupLookupMap = layoutLayer.getGroupLookupMap();
        expect(groupLookupMap).not.toBeNull();
        expect(groupLookupMap.size).toBe(3);
        
        // Check unlocked group (Requirements 6.4)
        let unlockedGroup = groupLookupMap.get("unlocked-group");
        expect(unlockedGroup).toBeDefined();
        expect(unlockedGroup.locked).toBeFalse();
        
        // Check locked group (Requirements 6.3)
        let lockedGroup = groupLookupMap.get("locked-group");
        expect(lockedGroup).toBeDefined();
        expect(lockedGroup.locked).toBeTrue();
        
        // Check nested locked group (Requirements 6.3)
        let nestedLockedGroup = groupLookupMap.get("nested-locked-group");
        expect(nestedLockedGroup).toBeDefined();
        expect(nestedLockedGroup.locked).toBeTrue();
        expect(nestedLockedGroup.group).toBe(unlockedGroup);
        
        // Clean up
        layoutLayer.cleanupGroupDeserialization();
    });

    it("handles invalid locked values during ComponentGroup deserialization", function() {
        // Mock LayoutController for ComponentGroup.destroy()
        const mockLayoutController = jasmine.createSpyObj('LayoutController', ['deleteComponent']);
        spyOn(LayoutController, 'getInstance').and.returnValue(mockLayoutController);
        
        let serialized = {
            components: [],
            name: "Test Layer",
            visible: true,
            groups: [
                { uuid: "invalid-locked-group", locked: 0 }, // locked: 0 - should be unlocked
                { uuid: "invalid-locked-string", locked: "true" }, // locked: "true" - should be unlocked
                { uuid: "invalid-locked-number", locked: 2 } // locked: 2 - should be unlocked
            ]
        };
        let layoutLayer = new LayoutLayer();
        layoutLayer.deserialize(serialized);
        
        let groupLookupMap = layoutLayer.getGroupLookupMap();
        expect(groupLookupMap).not.toBeNull();
        expect(groupLookupMap.size).toBe(3);
        
        // All groups with invalid locked values should be unlocked (Requirements 6.4)
        let invalidLockedGroup = groupLookupMap.get("invalid-locked-group");
        expect(invalidLockedGroup).toBeDefined();
        expect(invalidLockedGroup.locked).toBeFalse();
        
        let invalidLockedString = groupLookupMap.get("invalid-locked-string");
        expect(invalidLockedString).toBeDefined();
        expect(invalidLockedString.locked).toBeFalse();
        
        let invalidLockedNumber = groupLookupMap.get("invalid-locked-number");
        expect(invalidLockedNumber).toBeDefined();
        expect(invalidLockedNumber.locked).toBeFalse();
        
        // Clean up
        layoutLayer.cleanupGroupDeserialization();
    });

    it("restores locked state for orphaned groups during deserialization", function() {
        // Mock LayoutController for ComponentGroup.destroy()
        const mockLayoutController = jasmine.createSpyObj('LayoutController', ['deleteComponent']);
        spyOn(LayoutController, 'getInstance').and.returnValue(mockLayoutController);
        
        let serialized = {
            components: [],
            name: "Test Layer",
            visible: true,
            groups: [
                { uuid: "orphan-locked-group", group: "missing-parent", locked: 1 }
            ]
        };
        let layoutLayer = new LayoutLayer();
        spyOn(console, 'warn');
        
        layoutLayer.deserialize(serialized);
        
        // Check that orphan group was created as top-level and locked state was restored
        let groupLookupMap = layoutLayer.getGroupLookupMap();
        expect(groupLookupMap).not.toBeNull();
        expect(groupLookupMap.size).toBe(1);
        
        let orphanGroup = groupLookupMap.get("orphan-locked-group");
        expect(orphanGroup).toBeDefined();
        expect(orphanGroup.group).toBeNull(); // Should be treated as top-level
        expect(orphanGroup.locked).toBeTrue(); // Should preserve locked state (Requirements 6.3)
        expect(console.warn).toHaveBeenCalledWith('Group orphan-locked-group references missing parent group missing-parent, treating as top-level group');
        
        // Clean up
        layoutLayer.cleanupGroupDeserialization();
    });

    describe("serialization error handling", function() {
        beforeEach(function() {
            // Mock LayoutController for ComponentGroup.destroy()
            const mockLayoutController = jasmine.createSpyObj('LayoutController', ['deleteComponent']);
            spyOn(LayoutController, 'getInstance').and.returnValue(mockLayoutController);
        });
        it("should handle missing group UUID during component deserialization", function() {
            let layoutLayer = new LayoutLayer();
            spyOn(console, 'warn');
            
            // First deserialize the layer with groups
            let layerData = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "existing-group" }
                ]
            };
            
            layoutLayer.deserialize(layerData);
            
            // Mock TrackData for a component
            const mockTrackData = {
                alias: "railStraight9V",
                name: "Straight Rail",
                category: "track",
                type: "track",
                connections: []
            };
            
            // Component data with missing group reference
            let componentData = {
                type: "railStraight9V",
                pose: [0, 0, 0],
                connections: [],
                group: "missing-group-uuid"
            };
            
            // Actually call Component.deserialize to test the real code
            const component = Component.deserialize(mockTrackData, componentData, layoutLayer);
            
            // Should warn about missing group UUID
            expect(console.warn).toHaveBeenCalledWith(`Component ${component.uuid} references missing group missing-group-uuid, treating as ungrouped`);
            
            // Component should not be assigned to any group
            expect(component.group).toBeNull();
            
            // Clean up
            layoutLayer.cleanupGroupDeserialization();
        });

        it("should cleanup orphaned groups after deserialization", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "orphaned-group" },
                    { uuid: "group-with-components" }
                ]
            };
            
            let layoutLayer = new LayoutLayer();
            spyOn(console, 'warn');
            
            layoutLayer.deserialize(serialized);
            
            // Get the group lookup map to verify groups were created
            let groupLookupMap = layoutLayer.getGroupLookupMap();
            expect(groupLookupMap.size).toBe(2);
            
            let orphanedGroup = groupLookupMap.get("orphaned-group");
            let groupWithComponents = groupLookupMap.get("group-with-components");
            
            expect(orphanedGroup).toBeDefined();
            expect(groupWithComponents).toBeDefined();
            
            // Spy on destroy methods
            spyOn(orphanedGroup, 'destroy').and.callThrough();
            spyOn(groupWithComponents, 'destroy').and.callThrough();
            
            // Create a mock component that passes instanceof Component check
            const mockComponent = Object.create(Component.prototype);
            mockComponent.group = groupWithComponents; // Set group reference directly
            mockComponent.parent = layoutLayer;
            mockComponent.connections = [];
            mockComponent.getBounds = jasmine.createSpy('getBounds').and.returnValue({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
            mockComponent.destroy = jasmine.createSpy('destroy');
            
            // Manually add to layer's children array to simulate a real component
            layoutLayer.children.push(mockComponent);
            
            // Clean up should destroy orphaned groups
            layoutLayer.cleanupGroupDeserialization();
            
            // Should warn about orphaned group
            expect(console.warn).toHaveBeenCalledWith('Destroying orphaned group orphaned-group with no components');
            
            // Should call destroy on orphaned group
            expect(orphanedGroup.destroy).toHaveBeenCalled();
            
            // Should not destroy group with components
            expect(groupWithComponents.destroy).not.toHaveBeenCalled();
        });

        it("should maintain backward compatibility with layouts without groups field", function() {
            let serialized = {
                components: [
                    {
                        type: "railStraight9V",
                        pose: [0, 0, 0],
                        connections: []
                        // No group property
                    }
                ],
                name: "Test Layer",
                visible: true
                // No groups field
            };
            
            let layoutLayer = new LayoutLayer();
            
            // Should not throw error
            expect(() => layoutLayer.deserialize(serialized)).not.toThrow();
            
            // Should not create any groups
            expect(layoutLayer.getGroupLookupMap()).toBeNull();
        });

        it("should validate groups field is an array", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: "not-an-array"
            };
            
            spyOn(Component, '_validateImportData').and.returnValue(true);
            
            // Should not validate with invalid groups field
            expect(LayoutLayer._validateImportData(serialized)).toBeFalse();
        });

        it("should validate group objects have uuid property", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "valid-group" },
                    { invalidGroup: "no-uuid" }
                ]
            };
            
            spyOn(Component, '_validateImportData').and.returnValue(true);
            
            // Should not validate with invalid group object
            expect(LayoutLayer._validateImportData(serialized)).toBeFalse();
        });

        it("should validate group uuid is a string", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: 123 } // uuid should be string, not number
                ]
            };
            
            spyOn(Component, '_validateImportData').and.returnValue(true);
            
            // Should not validate with non-string uuid
            expect(LayoutLayer._validateImportData(serialized)).toBeFalse();
        });

        it("should validate optional group parent property is a string", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "child-group", group: 123 } // parent group should be string, not number
                ]
            };
            
            spyOn(Component, '_validateImportData').and.returnValue(true);
            
            // Should not validate with non-string parent group
            expect(LayoutLayer._validateImportData(serialized)).toBeFalse();
        });

        it("should accept valid groups field", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "parent-group" },
                    { uuid: "child-group", group: "parent-group" }
                ]
            };
            
            spyOn(Component, '_validateImportData').and.returnValue(true);
            
            // Should validate with valid groups field
            expect(LayoutLayer._validateImportData(serialized)).toBeTrue();
        });
    });

    describe("nested group deserialization", function() {
        beforeEach(function() {
            // Mock LayoutController for ComponentGroup.destroy()
            const mockLayoutController = jasmine.createSpyObj('LayoutController', ['deleteComponent']);
            spyOn(LayoutController, 'getInstance').and.returnValue(mockLayoutController);
        });
        it("should handle deferred nested group creation", function() {
            // Test case where child group appears before parent in JSON
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "child-group", group: "parent-group" }, // Child appears first
                    { uuid: "parent-group" } // Parent appears second
                ]
            };
            
            let layoutLayer = new LayoutLayer();
            layoutLayer.deserialize(serialized);
            
            let groupLookupMap = layoutLayer.getGroupLookupMap();
            expect(groupLookupMap.size).toBe(2);
            
            let parentGroup = groupLookupMap.get("parent-group");
            let childGroup = groupLookupMap.get("child-group");
            
            expect(parentGroup).toBeDefined();
            expect(childGroup).toBeDefined();
            
            // Verify parent-child relationship is established correctly
            expect(parentGroup.group).toBeNull(); // Parent has no parent
            expect(childGroup.group).toBe(parentGroup); // Child references parent
            expect(parentGroup.parent).toBe(layoutLayer);
            expect(childGroup.parent).toBe(layoutLayer);
            
            // Clean up
            layoutLayer.cleanupGroupDeserialization();
        });

        it("should handle multiple levels of nesting", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "grandchild-group", group: "child-group" },
                    { uuid: "child-group", group: "parent-group" },
                    { uuid: "parent-group" }
                ]
            };
            
            let layoutLayer = new LayoutLayer();
            layoutLayer.deserialize(serialized);
            
            let groupLookupMap = layoutLayer.getGroupLookupMap();
            expect(groupLookupMap.size).toBe(3);
            
            let parentGroup = groupLookupMap.get("parent-group");
            let childGroup = groupLookupMap.get("child-group");
            let grandchildGroup = groupLookupMap.get("grandchild-group");
            
            expect(parentGroup).toBeDefined();
            expect(childGroup).toBeDefined();
            expect(grandchildGroup).toBeDefined();
            
            // Verify nesting hierarchy
            expect(parentGroup.group).toBeNull();
            expect(childGroup.group).toBe(parentGroup);
            expect(grandchildGroup.group).toBe(childGroup);
            
            // Clean up
            layoutLayer.cleanupGroupDeserialization();
        });

        it("should handle invalid parent group UUID gracefully", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "orphan-group", group: "non-existent-parent" },
                    { uuid: "valid-group" }
                ]
            };
            
            let layoutLayer = new LayoutLayer();
            spyOn(console, 'warn');
            
            layoutLayer.deserialize(serialized);
            
            let groupLookupMap = layoutLayer.getGroupLookupMap();
            expect(groupLookupMap.size).toBe(2);
            
            let orphanGroup = groupLookupMap.get("orphan-group");
            let validGroup = groupLookupMap.get("valid-group");
            
            expect(orphanGroup).toBeDefined();
            expect(validGroup).toBeDefined();
            
            // Orphan group should be treated as top-level
            expect(orphanGroup.group).toBeNull();
            expect(validGroup.group).toBeNull();
            
            // Should warn about missing parent
            expect(console.warn).toHaveBeenCalledWith('Group orphan-group references missing parent group non-existent-parent, treating as top-level group');
            
            // Clean up
            layoutLayer.cleanupGroupDeserialization();
        });

        it("should handle circular group references", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "group-a", group: "group-b" },
                    { uuid: "group-b", group: "group-a" } // Circular reference
                ]
            };
            
            let layoutLayer = new LayoutLayer();
            spyOn(console, 'warn');
            
            layoutLayer.deserialize(serialized);
            
            let groupLookupMap = layoutLayer.getGroupLookupMap();
            expect(groupLookupMap.size).toBe(2);
            
            let groupA = groupLookupMap.get("group-a");
            let groupB = groupLookupMap.get("group-b");
            
            expect(groupA).toBeDefined();
            expect(groupB).toBeDefined();
            
            // Both groups should be treated as top-level to break circular reference
            expect(groupA.group).toBeNull();
            expect(groupB.group).toBeNull();
            
            // Should warn about circular reference
            expect(console.warn).toHaveBeenCalledWith('Group group-a references missing parent group group-b, treating as top-level group');
            
            // Clean up
            layoutLayer.cleanupGroupDeserialization();
        });

        it("should handle self-referencing group", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "self-ref-group", group: "self-ref-group" } // Self reference
                ]
            };
            
            let layoutLayer = new LayoutLayer();
            spyOn(console, 'warn');
            
            layoutLayer.deserialize(serialized);
            
            let groupLookupMap = layoutLayer.getGroupLookupMap();
            expect(groupLookupMap.size).toBe(1);
            
            let selfRefGroup = groupLookupMap.get("self-ref-group");
            expect(selfRefGroup).toBeDefined();
            
            // Group should be treated as top-level to break self-reference
            expect(selfRefGroup.group).toBeNull();
            
            // Should warn about self-reference
            expect(console.warn).toHaveBeenCalledWith('Group self-ref-group references missing parent group self-ref-group, treating as top-level group');
            
            // Clean up
            layoutLayer.cleanupGroupDeserialization();
        });

        it("should process deferred groups in correct dependency order", function() {
            // Complex nesting where groups appear in random order
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "level-3-group", group: "level-2-group" },
                    { uuid: "level-1-group" }, // Top level
                    { uuid: "level-2-group", group: "level-1-group" },
                    { uuid: "another-level-3", group: "level-2-group" }
                ]
            };
            
            let layoutLayer = new LayoutLayer();
            layoutLayer.deserialize(serialized);
            
            let groupLookupMap = layoutLayer.getGroupLookupMap();
            expect(groupLookupMap.size).toBe(4);
            
            let level1 = groupLookupMap.get("level-1-group");
            let level2 = groupLookupMap.get("level-2-group");
            let level3a = groupLookupMap.get("level-3-group");
            let level3b = groupLookupMap.get("another-level-3");
            
            // Verify all groups exist
            expect(level1).toBeDefined();
            expect(level2).toBeDefined();
            expect(level3a).toBeDefined();
            expect(level3b).toBeDefined();
            
            // Verify hierarchy is correct
            expect(level1.group).toBeNull();
            expect(level2.group).toBe(level1);
            expect(level3a.group).toBe(level2);
            expect(level3b.group).toBe(level2);
            
            // Clean up
            layoutLayer.cleanupGroupDeserialization();
        });

        it("should handle empty groups array", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: []
            };
            
            let layoutLayer = new LayoutLayer();
            
            // Should not throw error
            expect(() => layoutLayer.deserialize(serialized)).not.toThrow();
            
            // Should create empty group lookup map for empty groups array
            expect(layoutLayer.getGroupLookupMap()).toEqual(new Map());
        });

        it("should handle groups with duplicate UUIDs", function() {
            let serialized = {
                components: [],
                name: "Test Layer",
                visible: true,
                groups: [
                    { uuid: "duplicate-uuid" },
                    { uuid: "duplicate-uuid", group: "parent-group" }, // Duplicate UUID
                    { uuid: "parent-group" }
                ]
            };
            
            let layoutLayer = new LayoutLayer();
            spyOn(console, 'warn');
            
            layoutLayer.deserialize(serialized);
            
            let groupLookupMap = layoutLayer.getGroupLookupMap();
            
            // Should only have 2 unique groups (duplicate should be ignored or overwritten)
            expect(groupLookupMap.size).toBe(2);
            
            let duplicateGroup = groupLookupMap.get("duplicate-uuid");
            let parentGroup = groupLookupMap.get("parent-group");
            
            expect(duplicateGroup).toBeDefined();
            expect(parentGroup).toBeDefined();
            
            // The last occurrence should win (second duplicate-uuid references parent-group)
            expect(duplicateGroup.group).toBe(parentGroup);
            
            // Clean up
            layoutLayer.cleanupGroupDeserialization();
        });
    });
});
