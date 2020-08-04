let arrayBuffer = null;

export function getScratchArrayBuffer(byteLength) {
  if (!arrayBuffer || arrayBuffer.byteLength < byteLength) {
    arrayBuffer = new ArrayBuffer(byteLength);
  }
  return arrayBuffer;
}

export function getScratchArray(Type, length) {
  const scratchArrayBuffer = getScratchArrayBuffer(Type.BYTES_PER_ELEMENT * length);
  return new Type(scratchArrayBuffer, 0, length); // arrayBuffer, byteOffset, length (in elements)
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

/*

// Creates a new Uint8Array based on two different ArrayBuffers
// @private
// @param {ArrayBuffers} buffer1 The first buffer.
// @param {ArrayBuffers} buffer2 The second buffer.
// @return {ArrayBuffers} The new ArrayBuffer created out of the two.
//
export function copyArrayBuffer(
  targetBuffer, sourceBuffer, byteOffset, byteLength = sourceBuffer.byteLength
) {
  const targetArray = new Uint8Array(targetBuffer, byteOffset, byteLength);
  const sourceArray = new Uint8Array(sourceBuffer);
  targetArray.set(sourceArray);
  return targetBuffer;
}

*/
