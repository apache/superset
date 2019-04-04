'use strict';

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

/**
 * @fileoverview Enforce distracting elements are not used.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = function errorMessage(element) {
  return 'Do not use <' + element + '> elements as they can create visual accessibility issues and are deprecated.';
};

var DEFAULT_ELEMENTS = ['marquee', 'blink'];

var schema = (0, _schemas.generateObjSchema)({
  elements: (0, _schemas.enumArraySchema)(DEFAULT_ELEMENTS)
});

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXOpeningElement: function JSXOpeningElement(node) {
        var options = context.options[0] || {};
        var elementOptions = options.elements || DEFAULT_ELEMENTS;
        var type = (0, _jsxAstUtils.elementType)(node);
        var distractingElement = elementOptions.find(function (element) {
          return type === element;
        });

        if (distractingElement) {
          context.report({
            node: node,
            message: errorMessage(distractingElement)
          });
        }
      }
    };
  }
};