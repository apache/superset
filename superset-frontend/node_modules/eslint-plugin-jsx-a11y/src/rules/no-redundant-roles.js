/**
 * @fileoverview Enforce explicit role property is not the
 * same as implicit/default role property on element.
 * @author Ethan Cohen <@evcohen>
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { elementType, getProp, getLiteralPropValue } from 'jsx-ast-utils';
import { generateObjSchema } from '../util/schemas';
import getImplicitRole from '../util/getImplicitRole';

const errorMessage = (element, implicitRole) =>
  `The element ${element} has an implicit role of ${implicitRole}. Defining this explicitly is redundant and should be avoided.`;

const schema = generateObjSchema();

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXOpeningElement: (node) => {
      const type = elementType(node);
      const implicitRole = getImplicitRole(type, node.attributes);

      if (implicitRole === '') {
        return;
      }

      const role = getProp(node.attributes, 'role');
      const roleValue = getLiteralPropValue(role);

      if (typeof roleValue === 'string' && roleValue.toUpperCase() === implicitRole.toUpperCase()) {
        context.report({
          node,
          message: errorMessage(type, implicitRole.toLowerCase()),
        });
      }
    },
  }),
};
