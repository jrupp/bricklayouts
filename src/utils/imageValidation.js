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

/**
 * Returns true when two width/height pairs have the same aspect ratio within
 * an epsilon tolerance. Guards against zero/negative/non-finite inputs.
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
  return Math.abs(w1 / h1 - w2 / h2) < eps;
}
