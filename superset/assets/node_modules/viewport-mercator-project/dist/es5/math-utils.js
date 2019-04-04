"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createMat4 = createMat4;
exports.transformVector = transformVector;
exports.mod = mod;
exports.lerp = lerp;

var vec4 = _interopRequireWildcard(require("gl-matrix/vec4"));

function createMat4() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function transformVector(matrix, vector) {
  var result = vec4.transformMat4([], vector, matrix);
  vec4.scale(result, result, 1 / result[3]);
  return result;
}

function mod(value, divisor) {
  var modulus = value % divisor;
  return modulus < 0 ? divisor + modulus : modulus;
}

function lerp(start, end, step) {
  return step * end + (1 - step) * start;
}
//# sourceMappingURL=math-utils.js.map