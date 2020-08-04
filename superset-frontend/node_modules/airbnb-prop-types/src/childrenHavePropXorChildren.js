import React from 'react';
import wrapValidator from './helpers/wrapValidator';

export default function childrenHavePropXorChildren(prop) {
  if (typeof prop !== 'string' && typeof prop !== 'symbol') {
    throw new TypeError('invalid prop: must be string or symbol');
  }

  const validator = function childrenHavePropXorChildrenWithProp({ children }, _, componentName) {
    let truthyChildrenCount = 0;
    let propCount = 0;
    let grandchildrenCount = 0;

    React.Children.forEach(children, (child) => {
      if (!child) {
        return;
      }

      truthyChildrenCount += 1;

      if (child.props[prop]) {
        propCount += 1;
      }

      if (React.Children.count(child.props.children)) {
        grandchildrenCount += 1;
      }
    });

    if (
      (propCount === truthyChildrenCount && grandchildrenCount === 0)
      || (propCount === 0 && grandchildrenCount === truthyChildrenCount)
      || (propCount === 0 && grandchildrenCount === 0)
    ) {
      return null;
    }

    return new TypeError(`\`${componentName}\` requires children to all have prop “${prop}”, all have children, or all have neither.`);
  };
  validator.isRequired = validator;

  return wrapValidator(validator, `childrenHavePropXorChildrenWithProp:${prop}`, prop);
}
