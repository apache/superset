var WRAPPED_ANGULAR_PROPS = {
  longitude: 1,
  bearing: 1
};
export function mod(value, divisor) {
  var modulus = value % divisor;
  return modulus < 0 ? divisor + modulus : modulus;
}
export function isValid(prop) {
  return Number.isFinite(prop) || Array.isArray(prop);
}

function isWrappedAngularProp(propName) {
  return propName in WRAPPED_ANGULAR_PROPS;
}

export function getEndValueByShortestPath(propName, startValue, endValue) {
  if (isWrappedAngularProp(propName) && Math.abs(endValue - startValue) > 180) {
    endValue = endValue < 0 ? endValue + 360 : endValue - 360;
  }

  return endValue;
}
//# sourceMappingURL=transition-utils.js.map