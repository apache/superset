import { bool } from 'prop-types';
import wrapValidator from './helpers/wrapValidator';

export default function booleanSomeValidator(...notAllPropsFalse) {
  if (notAllPropsFalse.length < 1) {
    throw new TypeError('at least one prop (one of which must be `true`) is required');
  }
  if (!notAllPropsFalse.every((x) => typeof x === 'string')) {
    throw new TypeError('all booleanSome props must be strings');
  }

  const propsList = notAllPropsFalse.join(', or ');

  const validator = function booleanSome(props, propName, componentName, ...rest) {
    const countFalse = (count, prop) => (count + (props[prop] === false ? 1 : 0));

    const falsePropCount = notAllPropsFalse.reduce(countFalse, 0);
    if (falsePropCount === notAllPropsFalse.length) {
      return new Error(`A ${componentName} must have at least one of these boolean props be \`true\`: ${propsList}`);
    }
    return bool(props, propName, componentName, ...rest);
  };

  validator.isRequired = function booleanSomeRequired(
    props,
    propName,
    componentName,
    ...rest
  ) {
    const countFalse = (count, prop) => (count + (props[prop] === false ? 1 : 0));

    const falsePropCount = notAllPropsFalse.reduce(countFalse, 0);
    if (falsePropCount === notAllPropsFalse.length) {
      return new Error(`A ${componentName} must have at least one of these boolean props be \`true\`: ${propsList}`);
    }
    return bool.isRequired(props, propName, componentName, ...rest);
  };

  return wrapValidator(validator, `booleanSome: ${propsList}`, notAllPropsFalse);
}
