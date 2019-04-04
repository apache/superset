"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mod = mod;
exports.isValid = isValid;
exports.getEndValueByShortestPath = getEndValueByShortestPath;
var WRAPPED_ANGULAR_PROPS = {
  longitude: 1,
  bearing: 1
};

function mod(value, divisor) {
  var modulus = value % divisor;
  return modulus < 0 ? divisor + modulus : modulus;
}

function isValid(prop) {
  return Number.isFinite(prop) || Array.isArray(prop);
}

function isWrappedAngularProp(propName) {
  return propName in WRAPPED_ANGULAR_PROPS;
}

function getEndValueByShortestPath(propName, startValue, endValue) {
  if (isWrappedAngularProp(propName) && Math.abs(endValue - startValue) > 180) {
    endValue = endValue < 0 ? endValue + 360 : endValue - 360;
  }

  return endValue;
}
//# sourceMappingURL=transition-utils.js.map