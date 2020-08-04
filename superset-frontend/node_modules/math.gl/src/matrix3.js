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
import {validateVector} from './lib/validators';
import {checkNumber} from './lib/common';
import Vector2 from './vector2';
import Vector3 from './vector3';

import * as mat3 from 'gl-matrix/mat3';
import * as vec2 from 'gl-matrix/vec2';
import * as vec3 from 'gl-matrix/vec3';

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// eslint-disable-next-line complexity
export function validateMatrix3(m) {
  return (
    m.length === 9 &&
    Number.isFinite(m[0]) &&
    Number.isFinite(m[1]) &&
    Number.isFinite(m[2]) &&
    Number.isFinite(m[3]) &&
    Number.isFinite(m[4]) &&
    Number.isFinite(m[5]) &&
    Number.isFinite(m[6]) &&
    Number.isFinite(m[7]) &&
    Number.isFinite(m[8])
  );
}

export default class Matrix3 extends MathArray {
  constructor(...args) {
    super(9);
    if (Array.isArray(args[0]) && arguments.length === 1) {
      this.copy(args[0]);
    } else {
      this.identity();
    }
  }

  get ELEMENTS() {
    return 9;
  }

  /* eslint-disable max-params */
  // accepts row major order, stores as column major
  setRowMajor(m00 = 1, m01 = 0, m02 = 0, m10 = 0, m11 = 1, m12 = 0, m20 = 0, m21 = 0, m22 = 1) {
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

  // accepts column major order, stores in column major order
  setColumnMajor(m00 = 1, m10 = 0, m20 = 0, m01 = 0, m11 = 1, m21 = 0, m02 = 0, m12 = 0, m22 = 1) {
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

  copy(array) {
    return this.setColumnMajor(...array);
  }

  set(...args) {
    return this.setColumnMajor(...args);
  }

  // By default assumes row major indices
  getElement(i, j, columnMajor = false) {
    return columnMajor ? this[i * 3 + j] : this[j * 3 + i];
  }

  // By default assumes row major indices
  setElement(i, j, value, columnMajor = false) {
    if (columnMajor) {
      this[i * 3 + j] = checkNumber(value);
    } else {
      this[j * 3 + i] = checkNumber(value);
    }
    return this;
  }

  // Accessors

  determinant() {
    return mat3.determinant(this);
  }

  // Constructors

  identity() {
    for (let i = 0; i < IDENTITY.length; ++i) {
      this[i] = IDENTITY[i];
    }
    return this.check();
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

  transformVector2(vector, out) {
    out = out || new Vector2();
    vec2.transformMat3(out, vector, this);
    validateVector(out, 2);
    return out;
  }

  transformVector3(vector, out) {
    out = out || new Vector3();
    vec3.transformMat3(out, vector, this);
    validateVector(out, 3);
    return out;
  }

  transformVector(vector, out) {
    switch (vector.length) {
      case 2:
        return this.transformVector2(vector, out);
      case 3:
        return this.transformVector3(vector, out);
      default:
        throw new Error('Illegal vector');
    }
  }
}
