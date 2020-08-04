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

/* Two-element vector class */
export default class Vector2 extends Vector<Vector2> {
  static ZERO: number[];
  // Getters/setters
  ELEMENTS: number;

  constructor();
  constructor(array: readonly number[]);
  constructor(x: number, y: number);

  set(x: number, y: number): Vector2;

  copy(array: readonly number[]): Vector2;

  fromObject(object): Vector2;
  //  {
  //   if (config.debug) {
  //     checkNumber(object.x);
  //     checkNumber(object.y);
  //   }
  //   this[0] = object.x;
  //   this[1] = object.y;
  //   return this.check();
  // }

  toObject(object: object): object;

  // x,y inherited from Vector

  horizontalAngle(): number;

  verticalAngle(): number;

  // Transforms
  transform(matrix4: readonly number[]): Vector2;
  // transforms as point (4th component is implicitly 1)
  transformAsPoint(matrix4: readonly number[]): Vector2;
  // transforms as vector  (4th component is implicitly 0, ignores translation. slightly faster)
  transformAsVector(matrix4: readonly number[]): Vector2;

  transformByMatrix3(matrix3: readonly number[]): Vector2;
  transformByMatrix2x3(matrix2x3: readonly number[]): Vector2;
  transformByMatrix2(matrix2: readonly number[]): Vector2;
}
