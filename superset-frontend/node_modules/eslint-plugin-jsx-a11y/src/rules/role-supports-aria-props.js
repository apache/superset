/**
 * @fileoverview Enforce that elements with explicit or implicit roles defined contain only
 * `aria-*` properties supported by that `role`.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import {
  aria,
  roles,
} from 'aria-query';
import { getProp, getLiteralPropValue, elementType, propName } from 'jsx-ast-utils';
import { generateObjSchema } from '../util/schemas';
import getImplicitRole from '../util/getImplicitRole';

const errorMessage = (attr, role, tag, isImplicit) => {
  if (isImplicit) {
    return `The attribute ${attr} is not supported by the role ${role}. \
This role is implicit on the element ${tag}.`;
  }

  return `The attribute ${attr} is not supported by the role ${role}.`;
};

const schema = generateObjSchema();

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXOpeningElement: (node) => {
      // If role is not explicitly defined, then try and get its implicit role.
      const type = elementType(node);
      const role = getProp(node.attributes, 'role');
      const roleValue = role ? getLiteralPropValue(role) : getImplicitRole(type, node.attributes);
      const isImplicit = roleValue && role === undefined;

      // If there is no explicit or implicit role, then assume that the element
      // can handle the global set of aria-* properties.
      // This actually isn't true - should fix in future release.
      if (
        typeof roleValue !== 'string'
        || roles.get(roleValue) === undefined
      ) {
        return;
      }

      // Make sure it has no aria-* properties defined outside of its property set.
      const {
        props: propKeyValues,
      } = roles.get(roleValue);
      const propertySet = Object.keys(propKeyValues);
      const invalidAriaPropsForRole = [...aria.keys()]
        .filter(attribute => propertySet.indexOf(attribute) === -1);

      node.attributes.forEach((prop) => {
        if (prop.type === 'JSXSpreadAttribute') {
          return;
        }

        const name = propName(prop);
        if (invalidAriaPropsForRole.indexOf(name) > -1) {
          context.report({
            node,
            message: errorMessage(name, roleValue, type, isImplicit),
          });
        }
      });
    },
  }),
};
