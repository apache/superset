/**
 * @fileoverview Enforce onmouseover/onmouseout are
 *  accompanied by onfocus/onblur.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { getProp, getPropValue } from 'jsx-ast-utils';
import { generateObjSchema } from '../util/schemas';

const mouseOverErrorMessage = 'onMouseOver must be accompanied by onFocus for accessibility.';
const mouseOutErrorMessage = 'onMouseOut must be accompanied by onBlur for accessibility.';

const schema = generateObjSchema();

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXOpeningElement: (node) => {
      const attributes = node.attributes;

      // Check onmouseover / onfocus pairing.
      const onMouseOver = getProp(attributes, 'onMouseOver');
      const onMouseOverValue = getPropValue(onMouseOver);

      if (onMouseOver && (onMouseOverValue !== null || onMouseOverValue !== undefined)) {
        const hasOnFocus = getProp(attributes, 'onFocus');
        const onFocusValue = getPropValue(hasOnFocus);

        if (hasOnFocus === false || onFocusValue === null || onFocusValue === undefined) {
          context.report({
            node,
            message: mouseOverErrorMessage,
          });
        }
      }

      // Checkout onmouseout / onblur pairing
      const onMouseOut = getProp(attributes, 'onMouseOut');
      const onMouseOutValue = getPropValue(onMouseOut);
      if (onMouseOut && (onMouseOutValue !== null || onMouseOutValue !== undefined)) {
        const hasOnBlur = getProp(attributes, 'onBlur');
        const onBlurValue = getPropValue(hasOnBlur);

        if (hasOnBlur === false || onBlurValue === null || onBlurValue === undefined) {
          context.report({
            node,
            message: mouseOutErrorMessage,
          });
        }
      }
    },
  }),
};
