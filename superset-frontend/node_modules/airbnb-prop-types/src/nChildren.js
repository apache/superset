import React from 'react';
import { node } from 'prop-types';
import wrapValidator from './helpers/wrapValidator';

export default function nChildren(n, propType = node) {
  if (typeof n !== 'number' || isNaN(n) || n < 0) {
    throw new TypeError('a non-negative number is required');
  }

  const validator = function nChildrenValidator(props, propName, componentName, ...rest) {
    if (propName !== 'children') {
      return new TypeError(`${componentName} is using the nChildren validator on a non-children prop`);
    }

    const { children } = props;
    const childrenCount = React.Children.count(children);

    if (childrenCount !== n) {
      return new RangeError(
        `${componentName} expects to receive ${n} children, but received ${childrenCount} children.`,
      );
    }
    return propType(props, propName, componentName, ...rest);
  };
  validator.isRequired = validator;

  return wrapValidator(validator, `nChildren:${n}`, n);
}
