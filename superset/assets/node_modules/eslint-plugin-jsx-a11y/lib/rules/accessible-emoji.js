'use strict';

var _emojiRegex = require('emoji-regex');

var _emojiRegex2 = _interopRequireDefault(_emojiRegex);

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var errorMessage = 'Emojis should be wrapped in <span>, have role="img", and have an accessible description with aria-label or aria-labelledby.'; /**
                                                                                                                                                   * @fileoverview Enforce emojis are wrapped in <span> and provide screenreader access.
                                                                                                                                                   * @author Ethan Cohen
                                                                                                                                                   */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var schema = (0, _schemas.generateObjSchema)();

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXOpeningElement: function JSXOpeningElement(node) {
        var literalChildValue = node.parent.children.find(function (child) {
          return child.type === 'Literal';
        });

        if (literalChildValue && (0, _emojiRegex2.default)().test(literalChildValue.value)) {
          var rolePropValue = (0, _jsxAstUtils.getLiteralPropValue)((0, _jsxAstUtils.getProp)(node.attributes, 'role'));
          var ariaLabelProp = (0, _jsxAstUtils.getProp)(node.attributes, 'aria-label');
          var arialLabelledByProp = (0, _jsxAstUtils.getProp)(node.attributes, 'aria-labelledby');
          var hasLabel = ariaLabelProp !== undefined || arialLabelledByProp !== undefined;
          var isSpan = (0, _jsxAstUtils.elementType)(node) === 'span';

          if (hasLabel === false || rolePropValue !== 'img' || isSpan === false) {
            context.report({
              node: node,
              message: errorMessage
            });
          }
        }
      }
    };
  }
};