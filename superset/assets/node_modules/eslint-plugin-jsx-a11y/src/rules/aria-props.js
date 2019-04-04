/**
 * @fileoverview Enforce all aria-* properties are valid.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { aria } from 'aria-query';
import { propName } from 'jsx-ast-utils';
import { generateObjSchema } from '../util/schemas';
import getSuggestion from '../util/getSuggestion';

const ariaAttributes = [...aria.keys()];

const errorMessage = (name) => {
  const suggestions = getSuggestion(name, ariaAttributes);
  const message = `${name}: This attribute is an invalid ARIA attribute.`;

  if (suggestions.length > 0) {
    return `${message} Did you mean to use ${suggestions}?`;
  }

  return message;
};

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

      // `aria` needs to be prefix of property.
      if (normalizedName.indexOf('aria-') !== 0) {
        return;
      }

      const isValid = ariaAttributes.indexOf(normalizedName) > -1;

      if (isValid === false) {
        context.report({
          node: attribute,
          message: errorMessage(name),
        });
      }
    },
  }),
};
