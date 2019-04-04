/**
 * @fileoverview Enforce elements with aria-activedescendant are tabbable.
 * @author Jesse Beach <@jessebeach>
 */

import { dom } from 'aria-query';
import { getProp, elementType } from 'jsx-ast-utils';
import { generateObjSchema } from '../util/schemas';
import getTabIndex from '../util/getTabIndex';
import isInteractiveElement from '../util/isInteractiveElement';

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

const errorMessage =
  'An element that manages focus with `aria-activedescendant` must be tabbable';

const schema = generateObjSchema();

const domElements = [...dom.keys()];

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXOpeningElement: (node) => {
      const { attributes } = node;

      if (getProp(attributes, 'aria-activedescendant') === undefined) {
        return;
      }

      const type = elementType(node);
      // Do not test higher level JSX components, as we do not know what
      // low-level DOM element this maps to.
      if (domElements.indexOf(type) === -1) {
        return;
      }
      const tabIndex = getTabIndex(getProp(attributes, 'tabIndex'));

      // If this is an interactive element, tabIndex must be either left
      // unspecified allowing the inherent tabIndex to obtain or it must be
      // zero (allowing for positive, even though that is not ideal). It cannot
      // be given a negative value.
      if (
        isInteractiveElement(type, attributes)
        && (
          tabIndex === undefined
          || tabIndex >= 0
        )
      ) {
        return;
      }

      if (tabIndex >= 0) {
        return;
      }

      context.report({
        node,
        message: errorMessage,
      });
    },
  }),
};
