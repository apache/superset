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

import {checkVector, deprecated} from '../lib/validators';
import Matrix from './base/matrix';

import {vec2_transformMat4AsVector, vec3_transformMat4AsVector} from '../lib/gl-matrix-extras';

// @ts-ignore: error TS2307: Cannot find module 'gl-matrix/...'.
import * as mat4 from 'gl-matrix/mat4';
// @ts-ignore: error TS2307: Cannot find module 'gl-matrix/...'.
import * as vec2 from 'gl-matrix/vec2';
// @ts-ignore: error TS2307: Cannot find module 'gl-matrix/...'.
import * as vec3 from 'gl-matrix/vec3';
// @ts-ignore: error TS2307: Cannot find module 'gl-matrix/...'.
import * as vec4 from 'gl-matrix/vec4';

const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const ZERO = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

const INDICES = Object.freeze({
  COL0ROW0: 0,
  COL0ROW1: 1,
  COL0ROW2: 2,
  COL0ROW3: 3,
  COL1ROW0: 4,
  COL1ROW1: 5,
  COL1ROW2: 6,
  COL1ROW3: 7,
  COL2ROW0: 8,
  COL2ROW1: 9,
  COL2ROW2: 10,
  COL2ROW3: 11,
  COL3ROW0: 12,
  COL3ROW1: 13,
  COL3ROW2: 14,
  COL3ROW3: 15
});

const constants = {};

export default class Matrix4 extends Matrix {
  static get IDENTITY() {
    constants.IDENTITY = constants.IDENTITY || Object.freeze(new Matrix4(IDENTITY));
    return constants.IDENTITY;
  }

  static get ZERO() {
    constants.ZERO = constants.ZERO || Object.freeze(new Matrix4(ZERO));
    return constants.ZERO;
  }

  get INDICES() {
    return INDICES;
  }

  get ELEMENTS() {
    return 16;
  }

  get RANK() {
    return 4;
  }

  constructor(array) {
    // PERF NOTE: initialize elements as double precision numbers
    super(-0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0);
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
    this[9] = array[9];
    this[10] = array[10];
    this[11] = array[11];
    this[12] = array[12];
    this[13] = array[13];
    this[14] = array[14];
    this[15] = array[15];
    return this.check();
  }

  // eslint-disable-next-line max-params
  set(m00, m10, m20, m30, m01, m11, m21, m31, m02, m12, m22, m32, m03, m13, m23, m33) {
    this[0] = m00;
    this[1] = m10;
    this[2] = m20;
    this[3] = m30;
    this[4] = m01;
    this[5] = m11;
    this[6] = m21;
    this[7] = m31;
    this[8] = m02;
    this[9] = m12;
    this[10] = m22;
    this[11] = m32;
    this[12] = m03;
    this[13] = m13;
    this[14] = m23;
    this[15] = m33;
    return this.check();
  }

  // accepts row major order, stores as column major
  // eslint-disable-next-line max-params
  setRowMajor(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
    this[0] = m00;
    this[1] = m10;
    this[2] = m20;
    this[3] = m30;
    this[4] = m01;
    this[5] = m11;
    this[6] = m21;
    this[7] = m31;
    this[8] = m02;
    this[9] = m12;
    this[10] = m22;
    this[11] = m32;
    this[12] = m03;
    this[13] = m13;
    this[14] = m23;
    this[15] = m33;
    return this.check();
  }

  toRowMajor(result) {
    result[0] = this[0];
    result[1] = this[4];
    result[2] = this[8];
    result[3] = this[12];
    result[4] = this[1];
    result[5] = this[5];
    result[6] = this[9];
    result[7] = this[13];
    result[8] = this[2];
    result[9] = this[6];
    result[10] = this[10];
    result[11] = this[14];
    result[12] = this[3];
    result[13] = this[7];
    result[14] = this[11];
    result[15] = this[15];
    return result;
  }

  // Constructors

  identity() {
    return this.copy(IDENTITY);
  }

  // Calculates a 4x4 matrix from the given quaternion
  // q quat  Quaternion to create matrix from
  fromQuaternion(q) {
    mat4.fromQuat(this, q);
    return this.check();
  }

  // Generates a frustum matrix with the given bounds
  // left  Number  Left bound of the frustum
  // right Number  Right bound of the frustum
  // bottom  Number  Bottom bound of the frustum
  // top Number  Top bound of the frustum
  // near  Number  Near bound of the frustum
  // far Number  Far bound of the frustum
  frustum({left, right, bottom, top, near, far}) {
    if (far === Infinity) {
      Matrix4._computeInfinitePerspectiveOffCenter(this, left, right, bottom, top, near);
    } else {
      mat4.frustum(this, left, right, bottom, top, near, far);
    }
    return this.check();
  }

  // eslint-disable-next-line max-params
  static _computeInfinitePerspectiveOffCenter(result, left, right, bottom, top, near) {
    const column0Row0 = (2.0 * near) / (right - left);
    const column1Row1 = (2.0 * near) / (top - bottom);
    const column2Row0 = (right + left) / (right - left);
    const column2Row1 = (top + bottom) / (top - bottom);
    const column2Row2 = -1.0;
    const column2Row3 = -1.0;
    const column3Row2 = -2.0 * near;

    result[0] = column0Row0;
    result[1] = 0.0;
    result[2] = 0.0;
    result[3] = 0.0;
    result[4] = 0.0;
    result[5] = column1Row1;
    result[6] = 0.0;
    result[7] = 0.0;
    result[8] = column2Row0;
    result[9] = column2Row1;
    result[10] = column2Row2;
    result[11] = column2Row3;
    result[12] = 0.0;
    result[13] = 0.0;
    result[14] = column3Row2;
    result[15] = 0.0;
    return result;
  }

  // Generates a look-at matrix with the given eye position, focal point,
  // and up axis
  // eye vec3  Position of the viewer
  // center  vec3  Point the viewer is looking at
  // up  vec3  vec3 pointing up
  lookAt(eye, center, up) {
    // Signature: lookAt({eye, center = [0, 0, 0], up = [0, 1, 0]}))
    if (arguments.length === 1) {
      ({eye, center, up} = eye);
    }

    center = center || [0, 0, 0];
    up = up || [0, 1, 0];

    mat4.lookAt(this, eye, center, up);
    return this.check();
  }

  // Generates a orthogonal projection matrix with the given bounds
  // from "traditional" view space parameters
  // left  number  Left bound of the frustum
  // right number  Right bound of the frustum
  // bottom  number  Bottom bound of the frustum
  // top number  Top bound of the frustum
  // near  number  Near bound of the frustum
  // far number  Far bound of the frustum
  ortho({left, right, bottom, top, near = 0.1, far = 500}) {
    mat4.ortho(this, left, right, bottom, top, near, far);
    return this.check();
  }

  // Generates an orthogonal projection matrix with the same parameters
  // as a perspective matrix (plus focalDistance)
  // fovy  number  Vertical field of view in radians
  // aspect  number  Aspect ratio. typically viewport width/height
  // focalDistance distance in the view frustum used for extent calculations
  // near  number  Near bound of the frustum
  // far number  Far bound of the frustum
  orthographic({
    fovy = (45 * Math.PI) / 180,
    aspect = 1,
    focalDistance = 1,
    near = 0.1,
    far = 500
  }) {
    if (fovy > Math.PI * 2) {
      throw Error('radians');
    }
    const halfY = fovy / 2;
    const top = focalDistance * Math.tan(halfY); // focus_plane is the distance from the camera
    const right = top * aspect;

    return new Matrix4().ortho({
      left: -right,
      right,
      bottom: -top,
      top,
      near,
      far
    });
  }

  // Generates a perspective projection matrix with the given bounds
  // fovy  number  Vertical field of view in radians
  // aspect  number  Aspect ratio. typically viewport width/height
  // near  number  Near bound of the frustum
  // far number  Far bound of the frustum
  perspective({
    fovy = undefined,
    fov = (45 * Math.PI) / 180, // DEPRECATED
    aspect = 1,
    near = 0.1,
    far = 500
  } = {}) {
    fovy = fovy || fov;
    if (fovy > Math.PI * 2) {
      throw Error('radians');
    }
    mat4.perspective(this, fovy, aspect, near, far);
    return this.check();
  }

  // Accessors

  determinant() {
    return mat4.determinant(this);
  }

  // Extracts the non-uniform scale assuming the matrix is an affine transformation.
  // The scales are the "lengths" of the column vectors in the upper-left 3x3 matrix.
  getScale(result = [-0, -0, -0]) {
    // explicit is faster than hypot...
    result[0] = Math.sqrt(this[0] * this[0] + this[1] * this[1] + this[2] * this[2]);
    result[1] = Math.sqrt(this[4] * this[4] + this[5] * this[5] + this[6] * this[6]);
    result[2] = Math.sqrt(this[8] * this[8] + this[9] * this[9] + this[10] * this[10]);
    // result[0] = Math.hypot(this[0], this[1], this[2]);
    // result[1] = Math.hypot(this[4], this[5], this[6]);
    // result[2] = Math.hypot(this[8], this[9], this[10]);
    return result;
  }

  // Gets the translation portion, assuming the matrix is a affine transformation matrix.
  getTranslation(result = [-0, -0, -0]) {
    result[0] = this[12];
    result[1] = this[13];
    result[2] = this[14];
    return result;
  }

  // Gets upper left 3x3 pure rotation matrix (non-scaling), assume affine transformation matrix
  getRotation(
    result = [-0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0, -0],
    scaleResult = null
  ) {
    const scale = this.getScale(scaleResult || [-0, -0, -0]);

    const inverseScale0 = 1 / scale[0];
    const inverseScale1 = 1 / scale[1];
    const inverseScale2 = 1 / scale[2];

    result[0] = this[0] * inverseScale0;
    result[1] = this[1] * inverseScale1;
    result[2] = this[2] * inverseScale2;
    result[3] = 0;
    result[4] = this[4] * inverseScale0;
    result[5] = this[5] * inverseScale1;
    result[6] = this[6] * inverseScale2;
    result[7] = 0;
    result[8] = this[8] * inverseScale0;
    result[9] = this[9] * inverseScale1;
    result[10] = this[10] * inverseScale2;
    result[11] = 0;
    result[12] = 0;
    result[13] = 0;
    result[14] = 0;
    result[15] = 1;
    return result;
  }

  getRotationMatrix3(result = [-0, -0, -0, -0, -0, -0, -0, -0, -0], scaleResult = null) {
    const scale = this.getScale(scaleResult || [-0, -0, -0]);

    const inverseScale0 = 1 / scale[0];
    const inverseScale1 = 1 / scale[1];
    const inverseScale2 = 1 / scale[2];

    result[0] = this[0] * inverseScale0;
    result[1] = this[1] * inverseScale1;
    result[2] = this[2] * inverseScale2;
    result[3] = this[4] * inverseScale0;
    result[4] = this[5] * inverseScale1;
    result[5] = this[6] * inverseScale2;
    result[6] = this[8] * inverseScale0;
    result[7] = this[9] * inverseScale1;
    result[8] = this[10] * inverseScale2;
    return result;
  }

  // Modifiers

  transpose() {
    mat4.transpose(this, this);
    return this.check();
  }

  invert() {
    mat4.invert(this, this);
    return this.check();
  }

  // Operations

  multiplyLeft(a) {
    mat4.multiply(this, a, this);
    return this.check();
  }

  multiplyRight(a) {
    mat4.multiply(this, this, a);
    return this.check();
  }

  // Rotates a matrix by the given angle around the X axis
  rotateX(radians) {
    mat4.rotateX(this, this, radians);
    // mat4.rotate(this, this, radians, [1, 0, 0]);
    return this.check();
  }

  // Rotates a matrix by the given angle around the Y axis.
  rotateY(radians) {
    mat4.rotateY(this, this, radians);
    // mat4.rotate(this, this, radians, [0, 1, 0]);
    return this.check();
  }

  // Rotates a matrix by the given angle around the Z axis.
  rotateZ(radians) {
    mat4.rotateZ(this, this, radians);
    // mat4.rotate(this, this, radians, [0, 0, 1]);
    return this.check();
  }

  rotateXYZ([rx, ry, rz]) {
    return this.rotateX(rx)
      .rotateY(ry)
      .rotateZ(rz);
  }

  rotateAxis(radians, axis) {
    mat4.rotate(this, this, radians, axis);
    return this.check();
  }

  scale(factor) {
    if (Array.isArray(factor)) {
      mat4.scale(this, this, factor);
    } else {
      mat4.scale(this, this, [factor, factor, factor]);
    }

    return this.check();
  }

  translate(vec) {
    mat4.translate(this, this, vec);
    return this.check();
  }

  // Transforms

  // Transforms any 2, 3 or 4 element vector. 2 and 3 elements are treated as points
  transform(vector, result) {
    if (vector.length === 4) {
      result = vec4.transformMat4(result || [-0, -0, -0, -0], vector, this);
      checkVector(result, 4);
      return result;
    }
    return this.transformAsPoint(vector, result);
  }

  // Transforms any 2 or 3 element array as point (w implicitly 1)
  transformAsPoint(vector, result) {
    const {length} = vector;
    switch (length) {
      case 2:
        result = vec2.transformMat4(result || [-0, -0], vector, this);
        break;
      case 3:
        result = vec3.transformMat4(result || [-0, -0, -0], vector, this);
        break;
      default:
        throw new Error('Illegal vector');
    }
    checkVector(result, vector.length);
    return result;
  }

  // Transforms any 2 or 3 element array as vector (w implicitly 0)
  transformAsVector(vector, result) {
    switch (vector.length) {
      case 2:
        result = vec2_transformMat4AsVector(result || [-0, -0], vector, this);
        break;
      case 3:
        result = vec3_transformMat4AsVector(result || [-0, -0, -0], vector, this);
        break;
      default:
        throw new Error('Illegal vector');
    }
    checkVector(result, vector.length);
    return result;
  }

  // three.js math API compatibility
  makeRotationX(radians) {
    return this.identity().rotateX(radians);
  }

  makeTranslation(x, y, z) {
    return this.identity().translate([x, y, z]);
  }

  // DEPRECATED in 3.0

  transformPoint(vector, result) {
    deprecated('Matrix4.transformPoint', '3.0');
    return this.transformAsPoint(vector, result);
  }

  transformVector(vector, result) {
    deprecated('Matrix4.transformVector', '3.0');
    return this.transformAsPoint(vector, result);
  }

  transformDirection(vector, result) {
    deprecated('Matrix4.transformDirection', '3.0');
    return this.transformAsVector(vector, result);
  }
}
