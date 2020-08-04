import wrapValidator from './helpers/wrapValidator';

function customMessageWrapper(messsageFunction) {
  function restrictedProp(props, propName, componentName, location, ...rest) {
    if (props[propName] == null) {
      return null;
    }

    if (messsageFunction && typeof messsageFunction === 'function') {
      return new TypeError(messsageFunction(props, propName, componentName, location, ...rest));
    }
    return new TypeError(`The ${propName} ${location} on ${componentName} is not allowed.`);
  }
  restrictedProp.isRequired = restrictedProp;
  return restrictedProp;
}

export default (messsageFunction = null) => wrapValidator(customMessageWrapper(messsageFunction), 'restrictedProp');
