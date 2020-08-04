/**
 * @fileoverview Enforce label tags have htmlFor attribute.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { getProp, getPropValue, elementType } from 'jsx-ast-utils';
import { generateObjSchema, arraySchema, enumArraySchema } from '../util/schemas';

const errorMessage = 'Form label must have associated control';

const enumValues = ['nesting', 'id'];
const schema = {
  type: 'object',
  properties: {
    components: arraySchema,
    required: {
      oneOf: [
        { type: 'string', enum: enumValues },
        generateObjSchema({ some: enumArraySchema(enumValues) }, ['some']),
        generateObjSchema({ every: enumArraySchema(enumValues) }, ['every']),
      ],
    },
  },
};

const validateNesting = node => !!node.parent.children.find(child => child.type === 'JSXElement');
const validateId = (node) => {
  const htmlForAttr = getProp(node.attributes, 'htmlFor');
  const htmlForValue = getPropValue(htmlForAttr);

  return htmlForAttr !== false && !!htmlForValue;
};
const validate = (node, required) => (
  required === 'nesting' ? validateNesting(node) : validateId(node)
);

const isValid = (node, required) => {
  if (Array.isArray(required.some)) {
    return required.some.some(rule => validate(node, rule));
  } else if (Array.isArray(required.every)) {
    return required.every.every(rule => validate(node, rule));
  }

  return validate(node, required);
};

module.exports = {
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXOpeningElement: (node) => {
      const options = context.options[0] || {};
      const componentOptions = options.components || [];
      const typesToValidate = ['label'].concat(componentOptions);
      const nodeType = elementType(node);

      // Only check 'label' elements and custom types.
      if (typesToValidate.indexOf(nodeType) === -1) {
        return;
      }

      const required = options.required || 'id';

      if (!isValid(node, required)) {
        context.report({
          node,
          message: errorMessage,
        });
      }
    },
  }),
};
