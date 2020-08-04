// Extensions to math.gl library. Intended to be folded back.

import * as vec4 from 'gl-matrix/vec4';
import assert from '../utils/assert';

export function transformVector(matrix, vector) {
  // Handle non-invertible matrix
  if (!matrix) {
    return null;
  }
  const result = vec4.transformMat4([0, 0, 0, 0], vector, matrix);
  const scale = 1 / result[3];
  vec4.multiply(result, result, [scale, scale, scale, scale]);
  return result;
}

// Helper, avoids low-precision 32 bit matrices from gl-matrix mat4.create()
export function createMat4() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

// Extract camera vectors (move to math library?)
export function extractCameraVectors({viewMatrix, viewMatrixInverse}) {
  // Read the translation from the inverse view matrix
  return {
    eye: [viewMatrixInverse[12], viewMatrixInverse[13], viewMatrixInverse[14]],
    direction: [viewMatrix[2], viewMatrix[6], viewMatrix[10]],
    up: [viewMatrix[1], viewMatrix[5], viewMatrix[9]]
  };
}

export function mod(value, divisor) {
  assert(Number.isFinite(value) && Number.isFinite(divisor));
  const modulus = value % divisor;
  return modulus < 0 ? divisor + modulus : modulus;
}
