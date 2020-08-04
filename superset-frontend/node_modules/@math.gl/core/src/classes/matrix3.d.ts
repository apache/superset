import Matrix from './base/matrix';
// import Quaternion from './quaternion';

export default class Matrix3 extends Matrix<Matrix3> {
  static IDENTITY: Matrix3;
  static ZERO: Matrix3;

  // inherited
  // ELEMENTS: number;
  // RANK: number;
  INDICES: number[];

  constructor();
  constructor(array: number[]);
  constructor(
    m00: number,
    m10: number,
    m20: number,
    m01: number,
    m11: number,
    m21: number,
    m02: number,
    m12: number,
    m22: number
  );

  copy(array): Matrix3;

  // accepts column major order, stores in column major order
  // eslint-disable-next-line max-params
  set(
    m00: number,
    m10: number,
    m20: number,
    m01: number,
    m11: number,
    m21: number,
    m02: number,
    m12: number,
    m22: number
  );

  // accepts row major order, stores as column major
  // eslint-disable-next-line max-params
  setRowMajor(
    m00: number,
    m01: number,
    m02: number,
    m10: number,
    m11: number,
    m12: number,
    m20: number,
    m21: number,
    m22: number
  );
  setRowMajor(...array: number[]);

  // Accessors
  determinant(): number;

  // Constructors
  identity(): Matrix3;

  // Calculates a 3x3 matrix from the given quaternion
  // q quat  Quaternion to create matrix from
  fromQuaternion(q: number[]): Matrix3;

  // Modifiers
  transpose(): Matrix3;
  invert(): Matrix3;

  // Operations
  multiplyLeft(a: Matrix3): Matrix3;
  multiplyRight(a: Matrix3): Matrix3;

  rotate(radians: number): Matrix3;

  scale(scale: number): Matrix3;
  scale([scaleX, scaleY, scaleZ]: number[]): Matrix3;

  translate(vec): Matrix3;

  // Transforms

  transform(vector: number[], result?: number[]): number[];

  // DEPRECATED IN 3.0
  transformVector(vector, result);
  transformVector2(vector, result);
  transformVector3(vector, result);
}
