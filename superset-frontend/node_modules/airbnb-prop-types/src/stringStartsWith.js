import { string } from 'prop-types';
import wrapValidator from './helpers/wrapValidator';

export default function stringStartsWithValidator(start) {
  if (typeof start !== 'string' || start.length === 0) {
    throw new TypeError('a non-empty string is required');
  }

  const validator = function stringStartsWith(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;

    if (propValue == null) {
      return null;
    }

    const stringError = string(props, propName, componentName, ...rest);
    if (stringError) {
      return stringError;
    }

    if (!propValue.startsWith(start) || propValue.length <= start.length) {
      return new TypeError(`${componentName}: ${propName} does not start with "${start}"`);
    }
    return null;
  };

  validator.isRequired = function requiredStringStartsWith(...args) {
    const stringError = string.isRequired(...args);
    if (stringError) {
      return stringError;
    }
    return validator(...args);
  };

  return wrapValidator(validator, `stringStartsWith: ${start}`);
}
