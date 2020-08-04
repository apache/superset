'use strict';

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

/**
 * @fileoverview Enforce label tags have htmlFor attribute.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = 'Form label must have associated control';

var enumValues = ['nesting', 'id'];
var schema = {
  type: 'object',
  properties: {
    components: _schemas.arraySchema,
    required: {
      oneOf: [{ type: 'string', enum: enumValues }, (0, _schemas.generateObjSchema)({ some: (0, _schemas.enumArraySchema)(enumValues) }, ['some']), (0, _schemas.generateObjSchema)({ every: (0, _schemas.enumArraySchema)(enumValues) }, ['every'])]
    }
  }
};

var validateNesting = function validateNesting(node) {
  return !!node.parent.children.find(function (child) {
    return child.type === 'JSXElement';
  });
};
var validateId = function validateId(node) {
  var htmlForAttr = (0, _jsxAstUtils.getProp)(node.attributes, 'htmlFor');
  var htmlForValue = (0, _jsxAstUtils.getPropValue)(htmlForAttr);

  return htmlForAttr !== false && !!htmlForValue;
};
var validate = function validate(node, required) {
  return required === 'nesting' ? validateNesting(node) : validateId(node);
};

var isValid = function isValid(node, required) {
  if (Array.isArray(required.some)) {
    return required.some.some(function (rule) {
      return validate(node, rule);
    });
  } else if (Array.isArray(required.every)) {
    return required.every.every(function (rule) {
      return validate(node, rule);
    });
  }

  return validate(node, required);
};

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXOpeningElement: function JSXOpeningElement(node) {
        var options = context.options[0] || {};
        var componentOptions = options.components || [];
        var typesToValidate = ['label'].concat(componentOptions);
        var nodeType = (0, _jsxAstUtils.elementType)(node);

        // Only check 'label' elements and custom types.
        if (typesToValidate.indexOf(nodeType) === -1) {
          return;
        }

        var required = options.required || 'id';

        if (!isValid(node, required)) {
          context.report({
            node: node,
            message: errorMessage
          });
        }
      }
    };
  }
};