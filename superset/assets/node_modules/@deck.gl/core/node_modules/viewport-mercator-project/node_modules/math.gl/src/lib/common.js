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

/* eslint-disable no-shadow */
// TODO - remove
const config = {};
config.EPSILON = 1e-12;
config.debug = true;
config.precision = 4;
config.printTypes = false;
config.printDegrees = false;
config.printRowMajor = true;

export {config};

export function configure(options) {
  if ('epsilon' in options) {
    config.EPSILON = options.epsilon;
  }

  if ('debug' in options) {
    config.debug = options.debug;
  }
}

export function checkNumber(value) {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number ${value}`);
  }
  return value;
}

function round(value) {
  return Math.round(value / config.EPSILON) * config.EPSILON;
}

export function formatValue(value, {precision = config.precision || 4} = {}) {
  value = round(value);
  return parseFloat(value.toPrecision(precision));
}

export function formatAngle(
  value,
  {precision = config.precision || 4, printDegrees = config.printAngles} = {}
) {
  value = printDegrees ? degrees(value) : value;
  value = round(value);
  return `${parseFloat(value.toPrecision(precision))}${printDegrees ? '°' : ''}`;
}

// Returns true if value is either an array or a typed array
// Note: does not return true for ArrayBuffers and DataViews
export function isArray(value) {
  return Array.isArray(value) || (ArrayBuffer.isView(value) && value.length !== undefined);
}

// If the array has a clone function, calls it, otherwise returns a copy
export function clone(array) {
  return array.clone ? array.clone() : new Array(array);
}

// If the argument value is an array, applies the func element wise,
// otherwise applies func to the argument value
function map(value, func) {
  if (isArray(value)) {
    const result = clone(value);
    for (let i = 0; i < result.length; ++i) {
      result[i] = func(result[i], i, result);
    }
    return result;
  }
  return func(value);
}

//
// GLSL math function equivalents
// Works on both single values and vectors
//

export function radians(degrees) {
  return map(degrees, degrees => (degrees / 180) * Math.PI);
}

// GLSL equivalent: Works on single values and vectors
export function degrees(radians) {
  return map(radians, radians => (radians * 180) / Math.PI);
}

// GLSL equivalent: Works on single values and vectors
export function sin(radians) {
  return map(radians, angle => Math.sin(angle));
}

// GLSL equivalent: Works on single values and vectors
export function cos(radians) {
  return map(radians, angle => Math.cos(angle));
}

// GLSL equivalent: Works on single values and vectors
export function tan(radians) {
  return map(radians, angle => Math.tan(angle));
}

// GLSL equivalent: Works on single values and vectors
export function asin(radians) {
  return map(radians, angle => Math.asin(angle));
}

// GLSL equivalent: Works on single values and vectors
export function acos(radians) {
  return map(radians, angle => Math.acos(angle));
}

// GLSL equivalent: Works on single values and vectors
export function atan(radians) {
  return map(radians, angle => Math.atan(angle));
}

export function clamp(value, min, max) {
  return map(value, value => Math.max(min, Math.min(max, value)));
}

// Interpolate between two numbers or two arrays
export function lerp(a, b, t) {
  if (isArray(a)) {
    return a.map((ai, i) => lerp(ai, b[i], t));
  }
  return t * b + (1 - t) * a;
}

export function equals(a, b) {
  if (isArray(a) && isArray(b)) {
    if (a === b) {
      return true;
    }
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; ++i) {
      if (!equals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  return Math.abs(a - b) <= config.EPSILON * Math.max(1.0, Math.abs(a), Math.abs(b));
}
