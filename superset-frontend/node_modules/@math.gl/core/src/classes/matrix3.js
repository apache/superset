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

import Matrix from './base/matrix';
import {checkVector, deprecated} from '../lib/validators';
import {vec4_transformMat3} from '../lib/gl-matrix-extras';

// @ts-ignore: error TS2307: Cannot find module 'gl-matrix/...'.
import * as mat3 from 'gl-matrix/mat3';
// @ts-ignore: error TS2307: Cannot find module 'gl-matrix/...'.
import * as vec2 from 'gl-matrix/vec2';
// @ts-ignore: error TS2307: Cannot find module 'gl-matrix/...'.
import * as vec3 from 'gl-matrix/vec3';

const IDENTITY = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const ZERO = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0]);

const INDICES = Object.freeze({
  COL0ROW0: 0,
  COL0ROW1: 1,
  COL0ROW2: 2,
  COL1ROW0: 3,
  COL1ROW1: 4,
  COL1ROW2: 5,
  COL2ROW0: 6,
  COL2ROW1: 7,
  COL2ROW2: 8
});

const constants = {};

export default class Matrix3 extends Matrix {
  static get IDENTITY() {
    constants.IDENTITY = constants.IDENTITY || Object.freeze(new Matrix3(IDENTITY));
    return constants.IDENTITY;
  }

  static get ZERO() {
    constants.ZERO = constants.ZERO || Object.freeze(new Matrix3(ZERO));
    return constants.ZERO;
  }

  get ELEMENTS() {
    return 9;
  }

  get RANK() {
    return 3;
  }

  get INDICES() {
    return INDICES;
  }

  constructor(array) {
    // PERF NOTE: initialize elements as double precision numbers
    super(-0, -0, -0, -0, -0, -0, -0, -0, -0);
    if (arguments.length === 1 && Array.isArray(array)) {
      this.copy(array);
    } else {
      this.identity();
    }
  }

  copy(array) {
    this[0] = array[0];
    this[1] = array[1];
    this[2] = array[2];
    this[3] = array[3];
    this[4] = array[4];
    this[5] = array[5];
    this[6] = array[6];
    this[7] = array[7];
    this[8] = array[8];
    return this.check();
  }

  // accepts column major order, stores in column major order
  // eslint-disable-next-line max-params
  set(m00, m10, m20, m01, m11, m21, m02, m12, m22) {
    this[0] = m00;
    this[1] = m10;
    this[2] = m20;
    this[3] = m01;
    this[4] = m11;
    this[5] = m21;
    this[6] = m02;
    this[7] = m12;
    this[8] = m22;
    return this.check();
  }

  // accepts row major order, stores as column major
  // eslint-disable-next-line max-params
  setRowMajor(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
    this[0] = m00;
    this[1] = m10;
    this[2] = m20;
    this[3] = m01;
    this[4] = m11;
    this[5] = m21;
    this[6] = m02;
    this[7] = m12;
    this[8] = m22;
    return this.check();
  }

  // Accessors

  determinant() {
    return mat3.determinant(this);
  }

  // Constructors

  identity() {
    return this.copy(IDENTITY);
  }

  // Calculates a 3x3 matrix from the given quaternion
  // q quat  Quaternion to create matrix from
  fromQuaternion(q) {
    mat3.fromQuat(this, q);
    return this.check();
  }

  // Modifiers

  transpose() {
    mat3.transpose(this, this);
    return this.check();
  }

  invert() {
    mat3.invert(this, this);
    return this.check();
  }

  // Operations

  multiplyLeft(a) {
    mat3.multiply(this, a, this);
    return this.check();
  }

  multiplyRight(a) {
    mat3.multiply(this, this, a);
    return this.check();
  }

  rotate(radians) {
    mat3.rotate(this, this, radians);
    return this.check();
  }

  scale(factor) {
    if (Array.isArray(factor)) {
      mat3.scale(this, this, factor);
    } else {
      mat3.scale(this, this, [factor, factor, factor]);
    }

    return this.check();
  }

  translate(vec) {
    mat3.translate(this, this, vec);
    return this.check();
  }

  // Transforms

  transform(vector, result) {
    switch (vector.length) {
      case 2:
        result = vec2.transformMat3(result || [-0, -0], vector, this);
        break;
      case 3:
        result = vec3.transformMat3(result || [-0, -0, -0], vector, this);
        break;
      case 4:
        result = vec4_transformMat3(result || [-0, -0, -0, -0], vector, this);
        break;
      default:
        throw new Error('Illegal vector');
    }
    checkVector(result, vector.length);
    return result;
  }

  // DEPRECATED IN 3.0

  transformVector(vector, result) {
    deprecated('Matrix3.transformVector');
    return this.transform(vector, result);
  }

  transformVector2(vector, result) {
    deprecated('Matrix3.transformVector');
    return this.transform(vector, result);
  }

  transformVector3(vector, result) {
    deprecated('Matrix3.transformVector');
    return this.transform(vector, result);
  }
}
