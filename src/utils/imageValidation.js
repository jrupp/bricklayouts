/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

/**
 * @module imageValidation
 * Pure helpers for validating user-uploaded image files before handing them to
 * the PixiJS asset loader. Kept dependency-free so they are trivially unit
 * testable.
 */

export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_DECODED_PIXELS = 64_000_000;

/**
 * @param {File} file
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateImageFile(file) {
  if (!file) return { ok: false, reason: 'No file selected' };
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, reason: 'Unsupported image type' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: 'Image is too large (max 20 MB)' };
  }
  return { ok: true };
}

/**
 * Inspects the first bytes of a file buffer against known image signatures.
 * Rejects any file whose bytes don't match one of the allowed formats — this
 * catches files with a spoofed extension or MIME type.
 * @param {ArrayBuffer} buffer
 * @returns {{ ok: boolean, mime?: string }}
 */
export function checkMagicBytes(buffer) {
  if (!buffer || buffer.byteLength < 4) return { ok: false };
  const b = new Uint8Array(buffer);

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
      && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A) {
    return { ok: true, mime: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) {
    return { ok: true, mime: 'image/jpeg' };
  }

  // GIF: 47 49 46 38 (37|39) 61
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38
      && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) {
    return { ok: true, mime: 'image/gif' };
  }

  // WEBP: RIFF????WEBP
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
      && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { ok: true, mime: 'image/webp' };
  }

  return { ok: false };
}

/* eslint-disable no-bitwise -- the size fields below are packed binary */

/**
 * JPEG start-of-frame markers, the only segments that carry the image size.
 * C4 (DHT), C8 (JPG) and CC (DAC) share the range but are not frames.
 * @type {Set<number>}
 */
const JPEG_SOF_MARKERS = new Set([
  0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
]);

/**
 * @param {Uint8Array} b
 * @returns {?{width: number, height: number}}
 */
function readJpegDimensions(b) {
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xFF) {
      return null;
    }
    const marker = b[i + 1];
    if (marker === 0xFF) {
      // Fill byte before a marker.
      i += 1;
    } else if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD8)) {
      // Standalone markers have no length.
      i += 2;
    } else if (marker === 0xD9 || marker === 0xDA) {
      // End of image, or the scan data began, without a frame header.
      return null;
    } else if (JPEG_SOF_MARKERS.has(marker)) {
      if (i + 8 >= b.length) {
        return null;
      }
      return { width: (b[i + 7] << 8) | b[i + 8], height: (b[i + 5] << 8) | b[i + 6] };
    } else {
      const length = (b[i + 2] << 8) | b[i + 3];
      if (length < 2) {
        return null;
      }
      i += 2 + length;
    }
  }
  return null;
}

/**
 * @param {Uint8Array} b
 * @returns {?{width: number, height: number}}
 */
function readGifDimensions(b) {
  if (b.length < 13) {
    return null;
  }
  let width = b[6] | (b[7] << 8);
  let height = b[8] | (b[9] << 8);
  // The first frame may be placed partly outside the logical screen, and is
  // what a decoder sizes its output from, so its extent counts as well.
  let i = 13;
  if (b[10] & 0x80) {
    i += 3 * (2 ** ((b[10] & 0x07) + 1));
  }
  while (i < b.length) {
    if (b[i] === 0x2C) {
      if (i + 9 >= b.length) {
        break;
      }
      const left = b[i + 1] | (b[i + 2] << 8);
      const top = b[i + 3] | (b[i + 4] << 8);
      width = Math.max(width, left + (b[i + 5] | (b[i + 6] << 8)));
      height = Math.max(height, top + (b[i + 7] | (b[i + 8] << 8)));
      break;
    }
    if (b[i] !== 0x21) {
      break;
    }
    // Extension: label, then data sub-blocks up to a zero-length terminator.
    i += 2;
    while (i < b.length && b[i] !== 0) {
      i += b[i] + 1;
    }
    i += 1;
  }
  return { width, height };
}

/**
 * @param {Uint8Array} b
 * @returns {?{width: number, height: number}}
 */
function readWebpDimensions(b) {
  if (b.length < 30) {
    return null;
  }
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === 'VP8 ') {
    // Lossy: frame tag (3 bytes), start code 9D 01 2A, then 14-bit sizes.
    if (b[23] !== 0x9D || b[24] !== 0x01 || b[25] !== 0x2A) {
      return null;
    }
    return {
      width: (b[26] | (b[27] << 8)) & 0x3FFF,
      height: (b[28] | (b[29] << 8)) & 0x3FFF,
    };
  }
  if (chunk === 'VP8L') {
    // Lossless: signature 2F, then width - 1 and height - 1 in 14 bits each.
    if (b[20] !== 0x2F) {
      return null;
    }
    return {
      width: 1 + (b[21] | ((b[22] & 0x3F) << 8)),
      height: 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0F) << 10)),
    };
  }
  if (chunk === 'VP8X') {
    // Extended: flags (4 bytes), then canvas width - 1 and height - 1 in 24 bits.
    return {
      width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
      height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
    };
  }
  return null;
}

/**
 * Reads an image's pixel dimensions from its header, without decoding it, so
 * that an image too large to decode safely can be refused before it is. A
 * small compressed file can claim dimensions that would take gigabytes once
 * decoded.
 * @param {ArrayBuffer} buffer The file's bytes
 * @param {string} mime The format checkMagicBytes() identified
 * @returns {?{width: number, height: number}} Null when the header cannot be
 *   read or gives a zero size, which a caller should treat as invalid
 */
export function readImageDimensions(buffer, mime) {
  if (!buffer) return null;
  const b = new Uint8Array(buffer);
  let dims = null;
  if (mime === 'image/png') {
    // IHDR is always the first chunk: length (4), type (4), width (4), height (4).
    if (b.length >= 24 && b[12] === 0x49 && b[13] === 0x48 && b[14] === 0x44 && b[15] === 0x52) {
      const uint32 = (at) => (
        ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0
      );
      dims = { width: uint32(16), height: uint32(20) };
    }
  } else if (mime === 'image/jpeg') {
    dims = readJpegDimensions(b);
  } else if (mime === 'image/gif') {
    dims = readGifDimensions(b);
  } else if (mime === 'image/webp') {
    dims = readWebpDimensions(b);
  }
  if (!dims || !(dims.width > 0) || !(dims.height > 0)) {
    return null;
  }
  return dims;
}

/* eslint-enable no-bitwise */

/**
 * Returns true when two width/height pairs have the same aspect ratio within
 * an epsilon tolerance. Guards against zero/negative/non-finite inputs.
 * The tolerance is relative to the larger ratio, so it means the same thing for
 * a tall, narrow image (a ratio near 0) as for a square one.
 * @param {number} w1
 * @param {number} h1
 * @param {number} w2
 * @param {number} h2
 * @param {number} [eps=0.005]
 * @returns {boolean}
 */
export function aspectMatches(w1, h1, w2, h2, eps = 0.005) {
  if (![w1, h1, w2, h2].every(Number.isFinite)) return false;
  if (w1 <= 0 || h1 <= 0 || w2 <= 0 || h2 <= 0) return false;
  const r1 = w1 / h1;
  const r2 = w2 / h2;
  return Math.abs(r1 - r2) / Math.max(r1, r2) < eps;
}
