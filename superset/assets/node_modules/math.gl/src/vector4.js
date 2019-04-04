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

import Vector from './lib/vector';
import {checkNumber} from './lib/common';

export default class Vector4 extends Vector {
  // Creates a new, empty vec4
  constructor(x = 0, y = 0, z = 0, w = 0) {
    super();
    if (Array.isArray(x) && arguments.length === 1) {
      this.copy(x);
    } else {
      this.set(x, y, z, w);
    }
  }

  // Getters/setters
  /* eslint-disable no-multi-spaces, brace-style, no-return-assign */
  get ELEMENTS() {
    return 4;
  }

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

  get w() {
    return this[3];
  }

  set w(value) {
    return (this[3] = checkNumber(value));
  }
  /* eslint-enable no-multi-spaces, brace-style, no-return-assign */

  // three.js compatibility
  applyMatrix4(m) {
    m.transformVector(this, this);
    return this;
  }
}
