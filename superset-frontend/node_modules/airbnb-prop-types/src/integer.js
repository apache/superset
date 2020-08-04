import isInteger from './helpers/isInteger';
import wrapValidator from './helpers/wrapValidator';

function requiredInteger(props, propName, componentName) {
  const { [propName]: propValue } = props;
  if (propValue == null || !isInteger(propValue)) {
    return new RangeError(`${propName} in ${componentName} must be an integer`);
  }
  return null;
}

const validator = function integer(props, propName, ...rest) {
  const { [propName]: propValue } = props;

  if (propValue == null) {
    return null;
  }

  return requiredInteger(props, propName, ...rest);
};

validator.isRequired = requiredInteger;

export default () => wrapValidator(validator, 'integer');
