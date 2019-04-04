import implicitRoles from './implicitRoles';

/**
 * Returns an element's implicit role given its attributes and type.
 * Some elements only have an implicit role when certain props are defined.
 *
 * @param type - The node's tagName.
 * @param attributes - The collection of attributes on the node.
 * @returns {String} - String representing the node's implicit role or '' if it doesn't exist.
 */
export default function getImplicitRole(type, attributes) {
  if (implicitRoles[type]) {
    return implicitRoles[type](attributes);
  }

  return '';
}
