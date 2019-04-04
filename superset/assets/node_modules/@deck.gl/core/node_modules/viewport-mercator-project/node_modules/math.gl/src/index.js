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

// math.gl classes
export {default as Vector2} from './vector2';
export {default as Vector3} from './vector3';
export {default as Vector4} from './vector4';
export {default as Matrix4} from './matrix4';
export {default as Quaternion} from './quaternion';

// math.gl "GLSL" functions
export {
  config,
  checkNumber,
  configure,
  formatValue,
  isArray,
  clone,
  radians,
  degrees,
  sin,
  cos,
  tan,
  asin,
  acos,
  atan,
  clamp,
  lerp,
  equals
} from './lib/common';

export {default as _SphericalCoordinates} from './spherical-coordinates';
export {default as _Pose} from './pose';
export {default as _Euler} from './euler';
export {default as _Polygon} from './addons/polygon';
