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
import * as vec2 from 'gl-matrix/vec2';
import {vec2_transformMat4AsVector} from '../lib/gl-matrix-extras';

export default class Vector2 extends Vector {
  // Creates a new, empty vec2
  constructor(x = 0, y = 0) {
    // PERF NOTE: initialize elements as double precision numbers
    super(2); // -0, -0);
    if (isArray(x) && arguments.length === 1) {
      this.copy(x);
    } else {
      if (config.debug) {
        checkNumber(x);
        checkNumber(y);
      }
      this[0] = x;
      this[1] = y;
    }
  }

  set(x, y) {
    this[0] = x;
    this[1] = y;
    return this.check();
  }

  copy(array) {
    this[0] = array[0];
    this[1] = array[1];
    return this.check();
  }

  fromObject(object) {
    if (config.debug) {
      checkNumber(object.x);
      checkNumber(object.y);
    }
    this[0] = object.x;
    this[1] = object.y;
    return this.check();
  }

  toObject(object) {
    object.x = this[0];
    object.y = this[1];
    return object;
  }

  // Getters/setters
  get ELEMENTS() {
    return 2;
  }

  // x,y inherited from Vector

  horizontalAngle() {
    return Math.atan2(this.y, this.x);
  }

  verticalAngle() {
    return Math.atan2(this.x, this.y);
  }

  // Transforms

  transform(matrix4) {
    return this.transformAsPoint(matrix4);
  }

  // transforms as point (4th component is implicitly 1)
  transformAsPoint(matrix4) {
    vec2.transformMat4(this, this, matrix4);
    return this.check();
  }

  // transforms as vector  (4th component is implicitly 0, ignores translation. slightly faster)
  transformAsVector(matrix4) {
    vec2_transformMat4AsVector(this, this, matrix4);
    return this.check();
  }

  transformByMatrix3(matrix3) {
    vec2.transformMat3(this, this, matrix3);
    return this.check();
  }

  transformByMatrix2x3(matrix2x3) {
    vec2.transformMat2d(this, this, matrix2x3);
    return this.check();
  }

  transformByMatrix2(matrix2) {
    vec2.transformMat2(this, this, matrix2);
    return this.check();
  }
}
