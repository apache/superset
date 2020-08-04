/**
 * @fileoverview Enforce static elements have no interactive handlers.
 * @author Ethan Cohen
 * @flow
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import {
  dom,
} from 'aria-query';
import {
  elementType,
  eventHandlers,
  getPropValue,
  getProp,
  hasProp,
} from 'jsx-ast-utils';
import type { JSXOpeningElement } from 'ast-types-flow';
import includes from 'array-includes';
import type { ESLintContext } from '../../flow/eslint';
import { arraySchema, generateObjSchema } from '../util/schemas';
import isAbstractRole from '../util/isAbstractRole';
import isHiddenFromScreenReader from '../util/isHiddenFromScreenReader';
import isInteractiveElement from '../util/isInteractiveElement';
import isInteractiveRole from '../util/isInteractiveRole';
import isNonInteractiveElement from '../util/isNonInteractiveElement';
import isNonInteractiveRole from '../util/isNonInteractiveRole';
import isPresentationRole from '../util/isPresentationRole';

const errorMessage =
  'Static HTML elements with event handlers require a role.';

const domElements = [...dom.keys()];
const defaultInteractiveProps = eventHandlers;
const schema = generateObjSchema({
  handlers: arraySchema,
});

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: (context: ESLintContext) => {
    const options = context.options;
    return {
      JSXOpeningElement: (
        node: JSXOpeningElement,
      ) => {
        const attributes = node.attributes;
        const type = elementType(node);
        const interactiveProps = options[0]
          ? options[0].handlers
          : defaultInteractiveProps;

        const hasInteractiveProps = interactiveProps
          .some(prop => (
            hasProp(attributes, prop)
            && getPropValue(getProp(attributes, prop)) != null
          ));

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
        } else if (
          isInteractiveElement(type, attributes)
          || isInteractiveRole(type, attributes)
          || isNonInteractiveElement(type, attributes)
          || isNonInteractiveRole(type, attributes)
          || isAbstractRole(type, attributes)
        ) {
          // This rule has no opinion about abstract roles.
          return;
        }

        // Visible, non-interactive elements should not have an interactive handler.
        context.report({
          node,
          message: errorMessage,
        });
      },
    };
  },
};
