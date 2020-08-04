import wrapValidator from './helpers/wrapValidator';

export default function andValidator(validators, name = 'and') {
  if (!Array.isArray(validators)) {
    throw new TypeError('and: 2 or more validators are required');
  }
  if (validators.length <= 1) {
    throw new RangeError('and: 2 or more validators are required');
  }

  const validator = function and(...args) {
    let firstError = null;
    validators.some((validatorFn) => {
      firstError = validatorFn(...args);
      return firstError != null;
    });
    return firstError == null ? null : firstError;
  };

  validator.isRequired = function andIsRequired(...args) {
    let firstError = null;
    validators.some((validatorFn) => {
      firstError = validatorFn.isRequired(...args);
      return firstError != null;
    });
    return firstError == null ? null : firstError;
  };

  return wrapValidator(validator, name, validators);
}
