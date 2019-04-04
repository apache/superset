/**
 * @fileoverview Enforce html element has lang prop.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { elementType, getProp, getPropValue } from 'jsx-ast-utils';
import { generateObjSchema } from '../util/schemas';

const errorMessage = '<html> elements must have the lang prop.';

const schema = generateObjSchema();

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXOpeningElement: (node) => {
      const type = elementType(node);

      if (type && type !== 'html') {
        return;
      }

      const lang = getPropValue(getProp(node.attributes, 'lang'));

      if (lang) {
        return;
      }

      context.report({
        node,
        message: errorMessage,
      });
    },
  }),
};
