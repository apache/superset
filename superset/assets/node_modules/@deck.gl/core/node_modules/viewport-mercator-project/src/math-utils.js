import vec4_scale from 'gl-vec4/scale';
import vec4_transformMat4 from 'gl-vec4/transformMat4';

// Helper, avoids low-precision 32 bit matrices from gl-matrix mat4.create()
export function createMat4() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// Transforms a vec4 with a projection matrix
export function transformVector(matrix, vector) {
  const result = vec4_transformMat4([], vector, matrix);
  vec4_scale(result, result, 1 / result[3]);
  return result;
}

export function mod(value, divisor) {
  const modulus = value % divisor;
  return modulus < 0 ? divisor + modulus : modulus;
}

export function lerp(start, end, step) {
  return step * end + (1 - step) * start;
}
