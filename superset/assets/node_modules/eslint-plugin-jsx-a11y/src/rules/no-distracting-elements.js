/**
 * @fileoverview Enforce distracting elements are not used.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { elementType } from 'jsx-ast-utils';
import { generateObjSchema, enumArraySchema } from '../util/schemas';

const errorMessage = element =>
  `Do not use <${element}> elements as they can create visual accessibility issues and are deprecated.`;


const DEFAULT_ELEMENTS = [
  'marquee',
  'blink',
];

const schema = generateObjSchema({
  elements: enumArraySchema(DEFAULT_ELEMENTS),
});

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXOpeningElement: (node) => {
      const options = context.options[0] || {};
      const elementOptions = options.elements || DEFAULT_ELEMENTS;
      const type = elementType(node);
      const distractingElement = elementOptions.find(element => type === element);

      if (distractingElement) {
        context.report({
          node,
          message: errorMessage(distractingElement),
        });
      }
    },
  }),
};
