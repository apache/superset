import { Component, PureComponent } from 'react';
import isPlainObject from './helpers/isPlainObject';
import wrapValidator from './helpers/wrapValidator';

const { isPrototypeOf } = Object.prototype;

function isNewRef(prop) {
  if (!isPlainObject(prop)) {
    return false;
  }
  const ownProperties = Object.keys(prop);
  return ownProperties.length === 1 && ownProperties[0] === 'current';
}

function isCallbackRef(prop) {
  return typeof prop === 'function'
    && !isPrototypeOf.call(Component, prop)
    && (!PureComponent || !isPrototypeOf.call(PureComponent, prop));
}

function requiredRef(props, propName, componentName) {
  const propValue = props[propName];

  if (isCallbackRef(propValue) || isNewRef(propValue)) {
    return null;
  }

  return new TypeError(`${propName} in ${componentName} must be a ref`);
}

function ref(props, propName, componentName, ...rest) {
  const propValue = props[propName];

  if (propValue == null) {
    return null;
  }

  return requiredRef(props, propName, componentName, ...rest);
}

ref.isRequired = requiredRef;

export default () => wrapValidator(ref, 'ref');
