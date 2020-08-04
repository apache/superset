import { getPropValue, getLiteralPropValue } from 'jsx-ast-utils';

/**
 * Returns the tabIndex value.
 */
export default function getTabIndex(tabIndex) {
  const literalValue = getLiteralPropValue(tabIndex);

  // String and number values.
  if (['string', 'number'].indexOf(typeof literalValue) > -1) {
    // Empty string will convert to zero, so check for it explicity.
    if (
      typeof literalValue === 'string'
      && literalValue.length === 0
    ) {
      return undefined;
    }
    const value = Number(literalValue);
    if (Number.isNaN(value)) {
      return undefined;
    }

    return Number.isInteger(value)
      ? value
      : undefined;
  }

  // Booleans are not valid values, return undefined.
  if (
    literalValue === true
    || literalValue === false
  ) {
    return undefined;
  }

  return getPropValue(tabIndex);
}
