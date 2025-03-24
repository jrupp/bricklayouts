import { Pane, TabPageApi, ButtonApi } from '../tweakpane.js';
import { Configuration } from '../model/configuration.js';
import { LayoutController } from './layoutController.js';

export class ConfigurationController {
    /** @type {Configuration} */
    #config;
    /** @type {Array<HTMLElement>} */
    #tabButtons;
    /** @type {Array<HTMLElement>} */
    #typeButtons;
    /** @type {Array<HTMLElement>} */
    #tabPanels;
    /** @type {LayoutController} */
    #layoutController;

    constructor() {
        this.#config = Configuration.getInstance();
        this.#tabButtons = document.querySelectorAll('.tab-button');
        this.#typeButtons = document.querySelectorAll('.typeButton');
        this.#tabPanels = document.querySelectorAll('.tab-panel');
        this.#layoutController = LayoutController.getInstance();

        document.getElementById('buttonConfig').addEventListener('click', () => {
            this.#layoutController.hideFileMenu();
            document.getElementById('configurationEditor').classList.toggle('hidden');
            // Reload the data into the UI, in case something has changed
            const configType = this.#tabPanels[0].getAttribute('data-type');
            this.#switchType(configType);
        });
        document.getElementById('configurationEditorClose').addEventListener('click', () => {
            document.getElementById('configurationEditor').classList.add('hidden');
        });
        document.getElementById('configurationEditorSave').addEventListener('click', () => {
            document.getElementById('configurationEditor').classList.add('hidden');
        });
        document.getElementById('configurationEditorCancel').addEventListener('click', () => {
            document.getElementById('configurationEditor').classList.add('hidden');
        });

        this.#tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                this.#switchTab(tabId);
            });
        });

        this.#typeButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const type = button.getAttribute('data-type');
                this.#switchType(type);
            });
        });

        this.#switchTab('general');
        this.#switchType('user');

        document.getElementById('defaultZoom').addEventListener('input', (ev) => {
            // TODO: Check if the value is valid
            const newZoom = parseFloat(ev.target.value);
            if (ev.target.parentElement.getAttribute('data-type') === 'user') {
                this.#config.userDefaultZoom = newZoom;
            } else {
                this.#config.workspaceDefaultZoom = newZoom;
            }
            this.#layoutController.workspace.scale.set(newZoom);
            this.#layoutController.drawGrid();
        });

        document.getElementById('gridEnabled').addEventListener('change', (ev) => {
            const newSetting = { enabled: ev.target.checked };
            if (ev.target.parentElement.parentElement.getAttribute('data-type') === 'user') {
                this.#config.updateUserGridSettings(newSetting);
            } else {
                this.#config.updateWorkspaceGridSettings(newSetting);
            }
            this.#layoutController.drawGrid();
        });

        document.getElementById('gridSize').addEventListener('input', (ev) => {
            // TODO: Check if the value is valid
            const newSetting = { size: parseInt(ev.target.value) * 16 };
            if (ev.target.parentElement.parentElement.getAttribute('data-type') === 'user') {
                this.#config.updateUserGridSettings(newSetting);
            } else {
                this.#config.updateWorkspaceGridSettings(newSetting);
            }
            this.#layoutController.drawGrid();
        });

        document.getElementById('gridSubdivisions').addEventListener('input', (ev) => {
            // TODO: Check if the value is valid
            const newSetting = { divisions: parseInt(ev.target.value) };
            if (ev.target.parentElement.getAttribute('data-type') === 'user') {
                this.#config.updateUserGridSettings(newSetting);
            } else {
                this.#config.updateWorkspaceGridSettings(newSetting);
            }
            this.#layoutController.drawGrid();
        });

        document.getElementById('gridMainColor').addEventListener('change', (ev) => {
            const color = parseInt(ev.target.value.replace('#', ''), 16);
            if (ev.target.parentElement.getAttribute('data-type') === 'user') {
                this.#config.updateUserGridSettings({ mainColor: color });
            } else {
                this.#config.updateWorkspaceGridSettings({ mainColor: color });
            }
            this.#layoutController.drawGrid();
        });

        document.getElementById('gridSubColor').addEventListener('change', (ev) => {
            const color = parseInt(ev.target.value.replace('#', ''), 16);
            if (ev.target.parentElement.getAttribute('data-type') === 'user') {
                this.#config.updateUserGridSettings({ subColor: color });
            } else {
                this.#config.updateWorkspaceGridSettings({ subColor: color });
            }
            this.#layoutController.drawGrid();
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

    /**
     * 
     * @private
     * @param {'general'|'appearance'} tabId 
     */
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
     * Switches the configuration type between user and workspace
     * @private
     * @param {'user'|'workspace'} configType 
     */
    #switchType(configType) {
        this.#typeButtons.forEach((button) => {
            button.classList.remove('active');
        });

        document.querySelector(`.typeButton[data-type="${configType}"]`).classList.add('active');
        this.#tabPanels.forEach((panel) => {
            panel.setAttribute('data-type', configType);
        });

        const gridSettings = configType === 'user' ? this.#config.userGridSettings : this.#config.workspaceGridSettings;
        const zoom = configType === 'user' ? this.#config.userDefaultZoom : this.#config.workspaceDefaultZoom;
        let mainColorValue = gridSettings.mainColor ?? this.#config._defaults.gridSettings.mainColor;
        let subColorValue = gridSettings.subColor ?? this.#config._defaults.gridSettings.subColor;
        document.getElementById('defaultZoom').value = zoom ?? this.#config._defaults.defaultZoom;
        document.getElementById('gridEnabled').checked = gridSettings.enabled ?? this.#config._defaults.gridSettings.enabled;
        document.getElementById('gridSize').value = (gridSettings.size ?? this.#config._defaults.gridSettings.size) / 16;
        document.getElementById('gridSubdivisions').value = gridSettings.divisions ?? this.#config._defaults.gridSettings.divisions;
        document.getElementById('gridMainColor').value = `#${mainColorValue.toString(16).padStart(6, '0')}`;
        document.getElementById('gridSubColor').value = `#${subColorValue.toString(16).padStart(6, '0')}`;
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