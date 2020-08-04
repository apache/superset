import isPrimitive from './helpers/isPrimitive';
import wrapValidator from './helpers/wrapValidator';

// code adapted from https://github.com/facebook/react/blob/14156e56b9cf18ac86963185c5af4abddf3ff811/src/isomorphic/classic/types/ReactPropTypes.js#L307-L340

export default function valuesOfValidator(propType) {
  if (typeof propType !== 'function') {
    throw new TypeError('objectOf: propType must be a function');
  }

  const validator = function valuesOf(
    props,
    propName,
    componentName,
    location,
    propFullName,
    ...rest
  ) {
    const { [propName]: propValue } = props;
    if (propValue == null || isPrimitive(propValue)) {
      return null;
    }

    let firstError;
    Object.keys(propValue).some((key) => {
      firstError = propType(
        propValue,
        key,
        componentName,
        location,
        `${propFullName}.${key}`,
        ...rest,
      );
      return firstError;
    });
    return firstError || null;
  };
  validator.isRequired = function valuesOfRequired(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;
    if (propValue == null) {
      return new TypeError(`${componentName}: ${propName} is required.`);
    }
    return validator(props, propName, componentName, ...rest);
  };

  return wrapValidator(validator, 'valuesOf', propType);
}
