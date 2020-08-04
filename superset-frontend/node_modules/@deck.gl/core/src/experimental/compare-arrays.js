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
export function compareArrays(array1, array2) {
  const length = Math.min(array1.length, array2.length);
  for (let i = 0; i < length; ++i) {
    if (array1[i] !== array2[i]) {
      return `Arrays are different in element ${i}: ${array1[i]} vs ${array2[i]}`;
    }
  }

  if (array1.length !== array2.length) {
    return `Arrays have different length ${array1.length} vs ${array2.length}`;
  }

  return null;
}

export function checkArray(array) {
  for (let i = 0; i < array.length; ++i) {
    if (!Number.isFinite(array[i])) {
      throw new Error(`Array has invalid element ${i}: ${array[i]}`);
    }
  }
  return null;
}
