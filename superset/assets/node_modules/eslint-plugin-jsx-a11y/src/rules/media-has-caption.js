/**
 * @fileoverview <audio> and <video> elements must have a <track> for captions.
 * @author Ethan Cohen
 * @flow
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import type { JSXElement, JSXOpeningElement } from 'ast-types-flow';
import { elementType, getProp, getLiteralPropValue } from 'jsx-ast-utils';
import type { ESLintContext } from '../../flow/eslint';
import { generateObjSchema, arraySchema } from '../util/schemas';

const errorMessage = 'Media elements such as <audio> and <video> must have a <track> for captions.';

const MEDIA_TYPES = ['audio', 'video'];

const schema = generateObjSchema({
  audio: arraySchema,
  video: arraySchema,
  track: arraySchema,
});

const isMediaType = (context, type) => {
  const options = context.options[0] || {};
  return MEDIA_TYPES.map(mediaType => options[mediaType])
    .reduce((types, customComponent) => types.concat(customComponent), MEDIA_TYPES)
    .some(typeToCheck => typeToCheck === type);
};

const isTrackType = (context, type) => {
  const options = context.options[0] || {};
  return ['track'].concat(options.track || []).some(typeToCheck => typeToCheck === type);
};

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: (context: ESLintContext) => ({
    JSXElement: (node: JSXElement) => {
      const element: JSXOpeningElement = node.openingElement;
      const type = elementType(element);
      if (!isMediaType(context, type)) {
        return;
      }

      // $FlowFixMe https://github.com/facebook/flow/issues/1414
      const trackChildren: Array<JSXElement> = node.children.filter((child: Node) => {
        if (child.type !== 'JSXElement') {
          return false;
        }

        // $FlowFixMe https://github.com/facebook/flow/issues/1414
        return isTrackType(context, elementType(child.openingElement));
      });

      if (trackChildren.length === 0) {
        context.report({
          node: element,
          message: errorMessage,
        });
        return;
      }

      const hasCaption: boolean = trackChildren.some((track) => {
        const kindProp = getProp(track.openingElement.attributes, 'kind');
        const kindPropValue = getLiteralPropValue(kindProp) || '';
        return kindPropValue.toLowerCase() === 'captions';
      });

      if (!hasCaption) {
        context.report({
          node: element,
          message: errorMessage,
        });
      }
    },
  }),
};
