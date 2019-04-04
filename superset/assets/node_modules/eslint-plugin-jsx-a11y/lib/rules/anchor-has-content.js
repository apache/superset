'use strict';

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

var _hasAccessibleChild = require('../util/hasAccessibleChild');

var _hasAccessibleChild2 = _interopRequireDefault(_hasAccessibleChild);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var errorMessage = 'Anchors must have content and the content must be accessible by a screen reader.'; /**
                                                                                                        * @fileoverview Enforce anchor elements to contain accessible content.
                                                                                                        * @author Lisa Ring & Niklas Holmberg
                                                                                                        */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var schema = (0, _schemas.generateObjSchema)({ components: _schemas.arraySchema });

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
        var typeCheck = ['a'].concat(componentOptions);
        var nodeType = (0, _jsxAstUtils.elementType)(node);

        // Only check anchor elements and custom types.
        if (typeCheck.indexOf(nodeType) === -1) {
          return;
        } else if ((0, _hasAccessibleChild2.default)(node.parent)) {
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