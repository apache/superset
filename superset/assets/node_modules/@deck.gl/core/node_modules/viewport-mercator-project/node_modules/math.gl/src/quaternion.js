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
import {checkNumber} from './lib/common';

import * as quat from 'gl-matrix/quat';

const IDENTITY_QUATERNION = [0, 0, 0, 1];

export function validateQuaternion(q) {
  return (
    q.length === 4 &&
    Number.isFinite(q[0]) &&
    Number.isFinite(q[1]) &&
    Number.isFinite(q[2]) &&
    Number.isFinite(q[3])
  );
}

export default class Quaternion extends MathArray {
  // Creates a new identity quaternion
  // w^2 + x^2 + y^2 + z^2 = 1
  constructor(x = 0, y = 0, z = 0, w = 1) {
    super();
    if (Array.isArray(x) && arguments.length === 1) {
      this.copy(x);
    } else {
      this.set(x, y, z, w);
    }
  }

  // Creates a quaternion from the given 3x3 rotation matrix.
  // NOTE: The resultant quaternion is not normalized, so you should
  // be sure to renormalize the quaternion yourself where necessary.
  fromMatrix3(m) {
    quat.fromMat3(this, m);
    return this.check();
  }

  // Creates a new quat initialized with the given values
  fromValues(x, y, z, w) {
    return this.set(x, y, z, w);
  }

  // Set a quat to the identity quaternion
  identity() {
    quat.identity(this);
    return this.check();
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

  // Calculates the length of a quat
  length() {
    return quat.length(this);
  }

  // Calculates the squared length of a quat
  squaredLength(a) {
    return quat.squaredLength(this);
  }

  // Calculates the dot product of two quat's
  // @return {Number}
  dot(a, b) {
    if (b !== undefined) {
      throw new Error('Quaternion.dot only takes one argument');
    }
    return quat.dot(this, a);
  }

  // Gets the rotation axis and angle for a given quaternion.
  // If a quaternion is created with setAxisAngle, this method will
  // return the same values as providied in the original parameter
  // list OR functionally equivalent values.
  // Example: The quaternion formed by axis [0, 0, 1] and angle -90
  // is the same as the quaternion formed by [0, 0, 1] and 270.
  // This method favors the latter.
  // @return {{[x,y,z], Number}}
  // getAxisAngle() {
  //   const axis = [];
  //   const angle = quat.getAxisAngle(axis, this);
  //   return {axis, angle};
  // }

  // MODIFIERS

  // Sets a quaternion to represent the shortest rotation from one vector
  // to another. Both vectors are assumed to be unit length.
  rotationTo(vectorA, vectorB) {
    quat.rotationTo(this, vectorA, vectorB);
    return this.check();
  }

  // Sets the specified quaternion with values corresponding to the given axes.
  // Each axis is a vec3 and is expected to be unit length and perpendicular
  // to all other specified axes.
  // setAxes() {
  //   Number
  // }

  // Performs a spherical linear interpolation with two control points
  // sqlerp() {
  //   Number;
  // }

  // Adds two quat's
  add(a, b) {
    if (b !== undefined) {
      throw new Error('Quaternion.add only takes one argument');
    }
    quat.add(this, a);
    return this.check();
  }

  // Calculates the W component of a quat from the X, Y, and Z components.
  // Any existing W component will be ignored.
  calculateW() {
    quat.calculateW(this, this);
    return this.check();
  }

  // Calculates the conjugate of a quat If the quaternion is normalized,
  // this function is faster than quat.inverse and produces the same result.
  conjugate() {
    quat.conjugate(this, this);
    return this.check();
  }

  // Calculates the inverse of a quat
  invert() {
    quat.invert(this, this);
    return this.check();
  }

  // Performs a linear interpolation between two quat's
  lerp(a, b, t) {
    quat.lerp(this, a, b, t);
    return this.check();
  }

  // Multiplies two quat's
  multiply(a, b) {
    if (b !== undefined) {
      throw new Error('Quaternion.multiply only takes one argument');
    }
    quat.multiply(this, this, a);
    return this.check();
  }

  // Normalize a quat
  normalize() {
    quat.normalize(this, this);
    return this.check();
  }

  // Rotates a quaternion by the given angle about the X axis
  rotateX(rad) {
    quat.rotateX(this, this, rad);
    return this.check();
  }

  // Rotates a quaternion by the given angle about the Y axis
  rotateY(rad) {
    quat.rotateY(this, this, rad);
    return this.check();
  }

  // Rotates a quaternion by the given angle about the Z axis
  rotateZ(rad) {
    quat.rotateZ(this, this, rad);
    return this.check();
  }

  // Scales a quat by a scalar number
  scale(b) {
    quat.scale(this, this, b);
    return this.check();
  }

  // Set the components of a quat to the given values
  set(i, j, k, l) {
    quat.set(this, i, j, k, l);
    return this.check();
  }

  // Sets a quat from the given angle and rotation axis, then returns it.
  setAxisAngle(axis, rad) {
    quat.setAxisAngle(this, axis, rad);
    return this.check();
  }

  // Performs a spherical linear interpolation between two quat
  slerp({start = IDENTITY_QUATERNION, target, ratio}) {
    quat.slerp(this, start, target, ratio);
    return this.check();
  }
}
