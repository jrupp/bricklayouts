import { Component, HexToColorName } from '../model/component.js';
import { DataTypes, LayoutController } from './layoutController.js';

export class InventoryController {
    /** @type {InventoryController} */
    static _instance;

    /** @type {LayoutController} */
    #layoutController;

    #firstTime = true;

    #tabulator;

    #tableData = [];

    #loading = true;

    static getInstance() {
        if (!InventoryController._instance) {
            InventoryController._instance = new InventoryController();
        }
        return InventoryController._instance;
    }

    constructor() {
        if (InventoryController._instance !== undefined) {
            throw new Error('Use InventoryController.getInstance() instead of new.');
        }

        this.#layoutController = LayoutController.getInstance();

        document.getElementById('buttonPartInventory')?.addEventListener('click', this.openInventoryWindow.bind(this));
        document.getElementById('mobileButtonPartInventory')?.addEventListener('click', this.openInventoryWindow.bind(this));
        document.getElementById('exportPartInventory')?.addEventListener('click', this.exportCSV.bind(this));
        document.getElementById('printPartInventory')?.addEventListener('click', this.print.bind(this));
    }

    async openInventoryWindow() {
        this.#layoutController.hideFileMenu();
        if (this.#firstTime) {
            this.#firstTime = false;
            this.#loading = true;
            import('../tabulator_esm.min.mjs').then((module) => {
                this.#tabulator = new module.TabulatorFull('#partInventoryList', {
                    layout: 'fitColumns',
                    resizableColumnFit: true,
                    printAsHtml: true,
                    printStyled: true,
                    printHeader: '<h1>Part List</h1>',
                    printFooter: '<span style="float:right;">Generated with BrickLayouts</span>',
                    columnDefaults: {
                        headerSortTristate: true,
                    },
                    columns: [
                        { title: 'ID', field: 'id', width: 50, minWidth: 50, widthShrink: 1 },
                        { title: 'Name', field: 'name', widthGrow: 2, sorter: 'string' },
                        { title: 'Qty', field: 'quantity', width: 65, widthShrink: 1 },
                        { title: 'Color', field: 'color', widthGrow: 1 },
                        { title: 'Manufacturer', field: 'make', widthGrow: 2, resizable: false },
                        { title: 'Buy', field: 'buy', widthGrow: 1, resizable: false, visible: false, print: false, download: false },
                        { title: 'Unique ID', field: 'uniqueId', visible: false, print: false, download: false },
                    ],
                    index: 'uniqueId',
                    data: this.#tableData,
                    placeholder: () => {
                        if (this.#loading) {
                            return '<progress class="circle large"></progress>';
                        } else {
                            return "No parts. Go add some track or baseplates!";
                        }
                    }
                });
                this.#tabulator.on('tableBuilt', () => {
                    this.loadData();
                });
            });
        } else {
            this.loadData();
        }

        ui("#partInventoryDialog");
    }

    async loadData() {
        this.#loading = true;
        this.#tableData = [];
        this.#tabulator.clearData();
        this.#layoutController.layers.forEach(layer => {
            layer.children.forEach(/** @param {Component} child */(child) => {
                if (child instanceof Component && (child.baseData.type === DataTypes.TRACK || child.baseData.type === DataTypes.BASEPLATE)) {
                    const partNumber = child.baseData.partNumber ?? child.baseData.alias;
                    const colorCode = child.color?.toLowerCase() ?? '';
                    const uniqueId = `${partNumber}${colorCode}`;
                    const existing = this.#tableData.find(item => item.uniqueId == uniqueId);
                    if (existing) {
                        existing.quantity += 1;
                    } else {
                        let colorName = "N/A";
                        let make = this.#layoutController.trackData.makes[child.baseData.make ?? 0]?.name ?? "Unknown";
                        if (child.color !== undefined) {
                            colorName = HexToColorName[colorCode] ?? 'Unknown';
                            colorName = colorName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                        }
                        this.#tableData.push({ id: partNumber, name: child.baseData.name, quantity: 1, color: colorName, make: make, buy: '', uniqueId: uniqueId });
                    }
                }
            });
        });
        this.#tabulator.setData(this.#tableData);
        this.#loading = false;
        if (this.#tableData.length === 0) {
            this.#tabulator.redraw();
        }
    }

    exportCSV() {
        this.#tabulator.download("csv", "part-inventory.csv");
    }

    print() {
        this.#tabulator.print(false, true);
    }
}