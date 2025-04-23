import { Configuration } from "../../src/model/configuration.js";

describe("Configuration", () => {
    beforeEach(() => {
        // Reset singleton instance before each test
        Configuration._instance = null;
        // Clear localStorage
        localStorage.clear();
    });

    afterAll(() => {
        // Clear localStorage after all tests
        localStorage.clear();
        // Reset singleton instance
        Configuration._instance = null;
    });

    describe("Singleton Pattern", () => {
        it("creates only one instance", () => {
            const config1 = Configuration.getInstance();
            const config2 = Configuration.getInstance();
            expect(config1).toBe(config2);
        });

        it("throws error when trying to construct directly", function() {
            // First create an instance so the singleton exists
            Configuration.getInstance();
            // Now try to create another instance directly
            expect(() => {new Configuration();}).toThrowError("Configuration is a singleton. Use getInstance() instead.");
        });
    });

    describe("Default Values", () => {
        it("provides default grid settings", () => {
            const config = Configuration.getInstance();
            expect(config.gridSettings).toEqual({
                enabled: true,
                size: 1536,
                divisions: 3,
                mainColor: 0xffffff,
                subColor: 0x9c9c9c
            });
        });

        it("provides default zoom level", () => {
            const config = Configuration.getInstance();
            expect(config.defaultZoom).toBe(0.5);
        });
    });

    describe("User Settings", () => {
        it("persists user grid settings to localStorage", () => {
            const config = Configuration.getInstance();
            config.updateUserGridSettings({ divisions: 4 });
            
            // Verify localStorage was updated
            const saved = JSON.parse(localStorage.getItem('bricklayouts-config'));
            expect(saved.gridSettings.divisions).toBe(4);
            
            // Create new instance to verify loading
            Configuration._instance = null;
            const newConfig = Configuration.getInstance();
            expect(newConfig.userGridSettings.divisions).toBe(4);
        });

        it("persists user zoom level to localStorage", () => {
            const config = Configuration.getInstance();
            config.userDefaultZoom = 0.75;
            
            // Verify localStorage was updated
            const saved = JSON.parse(localStorage.getItem('bricklayouts-config'));
            expect(saved.defaultZoom).toBe(0.75);
            
            // Create new instance to verify loading
            Configuration._instance = null;
            const newConfig = Configuration.getInstance();
            expect(newConfig.userDefaultZoom).toBe(0.75);
        });

        it("loads user settings from localStorage", () => {
            localStorage.setItem('bricklayouts-config', JSON.stringify({
                gridSettings: { divisions: 7 },
                defaultZoom: 0.65
            }));
            const config = Configuration.getInstance();
            expect(config.userGridSettings.divisions).toBe(7);
            expect(config.userDefaultZoom).toBe(0.65);
        });
    });

    describe("Workspace Settings", () => {
        it("stores workspace-specific grid settings in memory", () => {
            const config = Configuration.getInstance();
            config.updateWorkspaceGridSettings({ divisions: 5 });
            expect(config.workspaceGridSettings.divisions).toBe(5);
            
            // Verify it wasn't saved to localStorage
            const saved = JSON.parse(localStorage.getItem('bricklayouts-config'));
            expect(saved?.gridSettings?.divisions).toBeUndefined();
        });

        it("stores workspace zoom level in memory", () => {
            const config = Configuration.getInstance();
            config.workspaceDefaultZoom = 0.25;
            expect(config.workspaceDefaultZoom).toBe(0.25);
            
            // Verify it wasn't saved to localStorage
            const savedData = JSON.parse(localStorage.getItem('bricklayouts-config'));
            expect(savedData).toBeNull();
        });

        it("clears workspace settings", () => {
            const config = Configuration.getInstance();
            config.updateWorkspaceGridSettings({ divisions: 5 });
            config.workspaceDefaultZoom = 0.25;
            
            config.clearWorkspaceSettings();
            
            expect(config.workspaceGridSettings).toEqual({});
            expect(config.workspaceDefaultZoom).toBeNull();
        });
    });

    describe("Settings Priority", () => {
        it("prioritizes workspace settings over user settings", () => {
            const config = Configuration.getInstance();
            
            config.updateUserGridSettings({ divisions: 4 });
            expect(config.gridSettings.divisions).toBe(4);
            
            config.updateWorkspaceGridSettings({ divisions: 5 });
            expect(config.gridSettings.divisions).toBe(5);
        });

        it("falls back to user settings when workspace settings are cleared", () => {
            const config = Configuration.getInstance();
            
            config.updateUserGridSettings({ divisions: 4 });
            config.updateWorkspaceGridSettings({ divisions: 5 });
            expect(config.gridSettings.divisions).toBe(5);
            config.clearWorkspaceSettings();
            
            expect(config.gridSettings.divisions).toBe(4);
        });

        it("falls back to defaults when no settings are defined", () => {
            const config = Configuration.getInstance();
            config.updateUserGridSettings({ divisions: 4 });
            expect(config.gridSettings.divisions).toBe(4);
            config.updateUserGridSettings({ divisions: null });
            expect(config.gridSettings.divisions).toBe(3);
        });
    });

    describe("Serialization", () => {
        beforeEach(() => {
            Configuration.getInstance().clearWorkspaceSettings();
        });

        it("serializes grid settings", () => {
            const config = Configuration.getInstance();
            config.updateWorkspaceGridSettings({ divisions: 4 });
            const serialized = config.serializeWorkspaceSettings();
            expect(serialized.gridSettings.divisions).toBe(4);
        });

        it("serializes zoom level", () => {
            const config = Configuration.getInstance();
            config.workspaceDefaultZoom = 0.76;
            const serialized = config.serializeWorkspaceSettings();
            expect(serialized.defaultZoom).toBe(0.76);
        });

        it("serializes grid colors", () => {
            const config = Configuration.getInstance();
            config.updateWorkspaceGridSettings({ mainColor: 0x123456, subColor: 0xabcdef });
            const serialized = config.serializeWorkspaceSettings();
            expect(serialized.gridSettings.mainColor).toBe("#123456");
            expect(serialized.gridSettings.subColor).toBe("#abcdef");
        });

        it("serializes grid settings with enabled flag", () => {
            const config = Configuration.getInstance();
            config.updateWorkspaceGridSettings({ enabled: false });
            const serialized = config.serializeWorkspaceSettings();
            expect(serialized.gridSettings.enabled).toBe(false);
        });

        it("serializes grid settings with size", () => {
            const config = Configuration.getInstance();
            config.updateWorkspaceGridSettings({ size: 1024 });
            const serialized = config.serializeWorkspaceSettings();
            expect(serialized.gridSettings.size).toBe(1024);
        });

        it("serializes an empty object when no settings are defined", () => {
            const config = Configuration.getInstance();
            const serialized = config.serializeWorkspaceSettings();
            expect(serialized).toEqual({});
        });

        it("deserializes grid settings", () => {
            const config = Configuration.getInstance();
            config.deserializeWorkspaceSettings({ gridSettings: { divisions: 4 } });
            expect(config.workspaceGridSettings.divisions).toBe(4);
        });

        it("deserializes zoom level", () => {
            const config = Configuration.getInstance();
            config.deserializeWorkspaceSettings({ defaultZoom: 0.75 });
            expect(config.workspaceDefaultZoom).toBe(0.75);
        });

        it("deserializes grid colors", () => {
            const config = Configuration.getInstance();
            config.deserializeWorkspaceSettings({ gridSettings: { mainColor: "#123456", subColor: "#abcdef" } });
            expect(config.workspaceGridSettings.mainColor).toBe(0x123456);
            expect(config.workspaceGridSettings.subColor).toBe(0xabcdef);
        });

        it("deserializes grid settings with enabled flag", () => {
            const config = Configuration.getInstance();
            config.deserializeWorkspaceSettings({ gridSettings: { enabled: false } });
            expect(config.workspaceGridSettings.enabled).toBe(false);
        });

        it("deserializes a full set of settings", () => {
            const config = Configuration.getInstance();
            config.deserializeWorkspaceSettings({
                gridSettings: { enabled: true, size: 1024, divisions: 4, mainColor: "#123456", subColor: "#abcdef" },
                defaultZoom: 0.79
            });
            expect(config.workspaceGridSettings.enabled).toBe(true);
            expect(config.workspaceGridSettings.size).toBe(1024);
            expect(config.workspaceGridSettings.divisions).toBe(4);
            expect(config.workspaceGridSettings.mainColor).toBe(0x123456);
            expect(config.workspaceGridSettings.subColor).toBe(0xabcdef);
            expect(config.workspaceDefaultZoom).toBe(0.79);
        });

        it("clears existing settings before deserialization", () => {
            const config = Configuration.getInstance();
            config.updateWorkspaceGridSettings({ divisions: 4, mainColor: 0x123456 });
            config.workspaceDefaultZoom = 0.76;
            config.deserializeWorkspaceSettings({ gridSettings: { divisions: 5 } });
            expect(config.workspaceGridSettings.divisions).toBe(5);
            expect(config.workspaceGridSettings.mainColor).toBeUndefined();
            expect(config.workspaceDefaultZoom).toBeNull();
        });
    });

    describe("Serialization Validation", () => {
        it("handles bad root data", () => {
            expect(Configuration.validateImportData(1)).toBeFalse();
        });
        it("validates blank data", () => {
            expect(Configuration.validateImportData({})).toBeTrue();
        });
        it("validates grid settings", () => {
            expect(Configuration.validateImportData({ gridSettings: 1})).toBeFalse();
            expect(Configuration.validateImportData({ gridSettings: {}})).toBeTrue();
        });
        it("validates grid divisions", () => {
            expect(Configuration.validateImportData({ gridSettings: { divisions: 4 } })).toBeTrue();
            expect(Configuration.validateImportData({ gridSettings: { divisions: "4" } })).toBeFalse();
            expect(Configuration.validateImportData({ gridSettings: { divisions: 0 } })).toBeFalse();
        });
        it("validates grid colors", () => {
            expect(Configuration.validateImportData({ gridSettings: { mainColor: "#123456", subColor: "#abcdef" } })).toBeTrue();
            expect(Configuration.validateImportData({ gridSettings: { mainColor: "#123456", subColor: 0xabcdef } })).toBeFalse();
            expect(Configuration.validateImportData({ gridSettings: { mainColor: "#123456", subColor: "#abcdefg" } })).toBeFalse();
            expect(Configuration.validateImportData({ gridSettings: { mainColor: 123, subColor: "#abcdef" } })).toBeFalse();
            expect(Configuration.validateImportData({ gridSettings: { mainColor: false, subColor: "#abcdef" } })).toBeFalse();
        });
        it("validates grid size", () => {
            expect(Configuration.validateImportData({ gridSettings: { size: 1024 } })).toBeTrue();
            expect(Configuration.validateImportData({ gridSettings: { size: "1024" } })).toBeFalse();
            expect(Configuration.validateImportData({ gridSettings: { size: 0 } })).toBeFalse();
        });
        it("validates grid enabled flag", () => {
            expect(Configuration.validateImportData({ gridSettings: { enabled: true } })).toBeTrue();
            expect(Configuration.validateImportData({ gridSettings: { enabled: "true" } })).toBeFalse();
        });
        it("validates zoom level", () => {
            expect(Configuration.validateImportData({ defaultZoom: 0.75 })).toBeTrue();
            expect(Configuration.validateImportData({ defaultZoom: "0.75" })).toBeFalse();
            expect(Configuration.validateImportData({ defaultZoom: -0.75 })).toBeFalse();
            expect(Configuration.validateImportData({ defaultZoom: 1.75 })).toBeFalse();
        });
    });
});