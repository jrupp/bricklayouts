/**
 * Configuration class that manages application-wide settings with support for
 * default values, user preferences, and workspace-specific settings.
 */
export class Configuration {
    static _instance = null;

    static getInstance() {
        if (Configuration._instance === null) {
            Configuration._instance = new Configuration();
        }
        return Configuration._instance;
    }

    /**
     * @private
     */
    constructor() {
        if (Configuration._instance !== null) {
            throw new Error('Configuration is a singleton. Use getInstance() instead.');
        }

        /**
         * Default values that serve as fallbacks
         * @private
         */
        this._defaults = {
            gridSettings: {
                size: 1536,
                divisions: 3,
                mainColor: 0xffffff,
                subColor: 0x9c9c9c
            },
            defaultZoom: 0.5
        };

        /**
         * User settings stored in localStorage
         * @private
         */
        this._userSettings = {
            gridSettings: {},
            defaultZoom: null
        };

        /**
         * Workspace-specific settings
         * @private
         */
        this._workspaceSettings = {
            gridSettings: {},
            defaultZoom: null
        };

        this._loadUserSettings();
    }

    /**
     * Loads user settings from localStorage
     * @private
     */
    _loadUserSettings() {
        const savedConfig = localStorage.getItem('bricklayouts-config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            this._userSettings = {
                gridSettings: parsed.gridSettings || {},
                defaultZoom: parsed.defaultZoom ?? null
            };
        }
    }

    /**
     * Saves user settings to localStorage
     * @private
     */
    _saveUserSettings() {
        localStorage.setItem('bricklayouts-config', JSON.stringify(this._userSettings));
    }

    /**
     * Gets the effective value by checking workspace, user, and default settings in order
     * @private
     * @template T
     * @param {string} category - The settings category (e.g. 'gridSettings')
     * @param {string} [key] - The specific setting key (if accessing a nested property)
     * @returns {T} The effective value
     */
    _getEffectiveValue(category, key = null) {
        if (key) {
            return this._workspaceSettings[category][key] ?? 
                   this._userSettings[category][key] ?? 
                   this._defaults[category][key];
        }
        return this._workspaceSettings[category] ?? 
               this._userSettings[category] ?? 
               this._defaults[category];
    }

    /**
     * Gets the effective grid settings
     * @returns {{size: number, divisions: number, mainColor: number, subColor: number}}
     */
    get gridSettings() {
        return {
            size: this._getEffectiveValue('gridSettings', 'size'),
            divisions: this._getEffectiveValue('gridSettings', 'divisions'),
            mainColor: this._getEffectiveValue('gridSettings', 'mainColor'),
            subColor: this._getEffectiveValue('gridSettings', 'subColor')
        };
    }

    /**
     * Gets the user's grid settings
     * @returns {{size?: number, divisions?: number, mainColor?: number, subColor?: number}}
     */
    get userGridSettings() {
        return {...this._userSettings.gridSettings};
    }

    /**
     * Gets the workspace grid settings
     * @returns {{size?: number, divisions?: number, mainColor?: number, subColor?: number}}
     */
    get workspaceGridSettings() {
        return {...this._workspaceSettings.gridSettings};
    }

    /**
     * Updates user grid settings
     * @param {{size?: number, divisions?: number, mainColor?: number, subColor?: number}} settings
     */
    updateUserGridSettings(settings) {
        this._userSettings.gridSettings = {...this._userSettings.gridSettings, ...settings};
        this._saveUserSettings();
    }

    /**
     * Updates workspace grid settings
     * @param {{size?: number, divisions?: number, mainColor?: number, subColor?: number}} settings
     */
    updateWorkspaceGridSettings(settings) {
        this._workspaceSettings.gridSettings = {...this._workspaceSettings.gridSettings, ...settings};
    }

    /**
     * Gets the effective default zoom level
     * @returns {number}
     */
    get defaultZoom() {
        return this._getEffectiveValue('defaultZoom');
    }

    /**
     * Gets the user's default zoom level
     * @returns {number|null}
     */
    get userDefaultZoom() {
        return this._userSettings.defaultZoom;
    }

    /**
     * Sets the user's default zoom level
     * @param {number|null} value - Use null to clear the setting
     */
    set userDefaultZoom(value) {
        this._userSettings.defaultZoom = value;
        this._saveUserSettings();
    }

    /**
     * Gets the workspace default zoom level
     * @returns {number|null}
     */
    get workspaceDefaultZoom() {
        return this._workspaceSettings.defaultZoom;
    }

    /**
     * Sets the workspace default zoom level
     * @param {number|null} value - Use null to clear the setting
     */
    set workspaceDefaultZoom(value) {
        this._workspaceSettings.defaultZoom = value;
    }

    /**
     * Clears all workspace-specific settings
     */
    clearWorkspaceSettings() {
        this._workspaceSettings = {
            gridSettings: {},
            defaultZoom: null
        };
    }
}