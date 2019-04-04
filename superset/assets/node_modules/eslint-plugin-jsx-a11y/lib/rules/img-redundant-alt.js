'use strict';

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

var _isHiddenFromScreenReader = require('../util/isHiddenFromScreenReader');

var _isHiddenFromScreenReader2 = _interopRequireDefault(_isHiddenFromScreenReader);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var REDUNDANT_WORDS = ['image', 'photo', 'picture']; /**
                                                      * @fileoverview Enforce img alt attribute does not have the word image, picture, or photo.
                                                      * @author Ethan Cohen
                                                      */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = 'Redundant alt attribute. Screen-readers already announce ' + '`img` tags as an image. You don\'t need to use the words `image`, ' + '`photo,` or `picture` (or any specified custom words) in the alt prop.';

var schema = (0, _schemas.generateObjSchema)({
  components: _schemas.arraySchema,
  words: _schemas.arraySchema
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
        var typesToValidate = ['img'].concat(componentOptions);
        var nodeType = (0, _jsxAstUtils.elementType)(node);

        // Only check 'label' elements and custom types.
        if (typesToValidate.indexOf(nodeType) === -1) {
          return;
        }

        var altProp = (0, _jsxAstUtils.getProp)(node.attributes, 'alt');
        // Return if alt prop is not present.
        if (altProp === undefined) {
          return;
        }

        var value = (0, _jsxAstUtils.getLiteralPropValue)(altProp);
        var isVisible = (0, _isHiddenFromScreenReader2.default)(nodeType, node.attributes) === false;

        var _options$words = options.words,
            words = _options$words === undefined ? [] : _options$words;

        var redundantWords = REDUNDANT_WORDS.concat(words);

        if (typeof value === 'string' && isVisible) {
          var hasRedundancy = redundantWords.some(function (word) {
            return Boolean(value.match(new RegExp('(?!{)\\b' + word + '\\b(?!})', 'i')));
          });

          if (hasRedundancy === true) {
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