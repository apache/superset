/**
 * @fileoverview Enforce that elements that do not support ARIA roles,
 *  states and properties do not have those attributes.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import {
  aria,
  dom,
} from 'aria-query';
import { elementType, propName } from 'jsx-ast-utils';
import { generateObjSchema } from '../util/schemas';

const errorMessage = invalidProp =>
  `This element does not support ARIA roles, states and properties. \
Try removing the prop '${invalidProp}'.`;

const schema = generateObjSchema();

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXOpeningElement: (node) => {
      const nodeType = elementType(node);
      const nodeAttrs = dom.get(nodeType) || {};
      const {
        reserved: isReservedNodeType = false,
      } = nodeAttrs;

      // If it's not reserved, then it can have aria-* roles, states, and properties
      if (isReservedNodeType === false) {
        return;
      }

      const invalidAttributes = [...aria.keys()].concat('role');

      node.attributes.forEach((prop) => {
        if (prop.type === 'JSXSpreadAttribute') {
          return;
        }

        const name = propName(prop);
        const normalizedName = name ? name.toLowerCase() : '';

        if (invalidAttributes.indexOf(normalizedName) > -1) {
          context.report({
            node,
            message: errorMessage(name),
          });
        }
      });
    },
  }),
};
