/**
 * @fileoverview Enforce that elements with ARIA roles must
 *  have all required attributes for that role.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { roles } from 'aria-query';
import { getProp, getLiteralPropValue, propName } from 'jsx-ast-utils';
import { generateObjSchema } from '../util/schemas';

const errorMessage = (role, requiredProps) =>
  `Elements with the ARIA role "${role}" must have the following ` +
  `attributes defined: ${String(requiredProps).toLowerCase()}`;

const schema = generateObjSchema();

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXAttribute: (attribute) => {
      const name = propName(attribute);
      const normalizedName = name ? name.toLowerCase() : '';

      if (normalizedName !== 'role') {
        return;
      }

      const value = getLiteralPropValue(attribute);

      // If value is undefined, then the role attribute will be dropped in the DOM.
      // If value is null, then getLiteralAttributeValue is telling us
      // that the value isn't in the form of a literal.
      if (value === undefined || value === null) {
        return;
      }

      const normalizedValues = String(value).toLowerCase().split(' ');
      const validRoles = normalizedValues
        .filter(val => [...roles.keys()].indexOf(val) > -1);

      validRoles.forEach((role) => {
        const {
          requiredProps: requiredPropKeyValues,
        } = roles.get(role);
        const requiredProps = Object.keys(requiredPropKeyValues);

        if (requiredProps.length > 0) {
          const hasRequiredProps = requiredProps
            .every(prop => getProp(attribute.parent.attributes, prop));
          if (hasRequiredProps === false) {
            context.report({
              node: attribute,
              message: errorMessage(role.toLowerCase(), requiredProps),
            });
          }
        }
      });
    },
  }),
};
