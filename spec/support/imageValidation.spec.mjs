/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import {
  ALLOWED_MIME,
  MAX_FILE_BYTES,
  validateImageFile,
  checkMagicBytes,
  readImageDimensions,
  aspectMatches
} from '../../src/utils/imageValidation.js';

/**
 * Build an ArrayBuffer from an array of byte values, padded to a minimum length
 * so buffer-length guards inside checkMagicBytes don't short-circuit before
 * the signature check we care about.
 */
function buf(bytes, padTo = 16) {
  const len = Math.max(bytes.length, padTo);
  const a = new Uint8Array(len);
  a.set(bytes, 0);
  return a.buffer;
}

describe('imageValidation', function () {
  describe('validateImageFile', function () {
    it('accepts each allowed MIME type', function () {
      for (const type of ALLOWED_MIME) {
        const file = { type, size: 1024 };
        expect(validateImageFile(file)).toEqual({ ok: true });
      }
    });

    it('rejects null / undefined files', function () {
      expect(validateImageFile(null).ok).toBe(false);
      expect(validateImageFile(undefined).ok).toBe(false);
    });

    it('rejects disallowed MIME types (including SVG)', function () {
      expect(validateImageFile({ type: 'image/svg+xml', size: 100 }).ok).toBe(false);
      expect(validateImageFile({ type: 'image/bmp', size: 100 }).ok).toBe(false);
      expect(validateImageFile({ type: 'application/octet-stream', size: 100 }).ok).toBe(false);
      expect(validateImageFile({ type: '', size: 100 }).ok).toBe(false);
    });

    it('rejects files exceeding the size cap', function () {
      const result = validateImageFile({ type: 'image/png', size: MAX_FILE_BYTES + 1 });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('too large');
    });

    it('accepts a file exactly at the size cap', function () {
      expect(validateImageFile({ type: 'image/png', size: MAX_FILE_BYTES }).ok).toBe(true);
    });
  });

  describe('checkMagicBytes', function () {
    it('detects PNG signature', function () {
      const b = buf([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(checkMagicBytes(b)).toEqual({ ok: true, mime: 'image/png' });
    });

    it('detects JPEG signature', function () {
      const b = buf([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(checkMagicBytes(b)).toEqual({ ok: true, mime: 'image/jpeg' });
    });

    it('detects GIF87a signature', function () {
      const b = buf([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
      expect(checkMagicBytes(b)).toEqual({ ok: true, mime: 'image/gif' });
    });

    it('detects GIF89a signature', function () {
      const b = buf([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(checkMagicBytes(b)).toEqual({ ok: true, mime: 'image/gif' });
    });

    it('detects WEBP signature', function () {
      const b = buf([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
      expect(checkMagicBytes(b)).toEqual({ ok: true, mime: 'image/webp' });
    });

    it('rejects SVG bytes (< tag)', function () {
      const b = buf([0x3C, 0x3F, 0x78, 0x6D, 0x6C]);
      expect(checkMagicBytes(b).ok).toBe(false);
    });

    it('rejects BMP bytes', function () {
      const b = buf([0x42, 0x4D, 0x00, 0x00]);
      expect(checkMagicBytes(b).ok).toBe(false);
    });

    it('rejects RIFF without WEBP subtype', function () {
      const b = buf([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
      expect(checkMagicBytes(b).ok).toBe(false);
    });

    it('rejects too-short buffers', function () {
      expect(checkMagicBytes(new ArrayBuffer(2)).ok).toBe(false);
      expect(checkMagicBytes(null).ok).toBe(false);
    });

    it('rejects arbitrary junk bytes', function () {
      const b = buf([0x00, 0x01, 0x02, 0x03, 0x04]);
      expect(checkMagicBytes(b).ok).toBe(false);
    });
  });

  describe('aspectMatches', function () {
    it('returns true for identical dimensions', function () {
      expect(aspectMatches(100, 100, 100, 100)).toBe(true);
    });

    it('returns true for identical ratios at different scales', function () {
      expect(aspectMatches(200, 100, 400, 200)).toBe(true);
      expect(aspectMatches(1920, 1080, 3840, 2160)).toBe(true);
    });

    it('returns false for mismatched ratios', function () {
      expect(aspectMatches(200, 100, 100, 100)).toBe(false);
      expect(aspectMatches(16, 9, 4, 3)).toBe(false);
    });

    it('honors the epsilon tolerance', function () {
      expect(aspectMatches(1000, 1000, 1000, 1001)).toBe(true);
      expect(aspectMatches(1000, 1000, 1000, 1100, 0.005)).toBe(false);
    });

    it('accepts a custom epsilon', function () {
      expect(aspectMatches(100, 100, 100, 110, 0.1)).toBe(true);
      expect(aspectMatches(100, 100, 100, 110, 0.05)).toBe(false);
    });

    it('applies the tolerance relative to the ratio', function () {
      // Both ratios are within 0.005 of each other in absolute terms, but the
      // width doubles.
      expect(aspectMatches(8, 2000, 16, 2000)).toBe(false);
      expect(aspectMatches(2000, 8, 2000, 16)).toBe(false);
      expect(aspectMatches(8, 2000, 16, 4000)).toBe(true);
    });

    it('rejects zero, negative, and non-finite inputs', function () {
      expect(aspectMatches(0, 100, 100, 100)).toBe(false);
      expect(aspectMatches(100, 0, 100, 100)).toBe(false);
      expect(aspectMatches(-100, 100, 100, 100)).toBe(false);
      expect(aspectMatches(NaN, 100, 100, 100)).toBe(false);
      expect(aspectMatches(100, Infinity, 100, 100)).toBe(false);
    });
  });

  describe('readImageDimensions', function () {
    /** Encodes a real image of the given size with the browser's own encoder. */
    async function encoded(type, width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(200, 30, 30, 0.5)';
      ctx.fillRect(0, 0, width / 2, height / 2);
      const blob = await new Promise((resolve) => { canvas.toBlob(resolve, type); });
      return { blob, buffer: await blob.arrayBuffer() };
    }

    it('reads PNG, JPEG and WebP files as the browser encodes them', async function () {
      for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
        // eslint-disable-next-line no-await-in-loop
        const { blob, buffer } = await encoded(type, 37, 21);
        // Only formats this browser can actually encode are meaningful here.
        if (blob.type === type) {
          expect(readImageDimensions(buffer, type)).withContext(type)
            .toEqual({ width: 37, height: 21 });
        }
      }
    });

    it('reads a PNG header claiming a size far too large to decode', function () {
      const header = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
        0, 0, 0x75, 0x30, 0, 0, 0x75, 0x30];
      expect(readImageDimensions(buf(header, 33), 'image/png'))
        .toEqual({ width: 30000, height: 30000 });
    });

    it('finds the JPEG frame header after other segments', function () {
      const jpeg = [0xFF, 0xD8,
        // APP0, length 4 (2 bytes of payload)
        0xFF, 0xE0, 0x00, 0x04, 0x4A, 0x46,
        // Fill byte, then SOF2 (progressive): precision 8, height 300, width 500
        0xFF, 0xFF, 0xC2, 0x00, 0x11, 0x08, 0x01, 0x2C, 0x01, 0xF4];
      expect(readImageDimensions(buf(jpeg, 40), 'image/jpeg'))
        .toEqual({ width: 500, height: 300 });
    });

    it('gives up on a JPEG whose scan starts before any frame header', function () {
      const jpeg = [0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x08];
      expect(readImageDimensions(buf(jpeg, 20), 'image/jpeg')).toBeNull();
    });

    it('reads a GIF, counting a first frame that overhangs the logical screen', function () {
      const gif = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
        // Logical screen 10x10, no global colour table
        0x0A, 0x00, 0x0A, 0x00, 0x00, 0x00, 0x00,
        // Graphic control extension
        0x21, 0xF9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
        // Image descriptor at (5, 0), 4000x20
        0x2C, 0x05, 0x00, 0x00, 0x00, 0xA0, 0x0F, 0x14, 0x00, 0x00];
      expect(readImageDimensions(buf(gif, 40), 'image/gif'))
        .toEqual({ width: 4005, height: 20 });
    });

    it('reads lossless and extended WebP headers', function () {
      const riff = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
      // VP8L: width 400 and height 300, each stored as size - 1 in 14 bits
      const w = 399;
      const h = 299;
      const lossless = [...riff, 0x56, 0x50, 0x38, 0x4C, 0, 0, 0, 0, 0x2F,
        w & 0xFF, ((w >> 8) & 0x3F) | ((h & 0x03) << 6), (h >> 2) & 0xFF, (h >> 10) & 0x0F];
      expect(readImageDimensions(buf(lossless, 32), 'image/webp'))
        .toEqual({ width: 400, height: 300 });
      // VP8X: a 20000x10000 canvas, as size - 1 in 24 bits
      const extended = [...riff, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0,
        0x1F, 0x4E, 0x00, 0x0F, 0x27, 0x00];
      expect(readImageDimensions(buf(extended, 32), 'image/webp'))
        .toEqual({ width: 20000, height: 10000 });
    });

    it('returns null for a header it cannot read or a zero size', function () {
      expect(readImageDimensions(buf([0x89, 0x50, 0x4E, 0x47]), 'image/png')).toBeNull();
      expect(readImageDimensions(buf([0xFF, 0xD8, 0x00]), 'image/jpeg')).toBeNull();
      expect(readImageDimensions(null, 'image/png')).toBeNull();
      expect(readImageDimensions(buf([1, 2, 3]), 'image/bmp')).toBeNull();
      const zero = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 0, 0, 0, 0, 1];
      expect(readImageDimensions(buf(zero, 33), 'image/png')).toBeNull();
    });
  });
});
