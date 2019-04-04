import * as vec4 from 'gl-matrix/vec4';
export function createMat4() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
export function transformVector(matrix, vector) {
  var result = vec4.transformMat4([], vector, matrix);
  vec4.scale(result, result, 1 / result[3]);
  return result;
}
export function mod(value, divisor) {
  var modulus = value % divisor;
  return modulus < 0 ? divisor + modulus : modulus;
}
export function lerp(start, end, step) {
  return step * end + (1 - step) * start;
}
//# sourceMappingURL=math-utils.js.map