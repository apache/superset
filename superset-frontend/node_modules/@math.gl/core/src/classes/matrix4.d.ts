import Matrix from './base/matrix';
// import Quaternion from './quaternion';

type Array16 = number[];
// = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

export default class Matrix4 extends Matrix<Matrix4> {
  static IDENTITY: number[];
  static ZERO: number[];
  INDICES: number[];
  // get ELEMENTS()
  // get RANK()

  constructor();
  constructor(array: Array16);

  copy(array: Array16);

  // eslint-disable-next-line max-params
  set(
    m00: number,
    m01: number,
    m02: number,
    m03: number,
    m10: number,
    m11: number,
    m12: number,
    m13: number,
    m20: number,
    m21: number,
    m22: number,
    m23: number,
    m30: number,
    m31: number,
    m32: number,
    m33: number
  );
  setRowMajor(
    m00: number,
    m01: number,
    m02: number,
    m03: number,
    m10: number,
    m11: number,
    m12: number,
    m13: number,
    m20: number,
    m21: number,
    m22: number,
    m23: number,
    m30: number,
    m31: number,
    m32: number,
    m33: number
  );

  toRowMajor(result: Array16);

  identity(): Matrix4;

  // Calculates a 4x4 matrix from the given quaternion
  fromQuaternion(q: number[]): Matrix4;

  // Generates a frustum matrix with the given bounds
  frustum(args: {
    left: number;
    right: number;
    bottom: number;
    top: number;
    near: number;
    far: number;
  }): Matrix4;

  // Generates a look-at matrix with the given eye position, focal point, and up axis
  lookAt(eye: number[], center: number[], up: number[]): Matrix4;
  lookAt(args: {eye: number[]; center?: number[]; up: number[]}): Matrix4;

  // Generates a orthogonal projection matrix with the given bounds
  ortho(args: {
    left: number;
    right: number;
    bottom: number;
    top: number;
    near: number;
    far: number;
  }): Matrix4;

  // Generates an orthogonal projection matrix with the same parameters
  orthographic(args: {
    fovy: number;
    aspect?: number;
    focalDistance?: number;
    near?: number;
    far?: number;
  }): Matrix4;

  // Generates a perspective projection matrix with the given bounds
  perspective(args: {
    fovy?: number;
    fov?: number;
    aspect?: number;
    near?: number;
    far?: number;
  }): Matrix4;

  // Accessors

  determinant(): Matrix4;

  // Decomposition
  // Extracts the non-uniform scale assuming the matrix is an affine transformation.
  // The scales are the "lengths" of the column vectors in the upper-left 3x3 matrix.
  getScale(result?: number[]): Matrix4;
  // Gets the translation portion, assuming the matrix is a affine transformation matrix.
  getTranslation(result?: number[]): Matrix4;
  // Gets upper left 3x3 pure rotation matrix (non-scaling), assume affine transformation matrix
  getRotation(result?: number[], scaleResult?: number[]);
  getRotationMatrix3(result?: number[], scaleResult?: number[]);

  // Modifiers
  transpose(): Matrix4;
  invert(): Matrix4;

  // Operations
  multiplyLeft(a: number[]): Matrix4;
  multiplyRight(a: number[]): Matrix4;

  scale(factor): Matrix4;
  translate(vec): Matrix4;
  rotateX(radians: number): Matrix4;
  rotateY(radians: number): Matrix4;
  rotateZ(radians: number): Matrix4;
  rotateXYZ([rx, ry, rz]: number[]): Matrix4;
  rotateAxis(radians, axis): Matrix4;

  // Transforms

  // Transforms any 2, 3 or 4 element vector. 2 and 3 elements are treated as points
  transform(vector: number[], result: number[]): number[];

  // Transforms any 2 or 3 element array as point (w implicitly 1)
  transformAsPoint(vector: number[], result: number[]): number[];
  transformAsVector(vector: number[], result: number[]): number[];

  // three.js math API compatibility
  makeRotationX(radians: number): Matrix4;
  makeTranslation(x: number, y: number, z: number): Matrix4;

  // DEPRECATED in 3.0
  /** @deprecated Use Matrix4.transformAsPoint instead. */
  transformPoint(vector: number[], result?: number[]): number[];
  /** @deprecated Use Matrix4.transformAsPoint instead. */
  transformVector(vector: number[], result?: number[]): number[];
  /** @deprecated Use Matrix4.transformAsPoint instead. */
  transformDirection(vector: number[], result?: number[]): number[];
}
