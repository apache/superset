import { bool } from 'prop-types';
import wrapValidator from './helpers/wrapValidator';

export default function mutuallyExclusiveTrue(...exclusiveProps) {
  if (exclusiveProps.length < 1) {
    throw new TypeError('at least one prop that is mutually exclusive is required');
  }
  if (!exclusiveProps.every((x) => typeof x === 'string')) {
    throw new TypeError('all exclusive true props must be strings');
  }

  const propsList = exclusiveProps.join(', or ');

  const validator = function mutuallyExclusiveTrueProps(props, propName, componentName, ...rest) {
    const countProps = (count, prop) => (count + (props[prop] ? 1 : 0));

    const exclusivePropCount = exclusiveProps.reduce(countProps, 0);
    if (exclusivePropCount > 1) {
      return new Error(`A ${componentName} cannot have more than one of these boolean props be true: ${propsList}`);
    }
    return bool(props, propName, componentName, ...rest);
  };

  validator.isRequired = function mutuallyExclusiveTruePropsRequired(
    props,
    propName,
    componentName,
    ...rest
  ) {
    const countProps = (count, prop) => (count + (props[prop] ? 1 : 0));

    const exclusivePropCount = exclusiveProps.reduce(countProps, 0);
    if (exclusivePropCount > 1) {
      return new Error(`A ${componentName} cannot have more than one of these boolean props be true: ${propsList}`);
    }
    return bool.isRequired(props, propName, componentName, ...rest);
  };

  return wrapValidator(validator, `mutuallyExclusiveTrueProps: ${propsList}`, exclusiveProps);
}
