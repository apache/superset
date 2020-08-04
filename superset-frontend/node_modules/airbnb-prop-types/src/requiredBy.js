import is from 'object-is';
import wrapValidator from './helpers/wrapValidator';

export default function getRequiredBy(requiredByPropName, propType, defaultValue = null) {
  function requiredBy(props, propName, componentName, ...rest) {
    if (props[requiredByPropName]) {
      const { [propName]: propValue } = props;
      if (is(propValue, defaultValue) || typeof propValue === 'undefined') {
        return new TypeError(
          `${componentName}: when ${requiredByPropName} is true, prop “${propName}” must be present.`,
        );
      }
    }
    return propType(props, propName, componentName, ...rest);
  }
  requiredBy.isRequired = function requiredByRequired(props, propName, componentName, ...rest) {
    const { [propName]: propValue } = props;
    if (is(propValue, defaultValue)) {
      return new TypeError(`${componentName}: prop “${propName}” must be present.`);
    }
    return propType.isRequired(props, propName, componentName, ...rest);
  };

  return wrapValidator(
    requiredBy,
    `requiredBy “${requiredByPropName}”`,
    [requiredByPropName, defaultValue],
  );
}
