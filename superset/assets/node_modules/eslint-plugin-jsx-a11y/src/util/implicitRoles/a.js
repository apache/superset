import { getProp } from 'jsx-ast-utils';

/**
 * Returns the implicit role for an anchor tag.
 */
export default function getImplicitRoleForAnchor(attributes) {
  if (getProp(attributes, 'href')) {
    return 'link';
  }

  return '';
}
