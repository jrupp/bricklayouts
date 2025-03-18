/**
 * Configuration class that manages application-wide settings.
 * Implements the Singleton pattern to ensure only one instance exists.
 */
export class Configuration {
    /**
     * @type {Configuration}
     * @private
     */
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
         * Grid settings
         * @type {{
         *   size: number,
         *   divisions: number,
         *   mainColor: number,
         *   subColor: number
         * }}
         * @private
         */
        this._gridSettings = {
            size: 1536,
            divisions: 3,
            mainColor: 0xffffff,
            subColor: 0x9c9c9c
        };

        /**
         * Default zoom level
         * @type {number}
         * @private
         */
        this._defaultZoom = 0.5;

        // Load saved configuration from localStorage if available
        this._loadFromStorage();
    }

    /**
     * Loads configuration from localStorage
     * @private
     */
    _loadFromStorage() {
        const savedConfig = localStorage.getItem('bricklayouts-config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            this._gridSettings = {...this._gridSettings, ...parsed.gridSettings};
            this._defaultZoom = parsed.defaultZoom ?? this._defaultZoom;
        }
    }

    /**
     * Saves current configuration to localStorage
     * @private
     */
    _saveToStorage() {
        const config = {
            gridSettings: this._gridSettings,
            defaultZoom: this._defaultZoom
        };
        localStorage.setItem('bricklayouts-config', JSON.stringify(config));
    }

    /**
     * Gets the grid settings
     * @returns {{size: number, divisions: number, mainColor: number, subColor: number}}
     */
    get gridSettings() {
        return {...this._gridSettings};
    }

    /**
     * Updates grid settings
     * @param {{size?: number, divisions?: number, mainColor?: number, subColor?: number}} settings
     */
    updateGridSettings(settings) {
        this._gridSettings = {...this._gridSettings, ...settings};
        this._saveToStorage();
    }

    /**
     * Gets the default zoom level
     * @returns {number}
     */
    get defaultZoom() {
        return this._defaultZoom;
    }

    /**
     * Sets the default zoom level
     * @param {number} value
     */
    set defaultZoom(value) {
        this._defaultZoom = value;
        this._saveToStorage();
    }
}