import { Pose } from "./pose.js";

export class PolarVector {
    /**
     * 
     * @param {Number} magnitude Length of this vector
     * @param {Number} angle Angle in radians
     * @param {Number} exitAngle Exit Angle in radians
     */
    constructor(magnitude = 0, angle = 0, exitAngle = 0) {
        /**
         * @type {Number}
         */
        this.magnitude = magnitude;
        /**
         * Angle in radians
         * @type {Number}
         */
        this.angle = angle;
        /**
         * Angle in radians
         * @type {Number}
         */
        this.exitAngle = exitAngle;
    }

    /**
     * Creates a new PolarVector, assuming the angles given need to multiplied by PI
     * @param {Number} magnitude 
     * @param {Number} angle 
     * @param {Number} exitAngle 
     * @returns {PolarVector}
     */
    static fromFloats(magnitude, angle, exitAngle) {
        return new PolarVector(magnitude, angle * Math.PI, exitAngle * Math.PI);
    }

    /**
     * 
     * @param {Pose} startPose 
     * @param {Pose} endPose 
     * @returns {PolarVector}
     */
    static fromPoses(startPose, endPose) {
        const dx = endPose.x - startPose.x;
        const dy = endPose.y - startPose.y;
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const exitAngle = endPose.angle - startPose.angle;
        return new PolarVector(magnitude, angle, exitAngle);
    }

    // Convert to cartesian coordinates
    toCartesian() {
        const x = this.magnitude * Math.cos(this.angle);
        const y = this.magnitude * Math.sin(this.angle);
        return { x, y };
    }

    /**
     * 
     * @param {Pose} endPosition 
     * @returns {Pose}
     */
    getStartPosition(endPosition) {
        var tempAngle = endPosition.angle - this.exitAngle;
        return new Pose(
            endPosition.x - this.magnitude * Math.cos(tempAngle + this.angle),
            endPosition.y - this.magnitude * Math.sin(tempAngle + this.angle),
            tempAngle
        )
    }

    /**
     * Gets the end position of this vector given a start position.
     * @param {Pose} startPosition 
     * @returns {Pose}
     */
    getEndPosition(startPosition) {
        return new Pose(
            startPosition.x + this.magnitude * Math.cos(startPosition.angle + this.angle),
            startPosition.y + this.magnitude * Math.sin(startPosition.angle + this.angle),
            startPosition.angle + this.exitAngle
        )
    }

    // Static method to create PolarVector from cartesian coordinates
    static fromCartesian(x, y) {
        const magnitude = Math.sqrt(x * x + y * y);
        const angle = Math.atan2(y, x);
        return new PolarVector(magnitude, angle);
    }

    // Add another vector
    add(other) {
        const cart1 = this.toCartesian();
        const cart2 = other.toCartesian();
        return PolarVector.fromCartesian(cart1.x + cart2.x, cart1.y + cart2.y);
    }

    // Scale the vector
    scale(factor) {
        return new PolarVector(this.magnitude * factor, this.angle);
    }

    // Rotate the vector
    rotate(angle) {
        return new PolarVector(this.magnitude, this.angle + angle);
    }

    toJSON() {
        return [this.magnitude, this.angle / Math.PI, this.exitAngle / Math.PI];
    }
}