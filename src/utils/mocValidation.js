/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

/**
 * @module mocValidation
 * Validation for custom MOCs embedded in local layout files. This runs on the
 * local import path, which must work with no cloud code loaded, so it stays
 * public and dependency-light. MOCs bound for the cloud API are checked by the
 * private cloud module instead.
 * Follows AirBNB JavaScript style guide.
 */

import { DataTypes } from '../controller/layoutController.js';

/**
 * Checks the metadata of a MOC embedded in a layout file, in its serialized
 * form, before its alias is accepted. Registering it turns `connections` into
 * PolarVectors and indexes them by `next`, so anything malformed there would
 * otherwise throw part way through the import or produce unusable geometry.
 * Only the fields the import reads are checked; `textureData` is checked when
 * it is decoded.
 * @param {import('../controller/layoutController.js').SerializedMoc} moc
 * @returns {Boolean} True if the metadata can be registered
 */
export function validateSerializedMoc(moc) {
  if (!moc || typeof moc !== 'object') {
    return false;
  }
  const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
  if (moc.scale !== undefined && !(isFiniteNumber(moc.scale) && moc.scale > 0)) {
    return false;
  }
  if (moc.type !== undefined && !Object.values(DataTypes).includes(moc.type)) {
    return false;
  }
  if (moc.onbp !== undefined
    && !(typeof moc.onbp === 'string' && /^#[0-9A-F]{6}$/i.test(moc.onbp))) {
    return false;
  }
  if (moc.connections === undefined) {
    return true;
  }
  if (!Array.isArray(moc.connections)) {
    return false;
  }
  const count = moc.connections.length;
  return moc.connections.every((connection) => Boolean(connection)
    && typeof connection === 'object'
    && isFiniteNumber(connection.type)
    && Number.isInteger(connection.next) && connection.next >= 0 && connection.next < count
    && Array.isArray(connection.vector) && connection.vector.length === 3
    && connection.vector.every(isFiniteNumber));
}
