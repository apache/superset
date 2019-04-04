'use strict';

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

/**
 * @fileoverview Enforce iframe elements have a title attribute.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = '<iframe> elements must have a unique title property.';

var schema = (0, _schemas.generateObjSchema)();

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXOpeningElement: function JSXOpeningElement(node) {
        var type = (0, _jsxAstUtils.elementType)(node);

        if (type && type !== 'iframe') {
          return;
        }

        var title = (0, _jsxAstUtils.getPropValue)((0, _jsxAstUtils.getProp)(node.attributes, 'title'));

        if (title && typeof title === 'string') {
          return;
        }

        context.report({
          node: node,
          message: errorMessage
        });
      }
    };
  }
};