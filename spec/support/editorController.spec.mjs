import { EditorController } from "../../src/controller/editorController.js";

describe("EditorController", function () {
  describe("computePrefill", function () {
    it("returns studs when both dimensions are multiples of 16", function () {
      const texture = { width: 32, height: 64 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 2, height: 4, units: 'studs' });
    });

    it("returns studs for large square multiples of 16", function () {
      const texture = { width: 320, height: 320 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 20, height: 20, units: 'studs' });
    });

    it("returns inches for dimensions that are integer multiples of 51.2", function () {
      // 51.2 * 5 = 256, which is also a multiple of 16, so studs wins by priority
      // Use a case where only inches makes sense - but any integer multiple of 51.2
      // is also a multiple of 16, so studs will always take priority for inches.
      // Verify that priority ordering: 256 x 256 → studs (16, 16), not inches (5, 5)
      const texture = { width: 256, height: 256 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 16, height: 16, units: 'studs' });
    });

    it("returns centimeters when dimensions are multiples of 20 but not 16", function () {
      const texture = { width: 60, height: 100 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 3, height: 5, units: 'centimeters' });
    });

    it("returns millimeters when dimensions are multiples of 2 but not 16 or 20", function () {
      const texture = { width: 6, height: 14 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 3, height: 7, units: 'millimeters' });
    });

    it("returns millimeters for dimensions divisible by 2 but not 16 or 20", function () {
      const texture = { width: 30, height: 30 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 15, height: 15, units: 'millimeters' });
    });

    it("returns null when no unit yields whole numbers", function () {
      const texture = { width: 33, height: 33 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toBeNull();
    });

    it("returns null when only one dimension is a whole number in a unit", function () {
      // 32 is multiple of 16 (2 studs), 33 is not
      const texture = { width: 32, height: 33 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toBeNull();
    });

    it("returns null for zero dimensions", function () {
      expect(EditorController.computePrefill(0, 32)).toBeNull();
      expect(EditorController.computePrefill(32, 0)).toBeNull();
    });

    it("returns null for negative dimensions", function () {
      expect(EditorController.computePrefill(-16, 16)).toBeNull();
    });

    it("returns null for non-finite dimensions", function () {
      expect(EditorController.computePrefill(NaN, 16)).toBeNull();
      expect(EditorController.computePrefill(16, Infinity)).toBeNull();
    });

    it("prioritizes studs over centimeters when both apply", function () {
      // 80 is divisible by both 16 (5 studs) and 20 (4 cm) - studs wins
      const texture = { width: 80, height: 80 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result.units).toBe('studs');
      expect(result.width).toBe(5);
      expect(result.height).toBe(5);
    });

    it("handles a 16x16 texture as 1x1 studs", function () {
      const texture = { width: 16, height: 16 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 1, height: 1, units: 'studs' });
    });

    it("handles a non-square studs texture", function () {
      const texture = { width: 48, height: 96 };
      const result = EditorController.computePrefill(texture.width, texture.height);
      expect(result).toEqual({ width: 3, height: 6, units: 'studs' });
    });
  });
});
