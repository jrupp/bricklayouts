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
});