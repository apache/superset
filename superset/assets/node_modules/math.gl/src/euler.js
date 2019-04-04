// Copyright (c) 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import MathArray from './lib/math-array';
import {checkNumber, clamp} from './lib/common';
import Matrix4 from './matrix4';
import Quaternion from './quaternion';
import Vector3 from './vector3';

// Internal constants
const ERR_UNKNOWN_ORDER = 'Unknown Euler angle order';
const ALMOST_ONE = 0.99999;

function validateOrder(value) {
  return value >= 0 && value < 6;
}

function checkOrder(value) {
  if (value < 0 && value >= 6) {
    throw new Error(ERR_UNKNOWN_ORDER);
  }
  return value;
}

export default class Euler extends MathArray {
  // static XYZ = 0;
  // static YZX = 1;
  // static ZXY = 2;
  // static XZY = 3;
  // static YXZ = 4;
  // static ZYX = 5;
  // static RollPitchYaw = 0;
  // static DefaultOrder = 0;

  // Constants
  /* eslint-disable no-multi-spaces, brace-style, no-return-assign */
  static get ZYX() {
    return 0;
  }
  static get YXZ() {
    return 1;
  }
  static get XZY() {
    return 2;
  }
  static get ZXY() {
    return 3;
  }
  static get YZX() {
    return 4;
  }
  static get XYZ() {
    return 5;
  }
  static get RollPitchYaw() {
    return 0;
  }

  static get DefaultOrder() {
    return Euler.ZYX;
  }
  static get RotationOrders() {
    return ['ZYX', 'YXZ', 'XZY', 'ZXY', 'YZX', 'XYZ'];
  }
  static rotationOrder(order) {
    return Euler.RotationOrders[order];
  }

  get ELEMENTS() {
    return 4;
  }
  /* eslint-enable no-multi-spaces, brace-style, no-return-assign */

  /*
   * Number|Number[], Number, Number, Number
   */
  constructor(x = 0, y = 0, z = 0, order = Euler.DefaultOrder) {
    super();
    if (arguments.length > 0 && Array.isArray(arguments[0])) {
      this.fromVector3(...arguments);
    } else {
      this.set(x, y, z, order);
    }
  }

  // If copied array does contain fourth element, preserves currently set order
  copy(array) {
    for (let i = 0; i < 3; ++i) {
      this[i] = array[i];
    }
    this[3] = Number.isFinite(array[3]) || this.order;
    return this.check();
  }

  // Sets the three angles, and optionally sets the rotation order
  // If order is not specified, preserves currently set order
  set(x = 0, y = 0, z = 0, order) {
    this[0] = x;
    this[1] = y;
    this[2] = z;
    this[3] = Number.isFinite(order) ? order : this[3];
    return this.check();
  }

  validate() {
    return (
      validateOrder(this[3]) &&
      Number.isFinite(this[0]) &&
      Number.isFinite(this[1]) &&
      Number.isFinite(this[2])
    );
  }

  // Does not copy the orientation element
  toArray(array = [], offset = 0) {
    array[offset] = this[0];
    array[offset + 1] = this[1];
    array[offset + 2] = this[2];
    return array;
  }

  // Copies the orientation element
  toArray4(array = [], offset = 0) {
    array[offset] = this[0];
    array[offset + 1] = this[1];
    array[offset + 2] = this[2];
    array[offset + 3] = this[3];
    return array;
  }

  toVector3(optionalResult) {
    if (optionalResult) {
      return optionalResult.set(this[0], this[1], this[2]);
    }
    return new Vector3(this[0], this[1], this[2]);
  }

  /* eslint-disable no-multi-spaces, brace-style, no-return-assign */
  // x, y, z angle notation (note: only corresponds to axis in XYZ orientation)
  get x() {
    return this[0];
  }
  set x(value) {
    return (this[0] = checkNumber(value));
  }
  get y() {
    return this[1];
  }
  set y(value) {
    return (this[1] = checkNumber(value));
  }
  get z() {
    return this[2];
  }
  set z(value) {
    return (this[2] = checkNumber(value));
  }

  // alpha, beta, gamma angle notation
  get alpha() {
    return this[0];
  }
  set alpha(value) {
    return (this[0] = checkNumber(value));
  }
  get beta() {
    return this[1];
  }
  set beta(value) {
    return (this[1] = checkNumber(value));
  }
  get gamma() {
    return this[2];
  }
  set gamma(value) {
    return (this[2] = checkNumber(value));
  }

  // phi, theta, psi angle notation
  get phi() {
    return this[0];
  }
  set phi(value) {
    return (this[0] = checkNumber(value));
  }
  get theta() {
    return this[1];
  }
  set theta(value) {
    return (this[1] = checkNumber(value));
  }
  get psi() {
    return this[2];
  }
  set psi(value) {
    return (this[2] = checkNumber(value));
  }

  // roll, pitch, yaw angle notation
  get roll() {
    return this[0];
  }
  set roll(value) {
    return (this[0] = checkNumber(value));
  }
  get pitch() {
    return this[1];
  }
  set pitch(value) {
    return (this[1] = checkNumber(value));
  }
  get yaw() {
    return this[2];
  }
  set yaw(value) {
    return (this[2] = checkNumber(value));
  }

  // rotation order, in all three angle notations
  get order() {
    return this[3];
  }
  set order(value) {
    return (this[3] = checkOrder(value));
  }
  /* eslint-disable no-multi-spaces, brace-style, no-return-assign */

  // Constructors
  fromVector3(v, order) {
    return this.set(v[0], v[1], v[2], Number.isFinite(order) ? order : this[3]);
  }

  // TODO - with and without 4th element
  fromArray(array, offset = 0) {
    this[0] = array[0 + offset];
    this[1] = array[1 + offset];
    this[2] = array[2 + offset];
    if (array[3] !== undefined) {
      this[3] = array[3];
    }
    return this.check();
  }

  // Common ZYX rotation order
  fromRollPitchYaw(roll, pitch, yaw) {
    return this.set(roll, pitch, yaw, Euler.ZYX);
  }

  fromQuaternion(q, order) {
    this._fromRotationMatrix(Matrix4.fromQuaternion(q), order);
    return this.check();
  }

  fromRotationMatrix(m, order = Euler.DefaultOrder) {
    this._fromRotationMatrix(m, order);
    return this.check();
  }

  // ACCESSORS

  // @return {Matrix4} a rotation matrix corresponding to rotations
  //   per the specified euler angles
  getRotationMatrix(m = new Matrix4()) {
    this._getRotationMatrix(m);
    return m;
  }

  getQuaternion() {
    const q = new Quaternion();
    switch (this[4]) {
      case Euler.XYZ:
        return q
          .rotateX(this[0])
          .rotateY(this[1])
          .rotateZ(this[2]);
      case Euler.YXZ:
        return q
          .rotateY(this[0])
          .rotateX(this[1])
          .rotateZ(this[2]);
      case Euler.ZXY:
        return q
          .rotateZ(this[0])
          .rotateX(this[1])
          .rotateY(this[2]);
      case Euler.ZYX:
        return q
          .rotateZ(this[0])
          .rotateY(this[1])
          .rotateX(this[2]);
      case Euler.YZX:
        return q
          .rotateY(this[0])
          .rotateZ(this[1])
          .rotateX(this[2]);
      case Euler.XZY:
        return q
          .rotateX(this[0])
          .rotateZ(this[1])
          .rotateY(this[2]);
      default:
        throw new Error(ERR_UNKNOWN_ORDER);
    }
  }

  // INTERNAL METHODS

  // Concersion from Euler to rotation matrix and from matrix to Euler
  // Adapted from three.js under MIT license

  // // WARNING: this discards revolution information -bhouston
  // reorder(newOrder) {
  //   const q = new Quaternion().setFromEuler(this);
  //   return this.setFromQuaternion(q, newOrder);

  /* eslint-disable complexity, max-statements, one-var */
  _fromRotationMatrix(m, order = Euler.DefaultOrder) {
    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

    const te = m.elements;
    const m11 = te[0],
      m12 = te[4],
      m13 = te[8];
    const m21 = te[1],
      m22 = te[5],
      m23 = te[9];
    const m31 = te[2],
      m32 = te[6],
      m33 = te[10];

    order = order || this[3];

    switch (order) {
      case Euler.XYZ:
        this[1] = Math.asin(clamp(m13, -1, 1));

        if (Math.abs(m13) < ALMOST_ONE) {
          this[0] = Math.atan2(-m23, m33);
          this[2] = Math.atan2(-m12, m11);
        } else {
          this[0] = Math.atan2(m32, m22);
          this[2] = 0;
        }
        break;

      case Euler.YXZ:
        this[0] = Math.asin(-clamp(m23, -1, 1));

        if (Math.abs(m23) < ALMOST_ONE) {
          this[1] = Math.atan2(m13, m33);
          this[2] = Math.atan2(m21, m22);
        } else {
          this[1] = Math.atan2(-m31, m11);
          this[2] = 0;
        }
        break;

      case Euler.ZXY:
        this[0] = Math.asin(clamp(m32, -1, 1));

        if (Math.abs(m32) < ALMOST_ONE) {
          this[1] = Math.atan2(-m31, m33);
          this[2] = Math.atan2(-m12, m22);
        } else {
          this[1] = 0;
          this[2] = Math.atan2(m21, m11);
        }
        break;

      case Euler.ZYX:
        this[1] = Math.asin(-clamp(m31, -1, 1));

        if (Math.abs(m31) < ALMOST_ONE) {
          this[0] = Math.atan2(m32, m33);
          this[2] = Math.atan2(m21, m11);
        } else {
          this[0] = 0;
          this[2] = Math.atan2(-m12, m22);
        }
        break;

      case Euler.YZX:
        this[2] = Math.asin(clamp(m21, -1, 1));

        if (Math.abs(m21) < ALMOST_ONE) {
          this[0] = Math.atan2(-m23, m22);
          this[1] = Math.atan2(-m31, m11);
        } else {
          this[0] = 0;
          this[1] = Math.atan2(m13, m33);
        }
        break;

      case Euler.XZY:
        this[2] = Math.asin(-clamp(m12, -1, 1));

        if (Math.abs(m12) < ALMOST_ONE) {
          this[0] = Math.atan2(m32, m22);
          this[1] = Math.atan2(m13, m11);
        } else {
          this[0] = Math.atan2(-m23, m33);
          this[1] = 0;
        }
        break;

      default:
        throw new Error(ERR_UNKNOWN_ORDER);
    }

    this[3] = order;

    return this;
  }

  _getRotationMatrix() {
    const te = new Matrix4();

    const x = this.x,
      y = this.y,
      z = this.z;
    const a = Math.cos(x);
    const c = Math.cos(y);
    const e = Math.cos(z);
    const b = Math.sin(x);
    const d = Math.sin(y);
    const f = Math.sin(z);

    switch (this[3]) {
      case Euler.XYZ: {
        const ae = a * e,
          af = a * f,
          be = b * e,
          bf = b * f;

        te[0] = c * e;
        te[4] = -c * f;
        te[8] = d;

        te[1] = af + be * d;
        te[5] = ae - bf * d;
        te[9] = -b * c;

        te[2] = bf - ae * d;
        te[6] = be + af * d;
        te[10] = a * c;
        break;
      }

      case Euler.YXZ: {
        const ce = c * e,
          cf = c * f,
          de = d * e,
          df = d * f;

        te[0] = ce + df * b;
        te[4] = de * b - cf;
        te[8] = a * d;

        te[1] = a * f;
        te[5] = a * e;
        te[9] = -b;

        te[2] = cf * b - de;
        te[6] = df + ce * b;
        te[10] = a * c;
        break;
      }

      case Euler.ZXY: {
        const ce = c * e,
          cf = c * f,
          de = d * e,
          df = d * f;

        te[0] = ce - df * b;
        te[4] = -a * f;
        te[8] = de + cf * b;

        te[1] = cf + de * b;
        te[5] = a * e;
        te[9] = df - ce * b;

        te[2] = -a * d;
        te[6] = b;
        te[10] = a * c;
        break;
      }

      case Euler.ZYX: {
        const ae = a * e,
          af = a * f,
          be = b * e,
          bf = b * f;

        te[0] = c * e;
        te[4] = be * d - af;
        te[8] = ae * d + bf;

        te[1] = c * f;
        te[5] = bf * d + ae;
        te[9] = af * d - be;

        te[2] = -d;
        te[6] = b * c;
        te[10] = a * c;
        break;
      }

      case Euler.YZX: {
        const ac = a * c,
          ad = a * d,
          bc = b * c,
          bd = b * d;

        te[0] = c * e;
        te[4] = bd - ac * f;
        te[8] = bc * f + ad;

        te[1] = f;
        te[5] = a * e;
        te[9] = -b * e;

        te[2] = -d * e;
        te[6] = ad * f + bc;
        te[10] = ac - bd * f;
        break;
      }

      case Euler.XZY: {
        const ac = a * c,
          ad = a * d,
          bc = b * c,
          bd = b * d;

        te[0] = c * e;
        te[4] = -f;
        te[8] = d * e;

        te[1] = ac * f + bd;
        te[5] = a * e;
        te[9] = ad * f - bc;

        te[2] = bc * f - ad;
        te[6] = b * e;
        te[10] = bd * f + ac;
        break;
      }

      default:
        throw new Error(ERR_UNKNOWN_ORDER);
    }

    // last column
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;

    // bottom row
    te[12] = 0;
    te[13] = 0;
    te[14] = 0;
    te[15] = 1;

    return this;
  }
  /* eslint-enable complexity, max-statements, one-var */
}
