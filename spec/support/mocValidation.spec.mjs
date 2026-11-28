/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import { validateSerializedMoc } from '../../src/utils/mocValidation.js';

describe('validateSerializedMoc', function () {
  const straight = [
    { type: 1, vector: [128, 0, 0], next: 1 },
    { type: 1, vector: [128, 1.0, 1.0], next: 0 },
  ];

  it('accepts the metadata a downloaded layout carries', function () {
    expect(validateSerializedMoc({
      alias: 'myMoc', name: 'Corner Bakery', category: 'structures', scale: 2.5, make: 0,
      type: 'track', connections: straight, onbp: '#c91a09',
    })).toBeTrue();
  });

  it('accepts a MOC with none of the optional fields', function () {
    expect(validateSerializedMoc({ alias: 'myMoc', name: 'Corner Bakery' })).toBeTrue();
    expect(validateSerializedMoc({ connections: [] })).toBeTrue();
  });

  it('rejects something that is not a MOC at all', function () {
    expect(validateSerializedMoc(null)).toBeFalse();
    expect(validateSerializedMoc('myMoc')).toBeFalse();
  });

  it('rejects connections that registration could not turn into geometry', function () {
    const withConnection = (connection) => validateSerializedMoc({
      connections: [connection, straight[1]],
    });
    expect(withConnection({ type: 1, vector: {}, next: 1 })).toBeFalse();
    expect(withConnection({ type: 1, vector: [128, 0], next: 1 })).toBeFalse();
    expect(withConnection({ type: 1, vector: ['128', 0, 0], next: 1 })).toBeFalse();
    expect(withConnection({ type: 1, vector: [128, 0, NaN], next: 1 })).toBeFalse();
    expect(withConnection({ type: 'x', vector: [128, 0, 0], next: 1 })).toBeFalse();
    expect(withConnection(null)).toBeFalse();
    expect(validateSerializedMoc({ connections: {} })).toBeFalse();
  });

  it('rejects a connection whose next is not an index into the connections', function () {
    const withNext = (next) => validateSerializedMoc({
      connections: [{ type: 1, vector: [128, 0, 0], next }, straight[1]],
    });
    expect(withNext(2)).toBeFalse();
    expect(withNext(-1)).toBeFalse();
    expect(withNext(0.5)).toBeFalse();
    expect(withNext('1')).toBeFalse();
    expect(withNext(1)).toBeTrue();
  });

  it('rejects an unusable scale, type or baseplate color', function () {
    expect(validateSerializedMoc({ scale: 0 })).toBeFalse();
    expect(validateSerializedMoc({ scale: '2' })).toBeFalse();
    expect(validateSerializedMoc({ scale: Infinity })).toBeFalse();
    expect(validateSerializedMoc({ type: 'rocket' })).toBeFalse();
    expect(validateSerializedMoc({ onbp: 'green' })).toBeFalse();
    expect(validateSerializedMoc({ onbp: 0x237841 })).toBeFalse();
  });
});
