import {
  ALLOWED_MIME,
  MAX_FILE_BYTES,
  validateImageFile,
  checkMagicBytes,
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

    it('rejects zero, negative, and non-finite inputs', function () {
      expect(aspectMatches(0, 100, 100, 100)).toBe(false);
      expect(aspectMatches(100, 0, 100, 100)).toBe(false);
      expect(aspectMatches(-100, 100, 100, 100)).toBe(false);
      expect(aspectMatches(NaN, 100, 100, 100)).toBe(false);
      expect(aspectMatches(100, Infinity, 100, 100)).toBe(false);
    });
  });
});
