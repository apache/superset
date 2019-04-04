'use strict';

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

var _hasAccessibleChild = require('../util/hasAccessibleChild');

var _hasAccessibleChild2 = _interopRequireDefault(_hasAccessibleChild);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var errorMessage = 'Headings must have content and the content must be accessible by a screen reader.'; /**
                                                                                                         * @fileoverview Enforce heading (h1, h2, etc) elements contain accessible content.
                                                                                                         * @author Ethan Cohen
                                                                                                         */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

var schema = (0, _schemas.generateObjSchema)({ components: _schemas.arraySchema });

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXOpeningElement: function JSXOpeningElement(node) {
        var typeCheck = headings.concat(context.options[0]);
        var nodeType = (0, _jsxAstUtils.elementType)(node);

        // Only check 'h*' elements and custom types.
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