/**
 * @typedef {Object} GridSettings
 * @property {boolean} enabled Whether the grid is enabled or not
 * @property {number} size The base size of the grid in pixels, 16 pixels per stud (1536 = 96 studs)
 * @property {number} divisions Number of subdivisions within each grid cell. If set to 1, no subdivisions are shown.
 * @property {number} mainColor The color of the main grid lines in hexadecimal (e.g. 0xffffff for white)
 * @property {number} subColor The color of the subdivision grid lines in hexadecimal (e.g. 0x9c9c9c for gray)
 */

/**
 * @typedef {Object} SerializedGridSettings
 * @property {boolean} enabled Whether the grid is enabled or not
 * @property {number} size The base size of the grid in pixels, 16 pixels per stud (1536 = 96 studs)
 * @property {number} divisions Number of subdivisions within each grid cell. If set to 1, no subdivisions are shown.
 * @property {string} mainColor The color of the main grid lines in hexadecimal
 * @property {string} subColor The color of the subdivision grid lines in hexadecimal
 */

/**
 * @typedef {Object} SerializedConfiguration
 * @property {String} defaultZoom The default zoom level
 * @property {number} snapToSize The size to snap to, in pixels, when moving objects
 * @property {SerializedGridSettings} gridSettings
 */
let SerializedConfiguration;
export { SerializedConfiguration };

/**
 * Configuration class that manages application-wide settings with support for
 * default values, user preferences, and workspace-specific settings.
 */
export class Configuration {
    static _instance = null;

    /**
     * Gets the singleton instance of Configuration
     * @returns {Configuration} The singleton instance
     */
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
         * @type {{gridSettings: GridSettings, defaultZoom: number, snapToSize: number}}
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
            defaultZoom: 0.5,
            snapToSize: 16
        };

        /**
         * User settings stored in localStorage
         * @type {{gridSettings: GridSettings, defaultZoom: number, snapToSize: number}}
         * @private
         */
        this._userSettings = {
            gridSettings: {},
            defaultZoom: null,
            snapToSize: null
        };

        /**
         * Workspace-specific settings
         * @type {{gridSettings: GridSettings, defaultZoom: number|null, snapToSize: number|null}}
         * @private
         */
        this._workspaceSettings = {
            gridSettings: {},
            defaultZoom: null,
            snapToSize: null
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
                defaultZoom: parsed.defaultZoom ?? null,
                snapToSize: parsed.snapToSize ?? null
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
     * Deserializes workspace settings from layout files
     * @param {SerializedConfiguration} data 
     */
    deserializeWorkspaceSettings(data) {
        this.clearWorkspaceSettings();
        if (data.hasOwnProperty('defaultZoom')) {
            this._workspaceSettings.defaultZoom = data.defaultZoom;
        }
        if (data.hasOwnProperty('snapToSize')) {
            this._workspaceSettings.snapToSize = data.snapToSize;
        }
        if (data.hasOwnProperty('gridSettings')) {
            if (data.gridSettings.hasOwnProperty('enabled')) {
                this._workspaceSettings.gridSettings.enabled = data.gridSettings.enabled;
            }
            if (data.gridSettings.hasOwnProperty('size')) {
                this._workspaceSettings.gridSettings.size = data.gridSettings.size;
            }
            if (data.gridSettings.hasOwnProperty('divisions')) {
                this._workspaceSettings.gridSettings.divisions = data.gridSettings.divisions;
            }
            if (data.gridSettings.hasOwnProperty('mainColor')) {
                this._workspaceSettings.gridSettings.mainColor = parseInt(data.gridSettings.mainColor.slice(1), 16);
            }
            if (data.gridSettings.hasOwnProperty('subColor')) {
                this._workspaceSettings.gridSettings.subColor = parseInt(data.gridSettings.subColor.slice(1), 16);
            }
        }
    }

    /**
     * Serializes workspace settings for storage in layout files
     * @returns {SerializedConfiguration} The serialized workspace settings
     */
    serializeWorkspaceSettings() {
        /** @type {SerializedConfiguration} */
        let settings = {};
        if (this._workspaceSettings.defaultZoom !== null) {
            settings.defaultZoom = this._workspaceSettings.defaultZoom;
        }
        if (this._workspaceSettings.snapToSize !== null) {
            settings.snapToSize = this._workspaceSettings.snapToSize;
        }
        if (Object.keys(this._workspaceSettings.gridSettings).length > 0) {
            settings.gridSettings = { ...this._workspaceSettings.gridSettings };
            if (settings.gridSettings.hasOwnProperty('mainColor')) {
                settings.gridSettings.mainColor = `#${settings.gridSettings.mainColor.toString(16)}`;
            }
            if (settings.gridSettings.hasOwnProperty('subColor')) {
                settings.gridSettings.subColor = `#${settings.gridSettings.subColor.toString(16)}`;
            }
        }
        return settings;
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
     * Gets the effective snap-to size in pixels
     * @returns {number}
     */
    get snapToSize() {
        return this._getEffectiveValue('snapToSize');
    }

    /**
     * Gets the user's snap-to size in pixels
     * @returns {number|null}
     */
    get userSnapToSize() {
        return this._userSettings.snapToSize;
    }

    /**
     * Sets the user's snap-to size in pixels
     * @param {number|null} value - Use null to clear the setting
     */
    set userSnapToSize(value) {
        this._userSettings.snapToSize = value;
        this._saveUserSettings();
    }

    /**
     * Gets the workspace snap-to size in pixels
     * @returns {number|null}
     */
    get workspaceSnapToSize() {
        return this._workspaceSettings.snapToSize;
    }

    /**
     * Sets the workspace snap-to size in pixels
     * @param {number|null} value - Use null to clear the setting
     */
    set workspaceSnapToSize(value) {
        this._workspaceSettings.snapToSize = value;
    }

    /**
     * Clears all workspace-specific settings
     */
    clearWorkspaceSettings() {
        this._workspaceSettings = {
            gridSettings: {},
            defaultZoom: null,
            snapToSize: null
        };
    }

    /**
     * 
     * @param {SerializedConfiguration} data 
     * @returns {boolean} Whether the data is valid
     */
    static validateImportData(data) {
        if (typeof data !== 'object') {
            return false;
        }
        if (data.hasOwnProperty('defaultZoom') && (typeof data.defaultZoom !== 'number' || data.defaultZoom < 0 || data.defaultZoom > 1)) {
            return false;
        }
        if (data.hasOwnProperty('snapToSize') && (typeof data.snapToSize !== 'number' || data.snapToSize < 0)) {
            return false;
        }
        if (data.hasOwnProperty('gridSettings')) {
            if (typeof data.gridSettings !== 'object') {
                return false;
            }
            if (data.gridSettings.hasOwnProperty('enabled') && typeof data.gridSettings.enabled !== 'boolean') {
                return false;
            }
            if (data.gridSettings.hasOwnProperty('size') && (typeof data.gridSettings.size !== 'number' || data.gridSettings.size < 128)) {
                return false;
            }
            if (data.gridSettings.hasOwnProperty('divisions') && (typeof data.gridSettings.divisions !== 'number' || data.gridSettings.divisions < 1)) {
                return false;
            }
            if (data.gridSettings.hasOwnProperty('mainColor') && (typeof data.gridSettings.mainColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.gridSettings.mainColor))) {
                return false;
            }
            if (data.gridSettings.hasOwnProperty('subColor') && (typeof data.gridSettings.subColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.gridSettings.subColor))) {
                return false;
            }
        }
        return true;
    }
}