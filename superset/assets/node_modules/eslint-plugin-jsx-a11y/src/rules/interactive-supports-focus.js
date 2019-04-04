/**
 * @fileoverview Enforce that elements with onClick handlers must be tabbable.
 * @author Ethan Cohen
 * @flow
 */

import {
  dom,
  roles,
} from 'aria-query';
import {
  getProp,
  elementType,
  eventHandlersByType,
  getLiteralPropValue,
  hasAnyProp,
} from 'jsx-ast-utils';
import type { JSXOpeningElement } from 'ast-types-flow';
import includes from 'array-includes';
import type { ESLintContext } from '../../flow/eslint';
import {
  enumArraySchema,
  generateObjSchema,
} from '../util/schemas';
import isHiddenFromScreenReader from '../util/isHiddenFromScreenReader';
import isInteractiveElement from '../util/isInteractiveElement';
import isInteractiveRole from '../util/isInteractiveRole';
import isNonInteractiveElement from '../util/isNonInteractiveElement';
import isNonInteractiveRole from '../util/isNonInteractiveRole';
import isPresentationRole from '../util/isPresentationRole';
import getTabIndex from '../util/getTabIndex';

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

const schema = generateObjSchema({
  tabbable: enumArraySchema(
    [...roles.keys()]
      .filter(name => !roles.get(name).abstract)
      .filter(name => roles.get(name).superClass.some(
        klasses => includes(klasses, 'widget')),
      ),
  ),
});
const domElements = [...dom.keys()];

const interactiveProps = [
  ...eventHandlersByType.mouse,
  ...eventHandlersByType.keyboard,
];

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: (context: ESLintContext & {
    options: {
      tabbable: Array<string>
    }
  }) => ({
    JSXOpeningElement: (
      node: JSXOpeningElement,
    ) => {
      const tabbable = (
        context.options && context.options[0] && context.options[0].tabbable
      ) || [];
      const attributes = node.attributes;
      const type = elementType(node);
      const hasInteractiveProps = hasAnyProp(attributes, interactiveProps);
      const hasTabindex = getTabIndex(
        getProp(attributes, 'tabIndex'),
      ) !== undefined;

      if (!includes(domElements, type)) {
        // Do not test higher level JSX components, as we do not know what
        // low-level DOM element this maps to.
        return;
      } else if (
        !hasInteractiveProps
        || isHiddenFromScreenReader(type, attributes)
        || isPresentationRole(type, attributes)
      ) {
        // Presentation is an intentional signal from the author that this
        // element is not meant to be perceivable. For example, a click screen
        // to close a dialog .
        return;
      }

      if (
        hasInteractiveProps
        && isInteractiveRole(type, attributes)
        && !isInteractiveElement(type, attributes)
        && !isNonInteractiveElement(type, attributes)
        && !isNonInteractiveRole(type, attributes)
        && !hasTabindex
      ) {
        const role = getLiteralPropValue(getProp(attributes, 'role'));
        if (includes(tabbable, role)) {
          // Always tabbable, tabIndex = 0
          context.report({
            node,
            message: `Elements with the '${role}' interactive role must be tabbable.`,
          });
        } else {
          // Focusable, tabIndex = -1 or 0
          context.report({
            node,
            message: `Elements with the '${role}' interactive role must be focusable.`,
          });
        }
      }
    },
  }),
};
