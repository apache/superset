'use strict';

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * @fileoverview Enforce that elements with ARIA roles must
                                                                                                                                                                                                     *  have all required attributes for that role.
                                                                                                                                                                                                     * @author Ethan Cohen
                                                                                                                                                                                                     */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = function errorMessage(role, requiredProps) {
  return 'Elements with the ARIA role "' + role + '" must have the following ' + ('attributes defined: ' + String(requiredProps).toLowerCase());
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

        if (normalizedName !== 'role') {
          return;
        }

        var value = (0, _jsxAstUtils.getLiteralPropValue)(attribute);

        // If value is undefined, then the role attribute will be dropped in the DOM.
        // If value is null, then getLiteralAttributeValue is telling us
        // that the value isn't in the form of a literal.
        if (value === undefined || value === null) {
          return;
        }

        var normalizedValues = String(value).toLowerCase().split(' ');
        var validRoles = normalizedValues.filter(function (val) {
          return [].concat(_toConsumableArray(_ariaQuery.roles.keys())).indexOf(val) > -1;
        });

        validRoles.forEach(function (role) {
          var _roles$get = _ariaQuery.roles.get(role),
              requiredPropKeyValues = _roles$get.requiredProps;

          var requiredProps = Object.keys(requiredPropKeyValues);

          if (requiredProps.length > 0) {
            var hasRequiredProps = requiredProps.every(function (prop) {
              return (0, _jsxAstUtils.getProp)(attribute.parent.attributes, prop);
            });
            if (hasRequiredProps === false) {
              context.report({
                node: attribute,
                message: errorMessage(role.toLowerCase(), requiredProps)
              });
            }
          }
        });
      }
    };
  }
};