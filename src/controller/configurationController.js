import { Pane, TabPageApi, ButtonApi } from '../tweakpane.js';
import { Configuration } from '../model/configuration.js';

export class ConfigurationController {
    /** @type {Configuration} */
    #config;
    /** @type {Array<HTMLElement>} */
    #tabButtons;
    /** @type {Array<HTMLElement>} */
    #tabPanels;

    constructor() {
        this.#config = Configuration.getInstance();
        this.#tabButtons = document.querySelectorAll('.tab-button');
        this.#tabPanels = document.querySelectorAll('.tab-panel');

        this.#tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                this.#switchTab(tabId);
            });
        });

        // Create tabs for user and workspace settings
        /*
        const tabs = this.#pane.addTab({
            pages: [{
                title: 'User'
            },
            {
                title: 'Workspace'
            }]
        });*/

        // Add clear button to workspace tab
        /*
        workspaceTab.addButton({
            title: 'Clear All Workspace Settings',
            label: 'clear'
        }).on('click', () => {
            this.#config.clearWorkspaceSettings();
            this.#refreshWorkspaceInputs();
        });*/
    }

    #switchTab(tabId) {
        this.#tabButtons.forEach((button) => {
            button.classList.remove('active');
        });
        this.#tabPanels.forEach((panel) => {
            panel.classList.remove('active');
        });

        document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
        document.querySelector(`.tab-panel[data-tab="${tabId}"]`).classList.add('active');
    }

    /**
     * Sets up the grid settings controls for a tab
     * @private
     * @param {TabPageApi} tab 
     * @param {'user'|'workspace'} type
     */
    #setupGridSettings(tab, type) {
        const isUser = type === 'user';
        const settings = isUser ? this.#config.userGridSettings : this.#config.workspaceGridSettings;

        const folder = tab.addFolder({
            title: 'Grid Settings',
            hidden: !isUser
        });

        // Create a params object for the inputs
        let mainColorValue = settings.mainColor ?? this.#config._defaults.gridSettings.mainColor;
        let subColorValue = settings.subColor ?? this.#config._defaults.gridSettings.subColor;
        const params = {
            size: settings.size ?? this.#config._defaults.gridSettings.size,
            divisions: settings.divisions ?? this.#config._defaults.gridSettings.divisions,
            mainColor: `#${mainColorValue.toString(16).padStart(6, '0')}`,
            subColor: `#${subColorValue.toString(16).padStart(6, '0')}`
        };

        // Add inputs
        folder.addBinding(params, 'size', {
            label: '<ul>Size</ul>',
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

        folder.addBinding(params, 'divisions', {
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

        folder.addBinding(params, 'mainColor', {
            label: '',
            view: 'color'
        }).on('change', (ev) => {
            const color = parseInt(ev.value.replace('#', ''), 16);
            if (isUser) {
                this.#config.updateUserGridSettings({ mainColor: color });
            } else {
                this.#config.updateWorkspaceGridSettings({ mainColor: color });
            }
        });

        folder.addBinding(params, 'subColor', {
            label: 'Sub Color',
            view: 'color'
        }).on('change', (ev) => {
            const color = parseInt(ev.value.replace('#', ''), 16);
            if (isUser) {
                this.#config.updateUserGridSettings({ subColor: color });
            } else {
                this.#config.updateWorkspaceGridSettings({ subColor: color });
            }
        });

        if (!isUser) {
            /** @type {ButtonApi} */
            const btn = tab.addButton({
                index: 0,
                label: 'Grid Settings',
                title: 'Override'
            });
            btn.on('click', (ev) => {
                folder.hidden = !folder.hidden;
                if (folder.hidden) {
                    ev.target.title = "Override";
                } else {
                    ev.target.title = "Inherit";
                }
            });
        }
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
        //this.#pane.dispose();
        //this.#container.innerHTML = '';
        //this.constructor();
    }
}