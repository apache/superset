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

/*
 * Helper function for padArray
 */
function padArrayChunk({source, target, start = 0, end, getData}) {
  end = end || target.length;

  const sourceLength = source.length;
  const targetLength = end - start;

  if (sourceLength > targetLength) {
    target.set(source.subarray(0, targetLength), start);
    return;
  }

  target.set(source, start);

  if (!getData) {
    return;
  }

  // source is not large enough to fill target space, call `getData` to get filler data
  let i = sourceLength;
  while (i < targetLength) {
    const datum = getData(i, source);
    for (let j = 0; j < datum.length; j++) {
      target[start + i] = datum[j];
      i++;
    }
  }
}

/*
 * The padArray function stretches a source array to the size of a target array.
   The arrays can have internal structures (like the attributes of PathLayer and
   SolidPolygonLayer), defined by the optional sourceLayout and targetLayout parameters.
   If the target array is larger, the getData callback is used to fill in the blanks.
 * @params {TypedArray} source - original data
 * @params {TypedArray} target - output data
 * @params {Number} size - length per datum
 * @params {Function} getData - callback to get new data when source is short
 * @params {Array<Number>} [sourceLayout] - subdivision of the original data in [chunkSize0, chunkSize1, ...]
 * @params {Array<Number>} [targetLayout] - subdivision of the output data in [chunkSize0, chunkSize1, ...]
 */
export function padArray({source, target, size, getData, sourceLayout, targetLayout}) {
  if (!Array.isArray(targetLayout)) {
    // Flat arrays
    padArrayChunk({
      source,
      target,
      getData
    });
    return target;
  }

  // Arrays have internal structure
  let sourceIndex = 0;
  let targetIndex = 0;
  const getChunkData = getData && ((i, chunk) => getData(i + targetIndex, chunk));

  const n = Math.min(sourceLayout.length, targetLayout.length);

  for (let i = 0; i < n; i++) {
    const sourceChunkLength = sourceLayout[i] * size;
    const targetChunkLength = targetLayout[i] * size;

    padArrayChunk({
      source: source.subarray(sourceIndex, sourceIndex + sourceChunkLength),
      target,
      start: targetIndex,
      end: targetIndex + targetChunkLength,
      getData: getChunkData
    });

    sourceIndex += sourceChunkLength;
    targetIndex += targetChunkLength;
  }

  if (targetIndex < target.length) {
    padArrayChunk({
      source: [],
      target,
      start: targetIndex,
      getData: getChunkData
    });
  }

  return target;
}
