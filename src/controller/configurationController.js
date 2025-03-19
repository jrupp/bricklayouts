import { Pane, TabPageApi } from '../tweakpane.js';
import { Configuration } from '../model/configuration.js';

export class ConfigurationController {
    /** @type {Configuration} */
    #config;
    /** @type {Pane} */
    #pane;
    /** @type {HTMLElement} */
    #container;

    constructor() {
        this.#config = Configuration.getInstance();
        this.#container = document.getElementById('configurationEditorContent');

        // Create the main pane
        this.#pane = new Pane({
            container: this.#container
        });

        // Create tabs for user and workspace settings
        const tabs = this.#pane.addTab({
            pages: [{
                title: 'User'
            },
            {
                title: 'Workspace'
            }]
        });

        const userTab = tabs.pages[0];

        const workspaceTab = tabs.pages[1];

        // Add grid settings to both tabs
        this.#setupGridSettings(userTab, 'user');
        this.#setupGridSettings(workspaceTab, 'workspace');

        // Add zoom settings to both tabs
        this.#setupZoomSettings(userTab, 'user');
        this.#setupZoomSettings(workspaceTab, 'workspace');

        // Add clear button to workspace tab
        workspaceTab.addButton({
            title: 'Clear All Workspace Settings',
            label: 'clear'
        }).on('click', () => {
            this.#config.clearWorkspaceSettings();
            this.#refreshWorkspaceInputs();
        });
    }

    /**
     * Sets up the grid settings controls for a tab
     * @private
     * @param {TabPageApi} tab 
     * @param {'user'|'workspace'} type
     */
    #setupGridSettings(tab, type) {
        const folder = tab.addFolder({
            title: 'Grid Settings'
        });

        const isUser = type === 'user';
        const settings = isUser ? this.#config.userGridSettings : this.#config.workspaceGridSettings;

        // Create a params object for the inputs
        const params = {
            size: settings.size ?? 0.5,
            divisions: settings.divisions ?? null,
            mainColor: settings.mainColor ? `#${settings.mainColor.toString(16).padStart(6, '0')}` : null,
            subColor: settings.subColor ? `#${settings.subColor.toString(16).padStart(6, '0')}` : null
        };

        // Add inputs
        folder.addBinding(params, 'size', {
            label: 'Size',
            min: 256,
            max: 3072,
            step: 256,
        }).on('change', (ev) => {
            if (isUser) {
                this.#config.updateUserGridSettings({ size: ev.value });
            } else {
                this.#config.updateWorkspaceGridSettings({ size: ev.value });
            }
        });
/*
        folder.addInput(params, 'divisions', {
            label: 'Divisions',
            min: 1,
            max: 8,
            step: 1
        }).on('change', (ev) => {
            if (isUser) {
                this.#config.updateUserGridSettings({ divisions: ev.value });
            } else {
                this.#config.updateWorkspaceGridSettings({ divisions: ev.value });
            }
        });

        folder.addInput(params, 'mainColor', {
            label: 'Main Color',
            view: 'color',
            color: { type: 'float' }
        }).on('change', (ev) => {
            const color = parseInt(ev.value.replace('#', ''), 16);
            if (isUser) {
                this.#config.updateUserGridSettings({ mainColor: color });
            } else {
                this.#config.updateWorkspaceGridSettings({ mainColor: color });
            }
        });

        folder.addInput(params, 'subColor', {
            label: 'Sub Color',
            view: 'color',
            color: { type: 'float' }
        }).on('change', (ev) => {
            const color = parseInt(ev.value.replace('#', ''), 16);
            if (isUser) {
                this.#config.updateUserGridSettings({ subColor: color });
            } else {
                this.#config.updateWorkspaceGridSettings({ subColor: color });
            }
        });*/
    }

    /**
     * Sets up the zoom settings controls for a tab
     * @private
     * @param {TabPageApi} tab 
     * @param {'user'|'workspace'} type
     */
    #setupZoomSettings(tab, type) {
        const isUser = type === 'user';
        const zoom = isUser ? this.#config.userDefaultZoom : this.#config.workspaceDefaultZoom;

        const params = {
            defaultZoom: zoom ?? 0.5
        };

        tab.addBinding(params, 'defaultZoom', {
            label: 'Default Zoom',
            min: 0.1,
            max: 2.0,
            step: 0.1
        }).on('change', (ev) => {
            if (isUser) {
                this.#config.userDefaultZoom = ev.value;
            } else {
                this.#config.workspaceDefaultZoom = ev.value;
            }
        });
    }

    /**
     * Refreshes all workspace input values
     * @private
     */
    #refreshWorkspaceInputs() {
        // Re-create the pane to refresh all values
        this.#pane.dispose();
        this.#container.innerHTML = '';
        this.constructor();
    }
}