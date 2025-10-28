import { Configuration } from '../model/configuration.js';
import { LayoutController } from './layoutController.js';
import { getOptionIndexByValue } from '../utils/utils.js';

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
    /** @type {Number} */
    #snapToWhatDefaultIndex;

    constructor() {
        this.#config = Configuration.getInstance();
        this.#tabButtons = document.querySelectorAll('.config-tab');
        this.#typeButtons = document.querySelectorAll('.config-type');
        this.#tabPanels = document.querySelectorAll('.config-page'); // .tab-panel
        this.#layoutController = LayoutController.getInstance();

        document.getElementById('buttonConfig').addEventListener('click', () => {
            this.#layoutController.hideFileMenu();
            this.#layoutController._hideSelectionToolbar();
            document.getElementById('configurationEditor').classList.toggle('active');
            // Reload the data into the UI, in case something has changed
            const configType = this.#tabPanels[0].getAttribute('data-type');
            this.#switchType(configType);
            window.ui();
        });
        document.getElementById('configurationEditorClose').addEventListener('click', () => {
            document.getElementById('configurationEditor').classList.remove('active');
            this.#layoutController._showSelectionToolbar();
        });
        document.getElementById('configurationEditorSave').addEventListener('click', () => {
            document.getElementById('configurationEditor').classList.remove('active');
            this.#layoutController._showSelectionToolbar();
        });
        document.getElementById('configurationEditorCancel').addEventListener('click', () => {
            document.getElementById('configurationEditor').classList.remove('active');
            this.#layoutController._showSelectionToolbar();
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
            if (ev.target.closest('[data-type]').getAttribute('data-type') === 'user') {
                this.#config.userDefaultZoom = newZoom;
            } else {
                this.#config.workspaceDefaultZoom = newZoom;
            }
            this.#layoutController.workspace.scale.set(newZoom);
            this.#layoutController.drawGrid();
        });

        document.getElementById('gridEnabled').addEventListener('change', (ev) => {
            const newSetting = { enabled: ev.target.checked };
            if (ev.target.parentElement.parentElement.parentElement.getAttribute('data-type') === 'user') {
                this.#config.updateUserGridSettings(newSetting);
            } else {
                this.#config.updateWorkspaceGridSettings(newSetting);
            }
            this.#layoutController.drawGrid();
        });

        document.getElementById('gridSize').addEventListener('input', (ev) => {
            // TODO: Check if the value is valid
            const newSetting = { size: parseInt(ev.target.value) * 16 };
            if (ev.target.parentElement.parentElement.parentElement.getAttribute('data-type') === 'user') {
                this.#config.updateUserGridSettings(newSetting);
            } else {
                this.#config.updateWorkspaceGridSettings(newSetting);
            }
            this.#layoutController.drawGrid();
        });

        document.getElementById('gridSubdivisions').addEventListener('input', (ev) => {
            // TODO: Check if the value is valid
            const newSetting = { divisions: parseInt(ev.target.value) };
            if (ev.target.parentElement.parentElement.parentElement.getAttribute('data-type') === 'user') {
                this.#config.updateUserGridSettings(newSetting);
            } else {
                this.#config.updateWorkspaceGridSettings(newSetting);
            }
            this.#layoutController.drawGrid();
        });

        document.getElementById('gridMainColor').addEventListener('change', (ev) => {
            const color = parseInt(ev.target.value.replace('#', ''), 16);
            document.querySelector('#colorfield>i').style.setProperty('--gridcolor', ev.currentTarget.value);
            if (ev.target.parentElement.parentElement.getAttribute('data-type') === 'user') {
                this.#config.updateUserGridSettings({ mainColor: color });
            } else {
                this.#config.updateWorkspaceGridSettings({ mainColor: color });
            }
            this.#layoutController.drawGrid();
        });

        document.getElementById('gridSubColor').addEventListener('change', (ev) => {
            const color = parseInt(ev.target.value.replace('#', ''), 16);
            document.querySelector('#subcolorfield>i').style.setProperty('--gridsubcolor', ev.currentTarget.value);
            if (ev.target.parentElement.parentElement.getAttribute('data-type') === 'user') {
                this.#config.updateUserGridSettings({ subColor: color });
            } else {
                this.#config.updateWorkspaceGridSettings({ subColor: color });
            }
            this.#layoutController.drawGrid();
        });

        document.getElementById('snapToWhat').addEventListener('change', (ev) => {
            const snapToSize = parseInt(ev.target.options[ev.target.selectedIndex].value);
            if (ev.target.closest('[data-type]').getAttribute('data-type') === 'user') {
                this.#config.userSnapToSize = snapToSize;
            } else {
                this.#config.workspaceSnapToSize = snapToSize;
            }
        });
        this.#snapToWhatDefaultIndex = getOptionIndexByValue('snapToWhat', this.#config._defaults.snapToSize.toString());

        document.getElementById('backgroundColor').addEventListener('change', (ev) => {
            const color = parseInt(ev.target.value.replace('#', ''), 16);
            document.querySelector('#bgcolorfield>i').style.setProperty('--background-color', ev.currentTarget.value);
            if (ev.target.parentElement.parentElement.getAttribute('data-type') === 'user') {
                this.#config.userBackgroundColor = color;
            } else {
                this.#config.workspaceBackgroundColor = color;
            }
            this.#layoutController.checkBackgroundColorChange();
        });

        document.getElementById('resetbgcolor').addEventListener('click', (ev) => {
            let configType = ev.target.closest('[data-type]').getAttribute('data-type');
            if (configType === 'user') {
                this.#config.userBackgroundColor = null;
            } else {
                this.#config.workspaceBackgroundColor = null;
            }
            this.#switchType(configType);
            this.#layoutController.checkBackgroundColorChange();
        });
    }

    /**
     * 
     * @private
     * @param {'general'|'appearance'|'grid'} tabId 
     */
    #switchTab(tabId) {
        this.#tabButtons.forEach((button) => {
            button.classList.remove('fill');
        });
        this.#tabPanels.forEach((panel) => {
            panel.classList.remove('active');
        });

        document.querySelectorAll(`.config-tab:not([data-tab="${tabId}"])`).forEach((tab) => tab.classList.add('fill'));
        document.querySelector(`.config-page[data-tab="${tabId}"]`).classList.add('active');
        window.ui();
    }

    /**
     * Switches the configuration type between user and workspace
     * @private
     * @param {'user'|'workspace'} configType 
     */
    #switchType(configType) {
        this.#typeButtons.forEach((button) => {
            button.classList.remove('fill');
        });

        document.querySelector(`.config-type:not([data-type="${configType}"])`).classList.add('fill');
        this.#tabPanels.forEach((panel) => {
            panel.setAttribute('data-type', configType);
        });

        const gridSettings = configType === 'user' ? this.#config.userGridSettings : this.#config.workspaceGridSettings;
        const zoom = configType === 'user' ? this.#config.userDefaultZoom : this.#config.workspaceDefaultZoom;
        const snapToSize = configType === 'user' ? this.#config.userSnapToSize : this.#config.workspaceSnapToSize;
        let mainColorValue = gridSettings.mainColor ?? this.#config._defaults.gridSettings.mainColor;
        let subColorValue = gridSettings.subColor ?? this.#config._defaults.gridSettings.subColor;
        document.getElementById('defaultZoom').value = zoom ?? this.#config._defaults.defaultZoom;
        document.getElementById('gridEnabled').checked = gridSettings.enabled ?? this.#config._defaults.gridSettings.enabled;
        document.getElementById('gridSize').value = (gridSettings.size ?? this.#config._defaults.gridSettings.size) / 16;
        document.getElementById('gridSubdivisions').value = gridSettings.divisions ?? this.#config._defaults.gridSettings.divisions;
        let gridMainColor = document.getElementById('gridMainColor');
        gridMainColor.value = `#${mainColorValue.toString(16).padStart(6, '0')}`;
        gridMainColor.nextElementSibling.value = `#${mainColorValue.toString(16).padStart(6, '0')}`;
        document.querySelector('#colorfield>i').style.setProperty('--gridcolor', `#${mainColorValue.toString(16).padStart(6, '0')}`);
        let gridSubColor = document.getElementById('gridSubColor');
        gridSubColor.value = `#${subColorValue.toString(16).padStart(6, '0')}`;
        gridSubColor.nextElementSibling.value = `#${subColorValue.toString(16).padStart(6, '0')}`;
        document.querySelector('#subcolorfield>i').style.setProperty('--gridsubcolor', `#${subColorValue.toString(16).padStart(6, '0')}`);
        document.getElementById('snapToWhat').selectedIndex = getOptionIndexByValue(
            'snapToWhat',
            (snapToSize ?? this.#config._defaults.snapToSize).toString(),
            this.#snapToWhatDefaultIndex
        );
        let backgroundColorValue = configType === 'user' ? this.#config.userBackgroundColor : this.#config.workspaceBackgroundColor;
        let backgroundColorHex = (backgroundColorValue ?? this.#config._defaults.backgroundColor).toString(16).padStart(6, '0');
        let backgroundColor = document.getElementById('backgroundColor');
        backgroundColor.value = `#${backgroundColorHex}`;
        backgroundColor.nextElementSibling.value = `#${backgroundColorHex}`;
        document.querySelector('#bgcolorfield>i').style.setProperty('--background-color', `#${backgroundColorHex}`);
    }
}