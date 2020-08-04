import Vector from './base/vector';

/** Four-element vector class */
export default class Vector4 extends Vector<Vector4> {
  static ZERO: number[];

  ELEMENTS: number;

  /** construct a new Vector4 initialize to [0, 0, 0, 0] */
  constructor();
  /** construct a new Vector4 initialize to ...x, y, z, w */
  constructor(x: number, y: number, z: number, w: number);
  /** construct a new Vector4 initialize to array [x, y, z, w] */
  constructor(array: readonly number[]);

  set(x, y, z, w);

  copy(array);

  fromObject(object);

  toObject(object);

  // x,y inherited from Vector
  z: number;
  w: number;

  transform(matrix4: readonly number[]): Vector4;
  transformByMatrix3(matrix3: readonly number[]): Vector4;
  transformByMatrix2(matrix2: readonly number[]): Vector4;
  transformByQuaternion(quaternion: readonly number[]): Vector4;

  // three.js compatibility
  applyMatrix4(m: readonly number[]): Vector4;
}
