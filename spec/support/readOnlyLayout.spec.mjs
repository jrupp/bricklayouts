/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import { LayoutController } from '../../src/controller/layoutController.js';
import { Assets, Texture } from '../../src/pixi.mjs';

/**
 * A read-only page (a shared or public layout) loads the assets its layout
 * places, and nothing else, before the loading overlay comes off.
 */
describe('LayoutController._loadReadOnlyLayout', function () {
  let controller;
  let layoutData;
  let calls;

  const layoutWith = (...types) => ({
    version: 2,
    x: 0,
    y: 0,
    zoom: 1,
    layers: [{ name: 'L', components: types.map((type) => ({ type, pose: {} })) }],
    config: {},
  });

  beforeEach(function () {
    calls = [];
    controller = Object.create(LayoutController.prototype);
    controller.trackData = { bundles: [{ assets: [{ alias: 'readOnlySpecTrack' }] }] };
    layoutData = layoutWith('readOnlySpecTrack', 'mocPlaced');
    layoutData.mocs = [
      { alias: 'mocPlaced', name: 'Placed', src: 'https://example.com/placed.png' },
      { alias: 'mocUnused', name: 'Unused', src: 'https://example.com/unused.png' },
    ];
    spyOn(controller, '_fetchReadOnlyLayoutData')
      .and.callFake(async () => ({ layoutData, layoutName: 'Club layout', source: 'public' }));
    spyOn(controller, '_loadLayoutMocs').and.callFake(async (mocs) => {
      calls.push(['register', mocs.map((moc) => moc.alias)]);
    });
    spyOn(Assets, 'load').and.callFake(async (aliases) => {
      calls.push(['load', aliases]);
    });
    spyOn(controller, '_importLayout').and.resolveTo();
    spyOn(controller, 'setLayoutName');
  });

  afterEach(function () {
    Assets.cache.remove('mocPlaced');
  });

  it('registers the MOCs the layout places before loading its assets', async function () {
    await expectAsync(controller._loadReadOnlyLayout()).toBeResolvedTo(true);

    expect(calls).toEqual([
      ['register', ['mocPlaced']],
      ['load', ['readOnlySpecTrack', 'mocPlaced']],
    ]);
    expect(controller._importLayout).toHaveBeenCalledOnceWith(layoutData);
    expect(controller.setLayoutName).toHaveBeenCalledOnceWith('Club layout');
  });

  it('never registers or downloads a MOC the layout does not place', async function () {
    await controller._loadReadOnlyLayout();

    const imported = controller._importLayout.calls.mostRecent().args[0];
    expect(imported.mocs.map((moc) => moc.alias)).toEqual(['mocPlaced']);
    expect(calls.flatMap(([, aliases]) => aliases)).not.toContain('mocUnused');
  });

  it('does not ask Assets for a MOC that arrived embedded in the layout', async function () {
    // An embedded texture goes straight into the cache under an alias Assets
    // cannot resolve, so loading it would fail.
    controller._loadLayoutMocs.and.callFake(async () => {
      Assets.cache.set('mocPlaced', Texture.EMPTY);
    });

    await expectAsync(controller._loadReadOnlyLayout()).toBeResolvedTo(true);

    expect(Assets.load).toHaveBeenCalledOnceWith(['readOnlySpecTrack']);
  });

  it('loads a layout without MOCs exactly as before', async function () {
    layoutData = layoutWith('readOnlySpecTrack');

    await expectAsync(controller._loadReadOnlyLayout()).toBeResolvedTo(true);

    expect(controller._loadLayoutMocs).not.toHaveBeenCalled();
    expect(Assets.load).toHaveBeenCalledOnceWith(['readOnlySpecTrack']);
  });

  it('reports a missing layout', async function () {
    controller._fetchReadOnlyLayoutData.and.resolveTo(null);

    await expectAsync(controller._loadReadOnlyLayout()).toBeResolvedTo(false);
    expect(controller._importLayout).not.toHaveBeenCalled();
  });

  it('reports a layout whose assets cannot be loaded', async function () {
    Assets.load.and.rejectWith(new Error('offline'));
    spyOn(console, 'error');

    await expectAsync(controller._loadReadOnlyLayout()).toBeResolvedTo(false);
    expect(controller._importLayout).not.toHaveBeenCalled();
  });
});
