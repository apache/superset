import { getProp, getLiteralPropValue } from 'jsx-ast-utils';

/**
 * Returns the implicit role for an img tag.
 */
export default function getImplicitRoleForImg(attributes) {
  const alt = getProp(attributes, 'alt');

  if (alt && getLiteralPropValue(alt) === '') {
    return 'presentation';
  }

  return 'img';
}
