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

import Vector from './base/vector';
import {config, isArray} from '../lib/common';
import {checkNumber} from '../lib/validators';

// @ts-ignore: error TS2307: Cannot find module 'gl-matrix/...'.
import * as vec3 from 'gl-matrix/vec3';
import {vec3_transformMat2, vec3_transformMat4AsVector} from '../lib/gl-matrix-extras';

const ORIGIN = [0, 0, 0];
const constants = {};

export default class Vector3 extends Vector {
  static get ZERO() {
    return (constants.ZERO = constants.ZERO || Object.freeze(new Vector3(0, 0, 0, 0)));
  }

  /**
   * @class
   * @param {Number | [Number, Number, Number]} x
   * @param {Number} y - rotation around X (latitude)
   * @param {Number} z - rotation around X (latitude)
   */
  constructor(x = 0, y = 0, z = 0) {
    // PERF NOTE: initialize elements as double precision numbers
    super(-0, -0, -0);
    if (arguments.length === 1 && isArray(x)) {
      this.copy(x);
    } else {
      // this.set(x, y, z);
      if (config.debug) {
        checkNumber(x);
        checkNumber(y);
        checkNumber(z);
      }
      // @ts-ignore TS2412: Property '0' of type 'number | [number, number, number]' is not assignable to numeric index type 'number'
      this[0] = x;
      this[1] = y;
      this[2] = z;
    }
  }

  set(x, y, z) {
    this[0] = x;
    this[1] = y;
    this[2] = z;
    return this.check();
  }

  copy(array) {
    this[0] = array[0];
    this[1] = array[1];
    this[2] = array[2];
    return this.check();
  }

  fromObject(object) {
    if (config.debug) {
      checkNumber(object.x);
      checkNumber(object.y);
      checkNumber(object.z);
    }
    this[0] = object.x;
    this[1] = object.y;
    this[2] = object.z;
    return this.check();
  }

  toObject(object) {
    object.x = this[0];
    object.y = this[1];
    object.z = this[2];
    return object;
  }

  // Getters/setters
  /* eslint-disable no-multi-spaces, brace-style, no-return-assign */
  get ELEMENTS() {
    return 3;
  }

  // x,y inherited from Vector

  get z() {
    return this[2];
  }
  set z(value) {
    this[2] = checkNumber(value);
  }
  /* eslint-enable no-multi-spaces, brace-style, no-return-assign */

  angle(vector) {
    return vec3.angle(this, vector);
  }

  // MODIFIERS

  cross(vector) {
    vec3.cross(this, this, vector);
    return this.check();
  }

  rotateX({radians, origin = ORIGIN}) {
    vec3.rotateX(this, this, origin, radians);
    return this.check();
  }

  rotateY({radians, origin = ORIGIN}) {
    vec3.rotateY(this, this, origin, radians);
    return this.check();
  }

  rotateZ({radians, origin = ORIGIN}) {
    vec3.rotateZ(this, this, origin, radians);
    return this.check();
  }

  // Transforms

  // transforms as point (4th component is implicitly 1)
  transform(matrix4) {
    return this.transformAsPoint(matrix4);
  }

  // transforms as point (4th component is implicitly 1)
  transformAsPoint(matrix4) {
    vec3.transformMat4(this, this, matrix4);
    return this.check();
  }

  // transforms as vector  (4th component is implicitly 0, ignores translation. slightly faster)
  transformAsVector(matrix4) {
    vec3_transformMat4AsVector(this, this, matrix4);
    return this.check();
  }

  transformByMatrix3(matrix3) {
    vec3.transformMat3(this, this, matrix3);
    return this.check();
  }

  transformByMatrix2(matrix2) {
    vec3_transformMat2(this, this, matrix2);
    return this.check();
  }

  transformByQuaternion(quaternion) {
    vec3.transformQuat(this, this, quaternion);
    return this.check();
  }
}
