/**
 * @fileoverview Enforce img alt attribute does not have the word image, picture, or photo.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { getProp, getLiteralPropValue, elementType } from 'jsx-ast-utils';
import { generateObjSchema, arraySchema } from '../util/schemas';
import isHiddenFromScreenReader from '../util/isHiddenFromScreenReader';

const REDUNDANT_WORDS = [
  'image',
  'photo',
  'picture',
];

const errorMessage = 'Redundant alt attribute. Screen-readers already announce ' +
  '`img` tags as an image. You don\'t need to use the words `image`, ' +
  '`photo,` or `picture` (or any specified custom words) in the alt prop.';

const schema = generateObjSchema({
  components: arraySchema,
  words: arraySchema,
});

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXOpeningElement: (node) => {
      const options = context.options[0] || {};
      const componentOptions = options.components || [];
      const typesToValidate = ['img'].concat(componentOptions);
      const nodeType = elementType(node);

      // Only check 'label' elements and custom types.
      if (typesToValidate.indexOf(nodeType) === -1) {
        return;
      }

      const altProp = getProp(node.attributes, 'alt');
      // Return if alt prop is not present.
      if (altProp === undefined) {
        return;
      }

      const value = getLiteralPropValue(altProp);
      const isVisible = isHiddenFromScreenReader(nodeType, node.attributes) === false;

      const {
        words = [],
      } = options;
      const redundantWords = REDUNDANT_WORDS.concat(words);

      if (typeof value === 'string' && isVisible) {
        const hasRedundancy = redundantWords
          .some(word => Boolean(value.match(new RegExp(`(?!{)\\b${word}\\b(?!})`, 'i'))));

        if (hasRedundancy === true) {
          context.report({
            node,
            message: errorMessage,
          });
        }
      }
    },
  }),
};
