import { Pose } from "../../src/model/pose.js";

describe("Pose", function() {
    it("normalizes angles", function() {
        let pose = new Pose(0, 0, 7 * Math.PI);
        expect(pose.angle).toBeCloseTo(Math.PI);
    });

    it("doesn't modify angles less than 2π", function() {
        let pose = new Pose(0, 0, Math.PI);
        expect(pose.angle).toBe(Math.PI);
    });

    it("checks equality", function() {
        let pose1 = new Pose(100, 50, Math.PI / 4);
        let pose2 = new Pose(100, 50, Math.PI / 4);
        expect(pose1.equals(pose2)).toBeTrue();

        let pose3 = new Pose(50, 100, Math.PI / 2);
        expect(pose1.equals(pose3)).toBeFalse();
    });

    it("checks if a pose is within a radius", function() {
        let pose1 = new Pose(0, 0, 0);
        let pose2 = new Pose(1, 1, 0);
        expect(pose1.isInRadius(pose2, 1)).toBeTrue();
        expect(pose1.isInRadius(pose2, 0.5)).toBeFalse();
    });

    it("checks if a pose has an opposite angle", function() {
        let pose1 = new Pose(0, 0, 0);
        let pose2 = new Pose(0, 0, Math.PI - 1e-11);
        expect(pose1.hasOppositeAngle(pose2)).toBeTrue();
        expect(pose1.hasOppositeAngle(pose2, 1e-10)).toBeTrue();
        expect(pose1.hasOppositeAngle(pose2, 1e-20)).withContext("larger epsilon").toBeFalse();
        let pose3 = new Pose(0, 0, Math.PI / 2);
        expect(pose1.hasOppositeAngle(pose3)).toBeFalse();
    });

    it("normalizes negative angles", function() {
        let pose = new Pose(0, 0, -Math.PI);
        expect(pose.angle).toBeCloseTo(Math.PI);
    });

    it("rotates a pose around an origin by 90 degrees", function() {
        let pose = new Pose(10, 0, 0);
        pose.rotateAround(0, 0, Math.PI / 2);
        
        expect(pose.x).toBeCloseTo(0, 5);
        expect(pose.y).toBeCloseTo(10, 5);
        expect(pose.angle).toBeCloseTo(Math.PI / 2, 5);
    });

    it("rotates a pose around a non-origin point", function() {
        let pose = new Pose(15, 10, 0);
        pose.rotateAround(10, 10, Math.PI / 2);
        
        // Point (15,10) rotated 90° around (10,10) should be (10,15)
        expect(pose.x).toBeCloseTo(10, 5);
        expect(pose.y).toBeCloseTo(15, 5);
        expect(pose.angle).toBeCloseTo(Math.PI / 2, 5);
    });

    it("rotates a pose 180 degrees around an origin", function() {
        let pose = new Pose(5, 5, Math.PI / 4);
        pose.rotateAround(0, 0, Math.PI);
        
        expect(pose.x).toBeCloseTo(-5, 5);
        expect(pose.y).toBeCloseTo(-5, 5);
        expect(pose.angle).toBeCloseTo(Math.PI + Math.PI / 4, 5);
    });

    it("returns the same pose when rotating by 0 radians", function() {
        let pose = new Pose(10, 20, Math.PI / 3);
        pose.rotateAround(5, 5, 0);
        
        expect(pose.x).toBeCloseTo(10, 5);
        expect(pose.y).toBeCloseTo(20, 5);
        expect(pose.angle).toBeCloseTo(Math.PI / 3, 5);
    });

    it("handles full rotation (2π)", function() {
        let pose = new Pose(8, 4, Math.PI / 6);
        const originalX = pose.x;
        const originalY = pose.y;
        const originalAngle = pose.angle;
        
        pose.rotateAround(3, 3, 2 * Math.PI);
        
        expect(pose.x).toBeCloseTo(originalX, 5);
        expect(pose.y).toBeCloseTo(originalY, 5);
        // Angle increases with 2π but gets normalized
        expect(Pose.normalizeAngle(pose.angle)).toBeCloseTo(Pose.normalizeAngle(originalAngle + 2 * Math.PI), 5);
    });

    it("rotates a pose at the origin around itself", function() {
        let pose = new Pose(0, 0, 0);
        pose.rotateAround(0, 0, Math.PI / 4);
        
        expect(pose.x).toBeCloseTo(0, 5);
        expect(pose.y).toBeCloseTo(0, 5);
        expect(pose.angle).toBeCloseTo(Math.PI / 4, 5);
    });
});