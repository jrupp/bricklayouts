/**
 * @typedef {Object} SerializedPose
 * @property {Number} x
 * @property {Number} y
 * @property {Number} angle
 */
let SerializedPose;
export { SerializedPose };

export class Pose {
    /**
     * 
     * @param {Number} x 
     * @param {Number} y 
     * @param {Number} angle Angle in radians
     */
    constructor(x = 0, y = 0, angle = 0) {
        /**
         * @type {Number} X coordinate
         */
        this.x = x;
        /**
         * @type {Number} Y coordinate
         */
        this.y = y;
        /**
         * @type {Number} Angle in radians
         */
        this.angle = Pose.normalizeAngle(angle);
    }

    /**
     * Clone this Pose
     * @returns {Pose} A new Pose with the same values as this one
     */
    clone() {
        return new Pose(this.x, this.y, this.angle);
    }

    /**
     * Set this Pose to the given values
     * @param {Number} x 
     * @param {Number} y 
     * @param {Number} angle 
     * @returns {Pose} This Pose
     */
    set(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = Pose.normalizeAngle(angle);
        return this;
    }

    /**
     * Add a Pose to this one, and return the result.
     * @param {Pose} pose 
     * @returns {Pose} A new Pose containing the result of the addition
     */
    add(pose) {
        return new Pose(this.x + pose.x, this.y + pose.y, this.angle + pose.angle);
    }

    /**
     * Check if this Pose is equal to another Pose
     * @param {Pose} pose
     * @returns {Boolean} True if the two Poses are equal, false otherwise
     */
    equals(pose) {
        return this.x === pose.x && this.y === pose.y && this.angle === pose.angle;
    }

    
    /**
     * Checks if another pose is within a specified radius of this pose.
     * Uses Manhattan distance (L1 norm) for the calculation.
     * @param {Pose} pose - The pose to check against.
     * @param {Number} radius - The radius within which to check.
     * @returns {Boolean} True if the pose is within the radius, false otherwise.
     */
    isInRadius(pose, radius) {
        return Math.abs(this.x - pose.x) <= radius && Math.abs(this.y - pose.y) <= radius;
    }

    /**
     * Checks if this pose's angle is opposite (180 degrees rotated) from another pose's angle.
     * Accounts for floating point imprecision.
     * @param {Pose} pose - The pose to compare against
     * @param {Number} [epsilon=1e-10] - Maximum allowed difference
     * @returns {Boolean} True if angles are opposite, false otherwise
     */
    hasOppositeAngle(pose, epsilon = 1e-10) {
        const diff = Math.abs((this.angle - pose.angle + Math.PI) % (2 * Math.PI));
        return diff <= epsilon || diff >= (2 * Math.PI - epsilon);
    }

    /**
     * Computes the magnitude of this point (Euclidean distance from 0, 0).
     * 
     * Defined as the square root of the sum of the squares of each component.
     * @returns {Number} The magnitude (length) of the vector represented by this Pose
     */
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Resets this Pose to default numbers
     * @returns {Pose} This Pose
     */
    reset() {
        return this.set(0, 0, 0);
    }

    /**
     * Subtract a Pose from this one, and return the result.
     * @param {Pose} pose 
     * @returns {Pose} A new Pose containing the result of the subtraction
     */
    subtract(pose) {
        return new Pose(this.x - pose.x, this.y - pose.y, this.angle - pose.angle);
    }

    /**
     * Rotate this Pose by the given angle
     * @param {Number} delta Angle to rotate by in radians
     */
    turnAngle(delta) {
        const twoPi = 2 * Math.PI;
        this.angle = (((this.angle + delta) % twoPi) + twoPi) % twoPi;
    }

    /**
     * 
     * @returns {SerializedPose} A plain object with the x, y, and angle properties of this Pose
     */
    serialize() {
        return {
            x: this.x,
            y: this.y,
            angle: this.angle
        };
    }

    /**
     * 
     * @param {SerializedPose} data 
     * @returns {Pose}
     */
    static deserialize(data) {
        return new Pose(data.x, data.y, data.angle);
    }

    /**
     * 
     * @param {SerializedPose} data 
     * @returns {Boolean} True if data is valid, false otherwise
     */
    static _validateImportData(data) {
        return data?.x !== undefined && data?.y !== undefined && data?.angle !== undefined;
    }

    /**
     * Normalizes an angle to be within the range [0, 2π).
     * @param {Number} angle - The angle to normalize in radians
     * @returns {Number} The normalized angle in radians between 0 and 2π
     */
    static normalizeAngle(angle) {
        const twoPi = 2 * Math.PI;
        return (((angle % twoPi) + twoPi) % twoPi);
    }
}