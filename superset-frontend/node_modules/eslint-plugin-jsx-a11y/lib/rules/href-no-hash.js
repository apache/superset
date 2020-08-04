'use strict';

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

/**
 * @fileoverview Enforce links may not point to just #.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = 'Links must not point to "#". ' + 'Use a more descriptive href or use a button instead.';

var schema = (0, _schemas.generateObjSchema)({
  components: _schemas.arraySchema,
  specialLink: _schemas.arraySchema
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
        var componentOptions = options.components || [];
        var typesToValidate = ['a'].concat(componentOptions);
        var nodeType = (0, _jsxAstUtils.elementType)(node);

        // Only check 'a' elements and custom types.
        if (typesToValidate.indexOf(nodeType) === -1) {
          return;
        }

        var propOptions = options.specialLink || [];
        var propsToValidate = ['href'].concat(propOptions);
        var values = propsToValidate.map(function (prop) {
          return (0, _jsxAstUtils.getProp)(node.attributes, prop);
        }).map(function (prop) {
          return (0, _jsxAstUtils.getPropValue)(prop);
        });

        values.forEach(function (value) {
          if (value === '#') {
            context.report({
              node: node,
              message: errorMessage
            });
          }
        });
      }
    };
  }
};