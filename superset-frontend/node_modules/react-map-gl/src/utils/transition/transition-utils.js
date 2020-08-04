// @flow

const WRAPPED_ANGULAR_PROPS = {
  longitude: 1,
  bearing: 1
};

export function mod(value: number, divisor: number): number {
  const modulus = value % divisor;
  return modulus < 0 ? divisor + modulus : modulus;
}

export function isValid(prop: any): boolean {
  return Number.isFinite(prop) || Array.isArray(prop);
}

function isWrappedAngularProp(propName: string): boolean {
  return propName in WRAPPED_ANGULAR_PROPS;
}

export function getEndValueByShortestPath(
  propName: string,
  startValue: number,
  endValue: number
): number {
  if (isWrappedAngularProp(propName) && Math.abs(endValue - startValue) > 180) {
    endValue = endValue < 0 ? endValue + 360 : endValue - 360;
  }
  return endValue;
}
