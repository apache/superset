/**
 * @fileoverview Enforce all elements that require alternative text have it.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { getProp, getPropValue, elementType, getLiteralPropValue } from 'jsx-ast-utils';
import { generateObjSchema, arraySchema } from '../util/schemas';
import hasAccessibleChild from '../util/hasAccessibleChild';
import isPresentationRole from '../util/isPresentationRole';

const DEFAULT_ELEMENTS = [
  'img',
  'object',
  'area',
  'input[type="image"]',
];

const schema = generateObjSchema({
  elements: arraySchema,
  img: arraySchema,
  object: arraySchema,
  area: arraySchema,
  'input[type="image"]': arraySchema,
});

const ruleByElement = {
  img(context, node) {
    const nodeType = elementType(node);

    const altProp = getProp(node.attributes, 'alt');

    // Missing alt prop error.
    if (altProp === undefined) {
      if (isPresentationRole(nodeType, node.attributes)) {
        context.report({
          node,
          message: 'Prefer alt="" over a presentational role. First rule of aria is to not use aria if it can be achieved via native HTML.',
        });
        return;
      }
      context.report({
        node,
        message: `${nodeType} elements must have an alt prop, either with meaningful text, or an empty string for decorative images.`,
      });
      return;
    }

    // Check if alt prop is undefined.
    const altValue = getPropValue(altProp);
    const isNullValued = altProp.value === null; // <img alt />

    if ((altValue && !isNullValued) || altValue === '') {
      return;
    }

    // Undefined alt prop error.
    context.report({
      node,
      message: `Invalid alt value for ${nodeType}. Use alt="" for presentational images.`,
    });
  },

  object(context, node) {
    const ariaLabelProp = getProp(node.attributes, 'aria-label');
    const arialLabelledByProp = getProp(node.attributes, 'aria-labelledby');
    const hasLabel = ariaLabelProp !== undefined || arialLabelledByProp !== undefined;
    const titleProp = getLiteralPropValue(getProp(node.attributes, 'title'));
    const hasTitleAttr = !!titleProp;

    if (hasLabel || hasTitleAttr || hasAccessibleChild(node.parent)) {
      return;
    }

    context.report({
      node,
      message: 'Embedded <object> elements must have alternative text by providing inner text, aria-label or aria-labelledby props.',
    });
  },

  area(context, node) {
    const ariaLabelPropValue = getPropValue(getProp(node.attributes, 'aria-label'));
    const arialLabelledByPropValue = getPropValue(getProp(node.attributes, 'aria-labelledby'));
    const hasLabel = ariaLabelPropValue !== undefined || arialLabelledByPropValue !== undefined;

    if (hasLabel) {
      return;
    }

    const altProp = getProp(node.attributes, 'alt');
    if (altProp === undefined) {
      context.report({
        node,
        message: 'Each area of an image map must have a text alternative through the `alt`, `aria-label`, or `aria-labelledby` prop.',
      });
      return;
    }

    const altValue = getPropValue(altProp);
    const isNullValued = altProp.value === null; // <area alt />

    if ((altValue && !isNullValued) || altValue === '') {
      return;
    }

    context.report({
      node,
      message: 'Each area of an image map must have a text alternative through the `alt`, `aria-label`, or `aria-labelledby` prop.',
    });
  },

  'input[type="image"]': function inputImage(context, node) {
    // Only test input[type="image"]
    const nodeType = elementType(node);
    if (nodeType === 'input') {
      const typePropValue = getPropValue(getProp(node.attributes, 'type'));
      if (typePropValue !== 'image') { return; }
    }
    const ariaLabelPropValue = getPropValue(getProp(node.attributes, 'aria-label'));
    const arialLabelledByPropValue = getPropValue(getProp(node.attributes, 'aria-labelledby'));
    const hasLabel = ariaLabelPropValue !== undefined || arialLabelledByPropValue !== undefined;

    if (hasLabel) {
      return;
    }

    const altProp = getProp(node.attributes, 'alt');
    if (altProp === undefined) {
      context.report({
        node,
        message: '<input> elements with type="image" must have a text alternative through the `alt`, `aria-label`, or `aria-labelledby` prop.',
      });
      return;
    }

    const altValue = getPropValue(altProp);
    const isNullValued = altProp.value === null; // <area alt />

    if ((altValue && !isNullValued) || altValue === '') {
      return;
    }

    context.report({
      node,
      message: '<input> elements with type="image" must have a text alternative through the `alt`, `aria-label`, or `aria-labelledby` prop.',
    });
  },
};

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: (context) => {
    const options = context.options[0] || {};
    // Elements to validate for alt text.
    const elementOptions = options.elements || DEFAULT_ELEMENTS;
    // Get custom components for just the elements that will be tested.
    const customComponents = elementOptions
      .map(element => options[element])
      .reduce(
        (components, customComponentsForElement) => components.concat(
          customComponentsForElement || [],
        ),
        [],
      );
    const typesToValidate = new Set([]
      .concat(customComponents, ...elementOptions)
      .map((type) => {
        if (type === 'input[type="image"]') { return 'input'; }
        return type;
      }));


    return {
      JSXOpeningElement: (node) => {
        const nodeType = elementType(node);
        if (!typesToValidate.has(nodeType)) { return; }

        let DOMElement = nodeType;
        if (DOMElement === 'input') {
          DOMElement = 'input[type="image"]';
        }

        // Map nodeType to the DOM element if we are running this on a custom component.
        if (elementOptions.indexOf(DOMElement) === -1) {
          DOMElement = elementOptions.find((element) => {
            const customComponentsForElement = options[element] || [];
            return customComponentsForElement.indexOf(nodeType) > -1;
          });
        }

        ruleByElement[DOMElement](context, node);
      },
    };
  },
};
