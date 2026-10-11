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
 * Smallest scale accepted for a custom MOC. Matches the `min` on the editor's
 * `#componentScale` input.
 * @type {Number}
 * @constant
 */
export const MOC_SCALE_MIN = 0.001;

/**
 * Largest scale accepted for a custom MOC. Matches the `max` on the editor's
 * `#componentScale` input.
 * @type {Number}
 * @constant
 */
export const MOC_SCALE_MAX = 2.0;

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

  if (typeof track.scale !== 'number' || !Number.isFinite(track.scale)
    || track.scale < MOC_SCALE_MIN || track.scale > MOC_SCALE_MAX) {
    return { ok: false, reason: 'MOC scale is out of range.' };
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
    for (const connection of track.connections) {
      if (!connection || typeof connection !== 'object'
        || typeof connection.type !== 'number' || !Number.isFinite(connection.type)
        || typeof connection.next !== 'number' || !Number.isFinite(connection.next)
        || !(connection.vector instanceof PolarVector)) {
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
