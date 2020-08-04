import { getProp, getPropValue, getLiteralPropValue } from 'jsx-ast-utils';

/**
 * Returns boolean indicating that the aria-hidden prop
 * is present or the value is true. Will also return true if
 * there is an input with type='hidden'.
 *
 * <div aria-hidden /> is equivalent to the DOM as <div aria-hidden=true />.
 */
const isHiddenFromScreenReader = (type, attributes) => {
  if (type.toUpperCase() === 'INPUT') {
    const hidden = getLiteralPropValue(getProp(attributes, 'type'));

    if (hidden && hidden.toUpperCase() === 'HIDDEN') {
      return true;
    }
  }

  const ariaHidden = getPropValue(getProp(attributes, 'aria-hidden'));
  return ariaHidden === true;
};

export default isHiddenFromScreenReader;
