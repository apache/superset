/**
 * @fileoverview Enforce autoFocus prop is not used.
 * @author Ethan Cohen <@evcohen>
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { propName, elementType } from 'jsx-ast-utils';
import { dom } from 'aria-query';
import { generateObjSchema } from '../util/schemas';

const errorMessage =
  'The autoFocus prop should not be used, as it can reduce usability and accessibility for users.';

const schema = generateObjSchema({
  ignoreNonDOM: {
    type: 'boolean',
    default: false,
  },
});

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXAttribute: (attribute) => {
      // Determine if ignoreNonDOM is set to true
      // If true, then do not run rule.
      const options = context.options[0] || {};
      const ignoreNonDOM = !!options.ignoreNonDOM;

      if (ignoreNonDOM) {
        const type = elementType(attribute.parent);
        if (!dom.get(type)) {
          return;
        }
      }

      // Don't normalize, since React only recognizes autoFocus on low-level DOM elements.
      if (propName(attribute) === 'autoFocus') {
        context.report({
          node: attribute,
          message: errorMessage,
        });
      }
    },
  }),
};
