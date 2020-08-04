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

import assert from './assert';

const RADIANS_TO_DEGREES = (1 / Math.PI) * 180;
const DEGREES_TO_RADIANS = (1 / 180) * Math.PI;

// TODO - remove
/* eslint-disable no-shadow */
const config = {};
config.EPSILON = 1e-12;
config.debug = false;
config.precision = 4;
config.printTypes = false;
config.printDegrees = false;
config.printRowMajor = true;

export {config};

export function configure(options = {}) {
  // Only copy existing keys
  for (const key in options) {
    assert(key in config);
    config[key] = options[key];
  }
  return config;
}

function round(value) {
  return Math.round(value / config.EPSILON) * config.EPSILON;
}

export function formatValue(value, {precision = config.precision || 4} = {}) {
  value = round(value);
  // get rid of trailing zeros
  return `${parseFloat(value.toPrecision(precision))}`;
}

// Returns true if value is either an array or a typed array
// Note: does not return true for ArrayBuffers and DataViews
export function isArray(value) {
  return Array.isArray(value) || (ArrayBuffer.isView(value) && !(value instanceof DataView));
}

// If the array has a clone function, calls it, otherwise returns a copy
function duplicateArray(array) {
  return array.clone ? array.clone() : new Array(array.length);
}

export function clone(array) {
  return array.clone ? array.clone() : new Array(...array);
}

// If the argument value is an array, applies the func element wise,
// otherwise applies func to the argument value
function map(value, func, result) {
  if (isArray(value)) {
    result = result || duplicateArray(value);
    for (let i = 0; i < result.length && i < value.length; ++i) {
      result[i] = func(value[i], i, result);
    }
    return result;
  }
  return func(value);
}

export function toRadians(degrees) {
  return radians(degrees);
}

export function toDegrees(radians) {
  return degrees(radians);
}

//
// GLSL math function equivalents
// Works on both single values and vectors
//

export function radians(degrees, result) {
  return map(degrees, degrees => degrees * DEGREES_TO_RADIANS, result);
}

export function degrees(radians, result) {
  return map(radians, radians => radians * RADIANS_TO_DEGREES, result);
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

// eslint-disable-next-line complexity
export function equals(a, b, epsilon) {
  const oldEpsilon = config.EPSILON;
  if (epsilon) {
    config.EPSILON = epsilon;
  }
  try {
    if (a === b) {
      return true;
    }
    if (isArray(a) && isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      for (let i = 0; i < a.length; ++i) {
        // eslint-disable-next-line max-depth
        if (!equals(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
    if (a && a.equals) {
      return a.equals(b);
    }
    if (b && b.equals) {
      return b.equals(a);
    }
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return Math.abs(a - b) <= config.EPSILON * Math.max(1.0, Math.abs(a), Math.abs(b));
    }
    return false;
  } finally {
    config.EPSILON = oldEpsilon;
  }
}

// eslint-disable-next-line complexity
export function exactEquals(a, b) {
  if (a === b) {
    return true;
  }
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    if (a.constructor !== b.constructor) {
      return false;
    }
    if (a.exactEquals) {
      return a.exactEquals(b);
    }
  }
  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; ++i) {
      if (!exactEquals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function withEpsilon(EPSILON, func) {
  const oldPrecision = config.EPSILON;
  config.EPSILON = EPSILON;
  let value;
  try {
    value = func();
  } finally {
    config.EPSILON = oldPrecision;
  }
  return value;
}
