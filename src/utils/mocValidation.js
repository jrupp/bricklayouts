/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import { DataTypes } from '../controller/layoutController.js';
import { MAX_DECODED_PIXELS } from './imageValidation.js';
import { PolarVector } from '../model/polarVector.js';

/**
 * Maximum length of a custom MOC's name. Mirrors the `maxlength` on the
 * editor's `#componentName` input.
 * @type {Number}
 * @constant
 */
export const MAX_MOC_NAME_LENGTH = 64;

/**
 * Validate a custom MOC's track data before it is sent to the cloud MOC
 * endpoints. These checks mirror the constraints the editor's DOM controls
 * enforce implicitly, so a hand-edited layout file cannot smuggle unbounded or
 * malformed metadata to the API through the local-file upload path.
 * @param {TrackData} track The MOC track to validate
 * @param {Object} options
 * @param {Map<String, String>} options.categories Known category keys
 * @param {*} [options.texture] The loaded texture for the MOC
 * @returns {{ok: Boolean, reason?: String}}
 */
export function validateMocForCloud(track, { categories, texture }) {
  if (!track || typeof track !== 'object') {
    return { ok: false, reason: 'MOC data is missing.' };
  }

  if (typeof track.name !== 'string' || track.name.trim().length === 0) {
    return { ok: false, reason: 'MOC name is required.' };
  }
  if (track.name.length > MAX_MOC_NAME_LENGTH) {
    return { ok: false, reason: `MOC name must be ${MAX_MOC_NAME_LENGTH} characters or fewer.` };
  }

  if (!categories || typeof categories.has !== 'function' || !categories.has(track.category)) {
    return { ok: false, reason: 'MOC category is not recognized.' };
  }

  // No upper bound: the scale is whatever fits the image to the size the user
  // asked for, so a small image at a large size legitimately needs a big one.
  // Zero is refused because it would make the component invisible.
  if (typeof track.scale !== 'number' || !Number.isFinite(track.scale) || track.scale <= 0) {
    return { ok: false, reason: 'MOC scale must be a positive number.' };
  }

  if (!Object.values(DataTypes).includes(track.type)) {
    return { ok: false, reason: 'MOC type is not recognized.' };
  }

  if (track.onbp !== void 0 && track.onbp !== null) {
    if (typeof track.onbp !== 'number' || !Number.isInteger(track.onbp)
      || track.onbp < 0 || track.onbp > 0xFFFFFF) {
      return { ok: false, reason: 'MOC baseplate color is invalid.' };
    }
  }

  if (track.connections !== void 0 && track.connections !== null) {
    if (!Array.isArray(track.connections)) {
      return { ok: false, reason: 'MOC connections are invalid.' };
    }
    const count = track.connections.length;
    const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
    for (const connection of track.connections) {
      // `next` indexes this same array when another copy is attached, and the
      // vector fields become coordinates, so both have to be usable as such.
      if (!connection || typeof connection !== 'object'
        || !isFiniteNumber(connection.type)
        || !Number.isInteger(connection.next) || connection.next < 0 || connection.next >= count
        || !(connection.vector instanceof PolarVector)
        || !isFiniteNumber(connection.vector.magnitude)
        || !isFiniteNumber(connection.vector.angle)
        || !isFiniteNumber(connection.vector.exitAngle)) {
        return { ok: false, reason: 'MOC connections are invalid.' };
      }
    }
  }

  if (!texture) {
    return { ok: false, reason: 'MOC texture is not loaded.' };
  }
  const { width, height } = texture;
  if (typeof width !== 'number' || typeof height !== 'number'
    || !Number.isFinite(width) || !Number.isFinite(height)
    || width <= 0 || height <= 0 || width * height > MAX_DECODED_PIXELS) {
    return { ok: false, reason: 'MOC texture is invalid or too large.' };
  }

  return { ok: true };
}
