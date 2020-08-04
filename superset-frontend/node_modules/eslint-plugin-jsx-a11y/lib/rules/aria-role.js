'use strict';

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * @fileoverview Enforce aria role attribute is valid.
                                                                                                                                                                                                     * @author Ethan Cohen
                                                                                                                                                                                                     */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = 'Elements with ARIA roles must use a valid, non-abstract ARIA role.';

var schema = (0, _schemas.generateObjSchema)({
  ignoreNonDOM: {
    type: 'boolean',
    default: false
  }
});

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXAttribute: function JSXAttribute(attribute) {
        // Determine if ignoreNonDOM is set to true
        // If true, then do not run rule.
        var options = context.options[0] || {};
        var ignoreNonDOM = !!options.ignoreNonDOM;

        if (ignoreNonDOM) {
          var type = (0, _jsxAstUtils.elementType)(attribute.parent);
          if (!_ariaQuery.dom.get(type)) {
            return;
          }
        }

        // Get prop name
        var name = (0, _jsxAstUtils.propName)(attribute);
        var normalizedName = name ? name.toUpperCase() : '';

        if (normalizedName !== 'ROLE') {
          return;
        }

        var value = (0, _jsxAstUtils.getLiteralPropValue)(attribute);

        // If value is undefined, then the role attribute will be dropped in the DOM.
        // If value is null, then getLiteralAttributeValue is telling us that the
        // value isn't in the form of a literal.
        if (value === undefined || value === null) {
          return;
        }

        var normalizedValues = String(value).toLowerCase().split(' ');
        var validRoles = [].concat(_toConsumableArray(_ariaQuery.roles.keys())).filter(function (role) {
          return _ariaQuery.roles.get(role).abstract === false;
        });
        var isValid = normalizedValues.every(function (val) {
          return validRoles.indexOf(val) > -1;
        });

        if (isValid === true) {
          return;
        }

        context.report({
          node: attribute,
          message: errorMessage
        });
      }
    };
  }
};