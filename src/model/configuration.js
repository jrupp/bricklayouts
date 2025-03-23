/**
 * @typedef {Object} GridSettings
 * @property {boolean} enabled Whether the grid is enabled or not
 * @property {number} size The base size of the grid in pixels, 16 pixels per stud (1536 = 96 studs)
 * @property {number} divisions Number of subdivisions within each grid cell. If set to 1, no subdivisions are shown.
 * @property {number} mainColor The color of the main grid lines in hexadecimal (e.g. 0xffffff for white)
 * @property {number} subColor The color of the subdivision grid lines in hexadecimal (e.g. 0x9c9c9c for gray)
 */

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
         * @type {{gridSettings: GridSettings, defaultZoom: number}}
         * @private
         */
        this._defaults = {
            gridSettings: {
                enabled: true,
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
     * Serializes workspace settings for storage in layout files
     * @returns {string} The serialized workspace settings
     */
    serializeWorkspaceSettings() {
        let settings = {};
        if (this._workspaceSettings.defaultZoom !== null) {
            settings.defaultZoom = this._workspaceSettings.defaultZoom;
        }
        if (Object.keys(this._workspaceSettings.gridSettings).length > 0) {
            settings.gridSettings = this._workspaceSettings.gridSettings;
            if (settings.gridSettings.hasOwnProperty('mainColor')) {
                settings.gridSettings.mainColor = `#${settings.gridSettings.mainColor.toString(16)}`;
            }
            if (settings.gridSettings.hasOwnProperty('subColor')) {
                settings.gridSettings.subColor = `#${settings.gridSettings.subColor.toString(16)}`;
            }
        }
        return JSON.stringify(settings);
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
     * @returns {GridSettings}
     */
    get gridSettings() {
        return {
            enabled: this._getEffectiveValue('gridSettings', 'enabled'),
            size: this._getEffectiveValue('gridSettings', 'size'),
            divisions: this._getEffectiveValue('gridSettings', 'divisions'),
            mainColor: this._getEffectiveValue('gridSettings', 'mainColor'),
            subColor: this._getEffectiveValue('gridSettings', 'subColor')
        };
    }

    /**
     * Gets the user's grid settings
     * @returns {Partial<GridSettings>}
     */
    get userGridSettings() {
        return {...this._userSettings.gridSettings};
    }

    /**
     * Gets the workspace grid settings
     * @returns {Partial<GridSettings>}
     */
    get workspaceGridSettings() {
        return {...this._workspaceSettings.gridSettings};
    }

    /**
     * Updates user grid settings
     * @param {Partial<GridSettings>} settings
     */
    updateUserGridSettings(settings) {
        this._userSettings.gridSettings = {...this._userSettings.gridSettings, ...settings};
        this._saveUserSettings();
    }

    /**
     * Updates workspace grid settings
     * @param {Partial<GridSettings>} settings
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