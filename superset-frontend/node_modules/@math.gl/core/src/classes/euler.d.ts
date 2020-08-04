import MathArray from './base/math-array';
import Quaternion from './quaternion';
import Matrix3 from './matrix3';

export default class Euler extends MathArray<Euler> {
  static ZYX: number;
  static YXZ: number;
  static XZY: number;
  static ZXY: number;
  static YZX: number;
  static XYZ: number;
  static RollPitchYaw: number;
  static DefaultOrder: number;
  static RotationOrders: string[];

  static rotationOrder(order: number): string;

  ELEMENTS: number;

  /**
   * @class
   * @param {Number | Number[]} x
   * @param {Number=} [y]
   * @param {Number=} [z]
   * @param {Number=} [order]
   */
  constructor();
  constructor(x: number, y: number, z: number, order?: number);
  constructor(vector3: number[], order?: number);

  fromQuaternion(quaternion: Quaternion): Euler;

  // If copied array does contain fourth element, preserves currently set order
  copy(array: number[]): Euler;

  // Sets the three angles, and optionally sets the rotation order
  // If order is not specified, preserves currently set order
  set(x: number, y: number, z: number, order?: number): Euler;

  validate(): boolean;

  // Does not copy the orientation element
  toArray(array?: number[], offset?: number): number[];

  // Copies the orientation element
  toArray4(array?: number[], offset?: number): number[];

  toVector3(result?: number[]): number[];

  // x, y, z angle notation (note: only corresponds to axis in XYZ orientation)
  x: number;
  y: number;
  z: number;

  // alpha, beta, gamma angle notation
  alpha: number;
  beta: number;
  gamma: number;

  // phi, theta, psi angle notation
  phi: number;
  theta: number;
  psi: number;

  // roll, pitch, yaw angle notation
  roll: number;
  pitch: number;
  yaw: number;

  // rotation order, in all three angle notations
  order: number;

  /* eslint-disable no-multi-spaces, brace-style, no-return-assign */

  // Constructors
  fromVector3(v: number[], order: number): Euler;
  // TODO - with and without 4th element
  fromArray(array: number[], offset?: number): Euler;

  // Common ZYX rotation order
  fromRollPitchYaw(roll: number, pitch: number, yaw: number): Euler;
  fromRotationMatrix(m: number[], order?: number): Euler;

  // ACCESSORS

  getRotationMatrix(m: Matrix3): Matrix3;
  getRotationMatrix(m?: number[]): number[];

  // TODO - move to Quaternion
  getQuaternion(): Quaternion;
  toQuaternion(): Quaternion;
}
