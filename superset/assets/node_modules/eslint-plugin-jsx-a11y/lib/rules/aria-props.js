'use strict';

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

var _getSuggestion = require('../util/getSuggestion');

var _getSuggestion2 = _interopRequireDefault(_getSuggestion);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * @fileoverview Enforce all aria-* properties are valid.
                                                                                                                                                                                                     * @author Ethan Cohen
                                                                                                                                                                                                     */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var ariaAttributes = [].concat(_toConsumableArray(_ariaQuery.aria.keys()));

var errorMessage = function errorMessage(name) {
  var suggestions = (0, _getSuggestion2.default)(name, ariaAttributes);
  var message = name + ': This attribute is an invalid ARIA attribute.';

  if (suggestions.length > 0) {
    return message + ' Did you mean to use ' + suggestions + '?';
  }

  return message;
};

var schema = (0, _schemas.generateObjSchema)();

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXAttribute: function JSXAttribute(attribute) {
        var name = (0, _jsxAstUtils.propName)(attribute);
        var normalizedName = name ? name.toLowerCase() : '';

        // `aria` needs to be prefix of property.
        if (normalizedName.indexOf('aria-') !== 0) {
          return;
        }

        var isValid = ariaAttributes.indexOf(normalizedName) > -1;

        if (isValid === false) {
          context.report({
            node: attribute,
            message: errorMessage(name)
          });
        }
      }
    };
  }
};