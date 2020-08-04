import isPrimitive from './helpers/isPrimitive';
import wrapValidator from './helpers/wrapValidator';

export default function keysOfValidator(propType, name = 'keysOf') {
  if (typeof propType !== 'function') {
    throw new TypeError('argument to keysOf must be a valid PropType function');
  }

  const validator = function keysOf(
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

    let firstError = null;
    Object.keys(propValue).some((key) => {
      firstError = propType(
        { [key]: key },
        key,
        componentName,
        location,
        `(${propFullName}).${key}`,
        ...rest,
      );
      return firstError != null;
    });
    return firstError || null;
  };

  validator.isRequired = function keyedByRequired(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;

    if (propValue == null) {
      return new TypeError(`${componentName}: ${propName} is required, but value is ${propValue}`);
    }

    return validator(props, propName, componentName, ...rest);
  };

  return wrapValidator(validator, name, propType);
}
