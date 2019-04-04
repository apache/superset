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

// gl-matrix is too big. Cherry-pick individual imports from stack.gl version
/* eslint-disable camelcase */
import quat_fromMat3 from 'gl-quat/fromMat3';
import quat_identity from 'gl-quat/identity';
import quat_length from 'gl-quat/length';
import quat_squaredLength from 'gl-quat/squaredLength';
import quat_dot from 'gl-quat/dot';
// import quat_getAxisAngle from 'gl-quat/getAxisAngle';
import quat_rotationTo from 'gl-quat/rotationTo';
import quat_add from 'gl-quat/add';
import quat_calculateW from 'gl-quat/calculateW';
import quat_conjugate from 'gl-quat/conjugate';
import quat_invert from 'gl-quat/invert';
import quat_lerp from 'gl-quat/lerp';
import quat_multiply from 'gl-quat/multiply';
import quat_normalize from 'gl-quat/normalize';
import quat_rotateX from 'gl-quat/rotateX';
import quat_rotateY from 'gl-quat/rotateY';
import quat_rotateZ from 'gl-quat/rotateZ';
import quat_scale from 'gl-quat/scale';
import quat_set from 'gl-quat/set';
import quat_setAxisAngle from 'gl-quat/setAxisAngle';
import quat_slerp from 'gl-quat/slerp';

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
  // Creates a new identity quat
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
    quat_fromMat3(this, m);
    return this.check();
  }

  // Creates a new quat initialized with the given values
  fromValues(x, y, z, w) {
    return this.set(x, y, z, w);
  }

  // Set a quat to the identity quaternion
  identity() {
    quat_identity(this);
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
    return quat_length(this);
  }

  // Calculates the squared length of a quat
  squaredLength(a) {
    return quat_squaredLength(this);
  }

  // Calculates the dot product of two quat's
  // @return {Number}
  dot(a, b) {
    if (b !== undefined) {
      throw new Error('Quaternion.dot only takes one argument');
    }
    return quat_dot(this, a);
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
  //   const angle = quat_getAxisAngle(axis, this);
  //   return {axis, angle};
  // }

  // MODIFIERS

  // Sets a quaternion to represent the shortest rotation from one vector
  // to another. Both vectors are assumed to be unit length.
  rotationTo(vectorA, vectorB) {
    quat_rotationTo(this, vectorA, vectorB);
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
    quat_add(this, a);
    return this.check();
  }

  // Calculates the W component of a quat from the X, Y, and Z components.
  // Any existing W component will be ignored.
  calculateW() {
    quat_calculateW(this, this);
    return this.check();
  }

  // Calculates the conjugate of a quat If the quaternion is normalized,
  // this function is faster than quat_inverse and produces the same result.
  conjugate() {
    quat_conjugate(this, this);
    return this.check();
  }

  // Calculates the inverse of a quat
  invert() {
    quat_invert(this, this);
    return this.check();
  }

  // Performs a linear interpolation between two quat's
  lerp(a, b, t) {
    quat_lerp(this, a, b, t);
    return this.check();
  }

  // Multiplies two quat's
  multiply(a, b) {
    if (b !== undefined) {
      throw new Error('Quaternion.multiply only takes one argument');
    }
    quat_multiply(this, this, b);
    return this.check();
  }

  // Normalize a quat
  normalize() {
    quat_normalize(this, this);
    return this.check();
  }

  // Rotates a quaternion by the given angle about the X axis
  rotateX(rad) {
    quat_rotateX(this, this, rad);
    return this.check();
  }

  // Rotates a quaternion by the given angle about the Y axis
  rotateY(rad) {
    quat_rotateY(this, this, rad);
    return this.check();
  }

  // Rotates a quaternion by the given angle about the Z axis
  rotateZ(rad) {
    quat_rotateZ(this, this, rad);
    return this.check();
  }

  // Scales a quat by a scalar number
  scale(b) {
    quat_scale(this, this, b);
    return this.check();
  }

  // Set the components of a quat to the given values
  set(i, j, k, l) {
    quat_set(this, i, j, k, l);
    return this.check();
  }

  // Sets a quat from the given angle and rotation axis, then returns it.
  setAxisAngle(axis, rad) {
    quat_setAxisAngle(this, axis, rad);
    return this.check();
  }

  // Performs a spherical linear interpolation between two quat
  slerp({start = IDENTITY_QUATERNION, target, ratio}) {
    quat_slerp(this, start, target, ratio);
    return this.check();
  }
}
