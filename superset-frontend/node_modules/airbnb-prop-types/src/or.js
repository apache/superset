import { arrayOf } from 'prop-types';
import wrapValidator from './helpers/wrapValidator';

function oneOfTypeValidator(validators) {
  const validator = function oneOfType(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;
    if (typeof propValue === 'undefined') {
      return null;
    }

    const errors = validators
      .map((v) => v(props, propName, componentName, ...rest))
      .filter(Boolean);

    if (errors.length < validators.length) {
      return null;
    }
    return new TypeError(`${componentName}: invalid value supplied to ${propName}.`);
  };
  validator.isRequired = function oneOfTypeRequired(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;
    if (typeof propValue === 'undefined') {
      return new TypeError(`${componentName}: missing value for required ${propName}.`);
    }

    const errors = validators
      .map((v) => v(props, propName, componentName, ...rest))
      .filter(Boolean);

    if (errors.length === validators.length) {
      return new TypeError(`${componentName}: invalid value ${errors} supplied to required ${propName}.`);
    }
    return null;
  };
  return wrapValidator(validator, 'oneOfType', validators);
}

export default function or(validators, name = 'or') {
  if (!Array.isArray(validators)) {
    throw new TypeError('or: 2 or more validators are required');
  }
  if (validators.length <= 1) {
    throw new RangeError('or: 2 or more validators are required');
  }

  const validator = oneOfTypeValidator([
    arrayOf(oneOfTypeValidator(validators)),
    ...validators,
  ]);

  return wrapValidator(validator, name, validators);
}
