/**
 * @fileoverview Enforce scope prop is only used on <th> elements.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { dom } from 'aria-query';
import { propName, elementType } from 'jsx-ast-utils';
import { generateObjSchema } from '../util/schemas';

const errorMessage = 'The scope prop can only be used on <th> elements.';

const schema = generateObjSchema();

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXAttribute: (node) => {
      const name = propName(node);
      if (name && name.toUpperCase() !== 'SCOPE') {
        return;
      }

      const { parent } = node;
      const tagName = elementType(parent);

      // Do not test higher level JSX components, as we do not know what
      // low-level DOM element this maps to.
      if (!dom.has(tagName)) {
        return;
      } else if (tagName && tagName.toUpperCase() === 'TH') {
        return;
      }

      context.report({
        node,
        message: errorMessage,
      });
    },
  }),
};
