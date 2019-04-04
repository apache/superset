import { getProp } from 'jsx-ast-utils';

/**
 * Returns the implicit role for a link tag.
 */
export default function getImplicitRoleForLink(attributes) {
  if (getProp(attributes, 'href')) {
    return 'link';
  }

  return '';
}
