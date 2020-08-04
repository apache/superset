// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
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

/**
 * Flattens a nested array into a single level array,
 * or a single value into an array with one value
 * @example flatten([[1, [2]], [3], 4]) => [1, 2, 3, 4]
 * @example flatten(1) => [1]
 * @param {Array} array The array to flatten.
 * @param {Function} filter= - Optional predicate called on each `value` to
 *   determine if it should be included (pushed onto) the resulting array.
 * @param {Function} map= - Optional transform applied to each array elements.
 * @param {Array} result=[] - Optional array to push value into
 * @return {Array} Returns the new flattened array (new array or `result` if provided)
 */
export function flatten(array, {filter = () => true, map = x => x, result = []} = {}) {
  // Wrap single object in array
  if (!Array.isArray(array)) {
    return filter(array) ? [map(array)] : [];
  }
  // Deep flatten and filter the array
  return flattenArray(array, filter, map, result);
}

// Deep flattens an array. Helper to `flatten`, see its parameters
function flattenArray(array, filter, map, result) {
  let index = -1;
  while (++index < array.length) {
    const value = array[index];
    if (Array.isArray(value)) {
      flattenArray(value, filter, map, result);
    } else if (filter(value)) {
      result.push(map(value));
    }
  }
  return result;
}

export function countVertices(nestedArray) {
  let count = 0;
  let index = -1;
  while (++index < nestedArray.length) {
    const value = nestedArray[index];
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      count += countVertices(value);
    } else {
      count++;
    }
  }
  return count;
}

// Flattens nested array of vertices, padding third coordinate as needed
export function flattenVertices(nestedArray, {result = [], dimensions = 3} = {}) {
  let index = -1;
  let vertexLength = 0;
  while (++index < nestedArray.length) {
    const value = nestedArray[index];
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      flattenVertices(value, {result, dimensions});
    } else {
      // eslint-disable-next-line
      if (vertexLength < dimensions) {
        result.push(value);
        vertexLength++;
      }
    }
  }
  // Add a third coordinate if needed
  if (vertexLength > 0 && vertexLength < dimensions) {
    result.push(0);
  }
  return result;
}

// Uses copyWithin to significantly speed up typed array value filling
export function fillArray({target, source, start = 0, count = 1}) {
  const length = source.length;
  const total = count * length;
  let copied = 0;
  for (let i = start; copied < length; copied++) {
    target[i++] = source[copied];
  }

  while (copied < total) {
    // If we have copied less than half, copy everything we got
    // else copy remaining in one operation
    if (copied < total - copied) {
      target.copyWithin(start + copied, start, start + copied);
      copied *= 2;
    } else {
      target.copyWithin(start + copied, start, start + total - copied);
      copied = total;
    }
  }

  return target;
}

// Flattens nested array of vertices, padding third coordinate as needed
/*
export function flattenTypedVertices(nestedArray, {
  result = [],
  Type = Float32Array,
  start = 0,
  dimensions = 3
} = {}) {
  let index = -1;
  let vertexLength = 0;
  while (++index < nestedArray.length) {
    const value = nestedArray[index];
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      start = flattenTypedVertices(value, {result, start, dimensions});
    } else {
      if (vertexLength < dimensions) { // eslint-disable-line
        result[start++] = value;
        vertexLength++;
      }
    }
  }
  // Add a third coordinate if needed
  if (vertexLength > 0 && vertexLength < dimensions) {
    result[start++] = 0;
  }
  return start;
}
*/
