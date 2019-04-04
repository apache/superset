/**
 * Calculate WebGL 64 bit float
 * @param a {number} - the input float number
 * @param out {array, optional} - the output array. If not supplied, a new array is created.
 * @param startIndex {integer, optional} - the index in the output array to fill from. Default 0.
 * @returns {array} - the fp64 representation of the input number
 */
export function fp64ify(a, out = [], startIndex = 0) {
  const hiPart = Math.fround(a);
  const loPart = a - hiPart;
  out[startIndex] = hiPart;
  out[startIndex + 1] = loPart;
  return out;
}

/**
 * Calculate the low part of a WebGL 64 bit float
 * @param a {number} - the input float number
 * @returns {number} - the lower 32 bit of the number
 */
export function fp64LowPart(a) {
  return a - Math.fround(a);
}

/**
 * Calculate WebGL 64 bit matrix (transposed "Float64Array")
 * @param matrix {Matrix4} - the input matrix
 * @returns {array} - the fp64 representation of the input matrix
 */
export function fp64ifyMatrix4(matrix) {
  // Transpose the projection matrix to column major for GLSL.
  const matrixFP64 = new Float32Array(32);
  for (let i = 0; i < 4; ++i) {
    for (let j = 0; j < 4; ++j) {
      const index = i * 4 + j;
      fp64ify(matrix[j * 4 + i], matrixFP64, index * 2);
    }
  }
  return matrixFP64;
}
