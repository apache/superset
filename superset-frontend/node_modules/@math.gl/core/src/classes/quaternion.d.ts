import MathArray from './base/math-array';

export default class Quaternion extends MathArray<Quaternion> {
  // Getters/setters
  ELEMENTS: number;

  x: number;
  y: number;
  z: number;
  w: number;

  /** Creates a new identity quaternion: `w^2 + x^2 + y^2 + z^2 = 1` */
  constructor();
  constructor(q: Quaternion);
  constructor(q: readonly number[]);
  constructor(x: number, y: number, z: number, w: number);

  copy(array: readonly number[]): Quaternion;

  set(x: number, y: number, z: number, w: number): Quaternion;

  /**
   * Creates a quaternion from the given 3x3 rotation matrix.
   *
   * - The resultant quaternion is not normalized, so you should
   * be sure to renormalize the quaternion yourself where necessary.
   */
  fromMatrix3(m: readonly number[]): Quaternion;

  fromAxisRotation(axis, rad): Quaternion;

  /** Set a quat to the identity quaternion */
  identity(): Quaternion;

  // Set the components of a quaternion to the given values
  // set(i, j, k, l) {
  //   quat.set(this, i, j, k, l);
  //   return this.check();
  // }

  /** Sets a quaternion from the given angle and rotation axis, then returns it. */
  setAxisAngle(axis, rad): Quaternion;

  /** Calculates the length of a quaternion */
  len(): number;

  /** Calculates the squared length of a quaternion */
  lengthSquared(): number;

  /** Calculates the dot product of two quaternions */
  dot(a: readonly number[]): number;

  rotationTo(vectorA, vectorB): Quaternion;

  /** Adds two quaternions */
  add(a: readonly number[]): Quaternion;

  /**
   * Calculates the W component of a quat from the X, Y, and Z components.
   * Any existing W component will be ignored.
   */
  calculateW(): Quaternion;

  /**
   * Calculates the conjugate of a quat If the quaternion is normalized,
   * this function is faster than quat.inverse and produces the same result.
   */
  conjugate(): Quaternion;

  /** Calculates the inverse of this quaternion */
  invert(): Quaternion;

  /** Performs a linear interpolation between two quaternions */
  lerp(a, b, t): Quaternion;

  /** Multiplies two quaternions */
  multiplyRight(a, b): Quaternion;
  /** Multiplies two quaternions */
  multiplyLeft(a, b): Quaternion;

  /** Normalize a quaternion */
  normalize(): Quaternion;

  // MODIFIERS

  /** Rotates a quaternion by the given angle about the X axis */
  rotateX(radians: number): Quaternion;
  /** Rotates a quaternion by the given angle about the Y axis */
  rotateY(radians: number): Quaternion;
  /** Rotates a quaternion by the given angle about the Z axis */
  rotateZ(radians: number): Quaternion;

  /** Scales a quaternion by a scalar number */
  scale(b: number): Quaternion;

  /** Performs a spherical linear interpolation between two quaternions */
  slerp(start: readonly number[], target: readonly number[], ratio: number): Quaternion;
  slerp(args: {start: readonly number[]; target: readonly number[]; ratio: number}): Quaternion;

  transformVector4(vector, result?);

  // THREE.js Math API compatibility
  lengthSq(): Quaternion;
  setFromAxisAngle(axis, rad): Quaternion;
  premultiply(a, b): Quaternion;
  multiply(a, b): Quaternion;
}
