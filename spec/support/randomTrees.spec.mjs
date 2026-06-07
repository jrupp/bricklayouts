import { LayoutController } from '../../src/controller/layoutController.js';
import { Component } from '../../src/model/component.js';
import { ComponentGroup } from '../../src/model/componentGroup.js';
import { LayoutLayer } from '../../src/model/layoutLayer.js';
import { Pose } from '../../src/model/pose.js';
import { UndoManager } from '../../src/controller/undoManager.js';
import { Application, Assets, path } from '../../src/pixi.mjs';

describe("Random Trees", function () {
  let layoutController;
  let treeTracks;

  beforeAll(async function () {
    if (!window.app) {
      const app = new Application();
      await app.init({ preference: 'webgl' });
      await Assets.init({ basePath: '../__spec__/img/', manifest: "../data/manifest.json" });
      await Assets.loadBundle('track');
      await Assets.load({ alias: path.toAbsolute('../data/manifest.json'), src: '../data/manifest.json' });
      window.app = app;
      window.assets = Assets;
    }

    const treeAssets = [
      { alias: 'aspenTree', src: '../img/aspentree.png' },
      { alias: 'birchTree', src: '../img/birchtree.png' },
      { alias: 'cypressTree', src: '../img/cypresstree.png' },
      { alias: 'mapleTree', src: '../img/mapletree.png' },
      { alias: 'oakTree', src: '../img/oaktree.png' },
      { alias: 'pineTreeSmall', src: '../img/pinetree-small.png' },
      { alias: 'shrubSmall', src: '../img/shrub-small.png' },
    ];
    for (const asset of treeAssets) {
      try {
        await Assets.load(asset);
      } catch (e) {
        // Ignore load failures in test environment
      }
    }
  });

  let savedRBush;

  beforeEach(function () {
    spyOn(LayoutController, 'selectComponent');

    savedRBush = window.RBush;
    window.RBush = function () {
      return {
        insert: jasmine.createSpy('insert'),
        remove: jasmine.createSpy('remove'),
        search: jasmine.createSpy('search').and.returnValue([]),
        load: jasmine.createSpy('load'),
        clear: jasmine.createSpy('clear')
      };
    };

    const mockUndoManager = {
      _entries: [],
      _suppressed: false,
      suppress() { this._suppressed = true; },
      unsuppress() { this._suppressed = false; },
      record(entry) {
        if (!this._suppressed) this._entries.push(entry);
      },
      get length() { return this._entries.length; },
      get entries() { return [...this._entries]; }
    };

    const layer = new LayoutLayer();
    layer.tree = {
      insert: jasmine.createSpy('insert'),
      remove: jasmine.createSpy('remove'),
      search: jasmine.createSpy('search').and.returnValue([]),
      load: jasmine.createSpy('load'),
      clear: jasmine.createSpy('clear')
    };

    layoutController = {
      trackData: {
        bundles: [{
          assets: [
            { alias: 'cypressTree', name: 'Cypress Tree', width: 128, height: 128, isTree: 1, category: 'structures', make: 0, type: 'track' },
            { alias: 'shrubSmall', name: 'Shrub', width: 128, height: 128, isTree: 1, category: 'structures', make: 0, type: 'track' },
            { alias: 'pineTreeSmall', name: 'Small Pine Tree', width: 144, height: 144, isTree: 1, category: 'structures', make: 0, type: 'track' },
            { alias: 'aspenTree', name: 'Aspen Tree', width: 192, height: 192, isTree: 1, category: 'structures', make: 0, type: 'track' },
            { alias: 'birchTree', name: 'Birch Tree', width: 288, height: 288, isTree: 1, category: 'structures', make: 0, type: 'track' },
            { alias: 'oakTree', name: 'Oak Tree', width: 352, height: 352, isTree: 1, category: 'structures', make: 0, type: 'track' },
            { alias: 'mapleTree', name: 'Maple Tree', width: 352, height: 352, isTree: 1, category: 'structures', make: 0, type: 'track' },
          ]
        }]
      },
      config: { snapToSize: 16 },
      app: { screen: { width: 800, height: 600 } },
      currentLayer: layer,
      undoManager: mockUndoManager,
      generateRandomTrees: LayoutController.prototype.generateRandomTrees
    };

    treeTracks = layoutController.trackData.bundles[0].assets.filter(a => a.isTree === 1);
  });

  afterEach(function () {
    window.RBush = savedRBush;
  });

  function getPlacedComponents(layer) {
    return layer.children.filter(c => c instanceof Component);
  }

  it("produces a permanent ComponentGroup with tree components", async function () {
    await layoutController.generateRandomTrees(32, 32, 1.0);

    const components = getPlacedComponents(layoutController.currentLayer);
    expect(components.length).toBeGreaterThan(0);

    const firstComp = components[0];
    expect(firstComp.group).toBeDefined();
    expect(firstComp.group).toBeInstanceOf(ComponentGroup);
    expect(firstComp.group.isTemporary).toBe(false);
  });

  it("only places tree components", async function () {
    await layoutController.generateRandomTrees(32, 32, 1.0);

    const components = getPlacedComponents(layoutController.currentLayer);
    const treeAliases = treeTracks.map(t => t.alias);
    for (const comp of components) {
      expect(treeAliases).toContain(comp.baseData.alias);
    }
  });

  it("keeps all tree positions within bounds", async function () {
    const widthStuds = 40;
    const heightStuds = 40;
    await layoutController.generateRandomTrees(widthStuds, heightStuds, 1.0);

    const pixelWidth = widthStuds * 16;
    const pixelHeight = heightStuds * 16;
    const snapToSize = 16;
    const screenCenter = { x: 400, y: 300 };
    const originX = Math.round((screenCenter.x - pixelWidth / 2) / snapToSize) * snapToSize;
    const originY = Math.round((screenCenter.y - pixelHeight / 2) / snapToSize) * snapToSize;

    const components = getPlacedComponents(layoutController.currentLayer);
    expect(components.length).toBeGreaterThan(0);

    for (const comp of components) {
      const halfW = comp.baseData.width / 2;
      const halfH = comp.baseData.height / 2;
      expect(comp.position.x - halfW).not.toBeLessThan(originX);
      expect(comp.position.y - halfH).not.toBeLessThan(originY);
      expect(comp.position.x + halfW).not.toBeGreaterThan(originX + pixelWidth);
      expect(comp.position.y + halfH).not.toBeGreaterThan(originY + pixelHeight);
    }
  });

  it("snaps all positions to the grid", async function () {
    await layoutController.generateRandomTrees(32, 32, 1.0);

    const components = getPlacedComponents(layoutController.currentLayer);
    expect(components.length).toBeGreaterThan(0);

    for (const comp of components) {
      const offset = (comp.baseData.width / 16) % 2 === 1 ? 8 : 0;
      expect((comp.position.x - offset) % 16).toBe(0);
      expect((comp.position.y - offset) % 16).toBe(0);
    }
  });

  it("records exactly one undo entry", async function () {
    expect(layoutController.undoManager.length).toBe(0);

    await layoutController.generateRandomTrees(32, 32, 1.0);

    expect(layoutController.undoManager.length).toBe(1);
    const entry = layoutController.undoManager.entries[0];
    expect(entry.type).toBe('duplicate_group');
    expect(entry.data.componentUuids.length).toBeGreaterThan(0);
  });

  it("places no trees and records no undo when area is too small", async function () {
    await layoutController.generateRandomTrees(1, 1, 1.0);

    const components = getPlacedComponents(layoutController.currentLayer);
    expect(components.length).toBe(0);
    expect(layoutController.undoManager.length).toBe(0);
  });

  it("unsuppresses undoManager even when component creation throws", async function () {
    spyOn(layoutController.currentLayer, 'addChild').and.throwError('simulated failure');

    await expectAsync(layoutController.generateRandomTrees(32, 32, 1.0)).toBeRejectedWithError('simulated failure');

    expect(layoutController.undoManager._suppressed).toBe(false);
  });
});
