import isPlainObject from './helpers/isPlainObject';
import wrapValidator from './helpers/wrapValidator';

export default function shapeValidator(shapeTypes) {
  if (!isPlainObject(shapeTypes)) {
    throw new TypeError('shape must be a normal object');
  }

  function shape(props, propName, componentName, location, ...rest) {
    const { [propName]: propValue } = props;
    if (propValue == null) {
      return null;
    }
    // code adapted from PropTypes.shape: https://github.com/facebook/react/blob/14156e56b9cf18ac86963185c5af4abddf3ff811/src/isomorphic/classic/types/ReactPropTypes.js#L381
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const key in shapeTypes) {
      const checker = shapeTypes[key];
      if (checker) {
        const error = checker(
          propValue,
          key,
          componentName,
          location,
          ...rest,
        );
        if (error) {
          return error;
        }
      }
    }
    return null;
  }

  shape.isRequired = function shapeRequired(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;
    if (propValue == null) {
      return new TypeError(`${componentName}: ${propName} is required.`);
    }
    return shape(props, propName, componentName, ...rest);
  };

  return wrapValidator(shape, 'shape', shapeTypes);
}
