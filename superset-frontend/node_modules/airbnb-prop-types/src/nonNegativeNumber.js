import is from 'object-is';
import wrapValidator from './helpers/wrapValidator';

function isNonNegative(x) {
  return typeof x === 'number' && isFinite(x) && x >= 0 && !is(x, -0);
}

function nonNegativeNumber(props, propName, componentName) {
  const value = props[propName];

  if (value == null || isNonNegative(value)) {
    return null;
  }

  return new RangeError(`${propName} in ${componentName} must be a non-negative number`);
}

function requiredNonNegativeNumber(props, propName, componentName) {
  const value = props[propName];

  if (isNonNegative(value)) {
    return null;
  }

  return new RangeError(`${propName} in ${componentName} must be a non-negative number`);
}

nonNegativeNumber.isRequired = requiredNonNegativeNumber;

export default () => wrapValidator(nonNegativeNumber, 'nonNegativeNumber');
