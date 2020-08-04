import { string } from 'prop-types';
import wrapValidator from './helpers/wrapValidator';

const validNumericChars = /^[-+]?(?:[1-9][0-9]*(?:\.[0-9]+)?|0|0\.[0-9]+)$/;

const validator = function numericString(props, propName, componentName, ...rest) {
  if (props[propName] == null) {
    return null;
  }

  const stringError = string(props, propName, componentName, ...rest);
  if (stringError) {
    return stringError;
  }

  const value = props[propName];

  const passesRegex = validNumericChars.test(value);
  if (passesRegex) {
    return null;
  }

  return new TypeError(`${componentName}: prop "${propName}" (value "${value}") must be a numeric string:
    - starting with an optional + or -
    - that does not have a leading zero
    - with an optional decimal part (that contains only one decimal point, if present)
    - that otherwise only contains digits (0-9)
    - not +-NaN, or +-Infinity
  `);
};

validator.isRequired = function numericStringRequired(props, propName, componentName, ...rest) {
  if (props[propName] == null) {
    return new TypeError(`${componentName}: ${propName} is required`);
  }
  return validator(props, propName, componentName, ...rest);
};

export default () => wrapValidator(validator, 'numericString');
