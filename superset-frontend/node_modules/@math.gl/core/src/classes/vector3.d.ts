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

/** Three-element vector class */
export default class Vector3 extends Vector<Vector3> {
  static readonly ZERO: Vector3;
  readonly ELEMENTS: number;

  constructor();
  constructor(array: readonly number[]);
  constructor(x: number, y: number, z: number);

  set(x: number, y: number, z: number);

  copy(array: readonly number[]);

  fromObject(object);
  toObject(object);

  // x,y inherited from Vector

  z: number;

  // ACCESSORS
  angle(vector: readonly number[]): number;

  // MODIFIERS
  cross(vector: readonly number[]): Vector3;

  rotateX(args: {radians: number; origin?: readonly number[]}): Vector3;
  rotateY(args: {radians: number; origin?: readonly number[]}): Vector3;
  rotateZ(args: {radians: number; origin?: readonly number[]}): Vector3;

  // Transforms

  // transforms as point (4th component is implicitly 1)
  transform(matrix4: readonly number[]): Vector3;
  // transforms as point (4th component is implicitly 1)
  transformAsPoint(matrix4: readonly number[]): Vector3;
  // transforms as vector  (4th component is implicitly 0, ignores translation. slightly faster)
  transformAsVector(matrix4: readonly number[]): Vector3;

  transformByMatrix3(matrix3: readonly number[]): Vector3;
  transformByMatrix2(matrix2: readonly number[]): Vector3;
  transformByQuaternion(quaternion: readonly number[]): Vector3;
}
