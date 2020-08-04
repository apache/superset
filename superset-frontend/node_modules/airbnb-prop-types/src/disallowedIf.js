import wrapValidator from './helpers/wrapValidator';

export default function disallowedIf(propType, otherPropName, otherPropType) {
  if (typeof propType !== 'function' || typeof propType.isRequired !== 'function') {
    throw new TypeError('a propType validator is required; propType validators must also provide `.isRequired`');
  }

  if (typeof otherPropName !== 'string') {
    throw new TypeError('other prop name must be a string');
  }

  if (typeof otherPropType !== 'function') {
    throw new TypeError('other prop type validator is required');
  }

  function disallowedIfRequired(props, propName, componentName, ...rest) {
    const error = propType.isRequired(props, propName, componentName, ...rest);
    if (error) {
      return error;
    }

    if (props[otherPropName] == null) {
      return null;
    }

    const otherError = otherPropType(props, otherPropName, componentName, ...rest);
    if (otherError) {
      return null;
    }
    return new Error(`prop “${propName}” is disallowed when “${otherPropName}” matches the provided validator`);
  }

  const validator = function disallowedIfPropType(props, propName, ...rest) {
    if (props[propName] == null) {
      return null;
    }
    return disallowedIfRequired(props, propName, ...rest);
  };

  validator.isRequired = disallowedIfRequired;

  return wrapValidator(validator, 'disallowedIf', { propType, otherPropName, otherPropType });
}
