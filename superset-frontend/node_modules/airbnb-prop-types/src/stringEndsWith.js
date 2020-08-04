import { string } from 'prop-types';
import wrapValidator from './helpers/wrapValidator';

export default function stringEndsWithValidator(end) {
  if (typeof end !== 'string' || end.length === 0) {
    throw new TypeError('a non-empty string is required');
  }

  const validator = function stringEndsWith(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;

    if (propValue == null) {
      return null;
    }

    const stringError = string(props, propName, componentName, ...rest);
    if (stringError) {
      return stringError;
    }

    if (!propValue.endsWith(end) || propValue.length <= end.length) {
      return new TypeError(`${componentName}: ${propName} does not end with "${end}"`);
    }
    return null;
  };

  validator.isRequired = function requiredStringEndsWith(...args) {
    const stringError = string.isRequired(...args);
    if (stringError) {
      return stringError;
    }
    return validator(...args);
  };

  return wrapValidator(validator, `stringEndsWith: ${end}`);
}
