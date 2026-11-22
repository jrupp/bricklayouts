/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import {
  validateMocForCloud,
  MAX_MOC_NAME_LENGTH,
} from '../../src/utils/mocValidation.js';
import { MAX_DECODED_PIXELS } from '../../src/utils/imageValidation.js';
import { PolarVector } from '../../src/model/polarVector.js';

describe('validateMocForCloud', function () {
  let categories;
  let texture;

  function baseTrack(overrides = {}) {
    return {
      alias: 'myMoc',
      name: 'My MOC',
      category: 'structures',
      scale: 1,
      type: 'track',
      ...overrides,
    };
  }

  beforeEach(function () {
    categories = new Map([
      ['structures', 'Structures'],
      ['9V', '9V'],
      ['mine', 'My MOCs'],
    ]);
    texture = { width: 64, height: 64 };
  });

  it('accepts a well-formed MOC', function () {
    expect(validateMocForCloud(baseTrack(), { categories, texture }))
      .toEqual({ ok: true });
  });

  it('accepts a MOC with a valid onbp and connections', function () {
    const track = baseTrack({
      onbp: 0x237841,
      connections: [{ type: 0, next: 0, vector: new PolarVector(1, 0, 0) }],
    });
    expect(validateMocForCloud(track, { categories, texture })).toEqual({ ok: true });
  });

  it('rejects a missing track', function () {
    expect(validateMocForCloud(null, { categories, texture }).ok).toBeFalse();
  });

  it('rejects an over-long name', function () {
    const track = baseTrack({ name: 'a'.repeat(MAX_MOC_NAME_LENGTH + 1) });
    expect(validateMocForCloud(track, { categories, texture }).ok).toBeFalse();
  });

  it('accepts a name exactly at the length limit', function () {
    const track = baseTrack({ name: 'a'.repeat(MAX_MOC_NAME_LENGTH) });
    expect(validateMocForCloud(track, { categories, texture }).ok).toBeTrue();
  });

  it('rejects an empty or whitespace-only name', function () {
    expect(validateMocForCloud(baseTrack({ name: '' }), { categories, texture }).ok).toBeFalse();
    expect(validateMocForCloud(baseTrack({ name: '   ' }), { categories, texture }).ok).toBeFalse();
  });

  it('rejects a non-string name', function () {
    expect(validateMocForCloud(baseTrack({ name: 5 }), { categories, texture }).ok).toBeFalse();
  });

  it('rejects an unknown category', function () {
    expect(validateMocForCloud(baseTrack({ category: 'nope' }), { categories, texture }).ok)
      .toBeFalse();
  });

  it('rejects scale that is NaN, zero, negative, infinite, or a string', function () {
    expect(validateMocForCloud(baseTrack({ scale: NaN }), { categories, texture }).ok).toBeFalse();
    expect(validateMocForCloud(baseTrack({ scale: 0 }), { categories, texture }).ok).toBeFalse();
    expect(validateMocForCloud(baseTrack({ scale: -1 }), { categories, texture }).ok).toBeFalse();
    expect(validateMocForCloud(baseTrack({ scale: Infinity }), { categories, texture }).ok)
      .toBeFalse();
    expect(validateMocForCloud(baseTrack({ scale: '1' }), { categories, texture }).ok).toBeFalse();
  });

  it('accepts any positive scale, including one a small image at a large size needs', function () {
    // A 100x100 image sized to 20x20 studs (320px) has a scale of 3.2.
    expect(validateMocForCloud(baseTrack({ scale: 3.2 }), { categories, texture }).ok)
      .toBeTrue();
    expect(validateMocForCloud(baseTrack({ scale: 0.0001 }), { categories, texture }).ok)
      .toBeTrue();
  });

  it('rejects an unknown type', function () {
    expect(validateMocForCloud(baseTrack({ type: 'bogus' }), { categories, texture }).ok)
      .toBeFalse();
  });

  it('rejects an onbp out of range or non-integer', function () {
    expect(validateMocForCloud(baseTrack({ onbp: -1 }), { categories, texture }).ok).toBeFalse();
    expect(validateMocForCloud(baseTrack({ onbp: 0x1000000 }), { categories, texture }).ok)
      .toBeFalse();
    expect(validateMocForCloud(baseTrack({ onbp: 1.5 }), { categories, texture }).ok).toBeFalse();
  });

  it('rejects malformed connections', function () {
    expect(validateMocForCloud(baseTrack({ connections: 'x' }), { categories, texture }).ok)
      .toBeFalse();
    expect(validateMocForCloud(
      baseTrack({ connections: [{ type: 0, next: 1, vector: { magnitude: 1 } }] }),
      { categories, texture }
    ).ok).toBeFalse();
    expect(validateMocForCloud(
      baseTrack({ connections: [{ type: NaN, next: 0, vector: new PolarVector() }] }),
      { categories, texture }
    ).ok).toBeFalse();
  });

  it('rejects a connection whose next is not an index into the connections', function () {
    const withNext = (next) => baseTrack({
      connections: [
        { type: 0, next, vector: new PolarVector(1, 0, 0) },
        { type: 0, next: 0, vector: new PolarVector(1, 1, 1) },
      ],
    });
    expect(validateMocForCloud(withNext(1), { categories, texture }).ok).toBeTrue();
    expect(validateMocForCloud(withNext(2), { categories, texture }).ok).toBeFalse();
    expect(validateMocForCloud(withNext(-1), { categories, texture }).ok).toBeFalse();
    expect(validateMocForCloud(withNext(0.5), { categories, texture }).ok).toBeFalse();
    expect(validateMocForCloud(withNext('1'), { categories, texture }).ok).toBeFalse();
  });

  it('rejects a connection vector with non-numeric fields', function () {
    // An imported file's vector goes through PolarVector.fromFloats, which does
    // not check what it is given.
    const withVector = (vector) => baseTrack({ connections: [{ type: 0, next: 0, vector }] });
    expect(validateMocForCloud(withVector(PolarVector.fromFloats('x', 0, 0)), {
      categories, texture,
    }).ok).toBeFalse();
    expect(validateMocForCloud(withVector(PolarVector.fromFloats(1, 'x', 0)), {
      categories, texture,
    }).ok).toBeFalse();
    expect(validateMocForCloud(withVector(PolarVector.fromFloats(1, 0, undefined)), {
      categories, texture,
    }).ok).toBeFalse();
  });

  it('rejects a missing texture', function () {
    expect(validateMocForCloud(baseTrack(), { categories, texture: null }).ok).toBeFalse();
  });

  it('rejects a texture over the decoded-pixel cap', function () {
    const big = { width: MAX_DECODED_PIXELS, height: 2 };
    expect(validateMocForCloud(baseTrack(), { categories, texture: big }).ok).toBeFalse();
  });
});
