'use strict';

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

var errorMessage = function errorMessage(name, type, permittedValues) {
  switch (type) {
    case 'tristate':
      return 'The value for ' + name + ' must be a boolean or the string "mixed".';
    case 'token':
      return 'The value for ' + name + ' must be a single token from the following: ' + permittedValues + '.';
    case 'tokenlist':
      return 'The value for ' + name + ' must be a list of one or more tokens from the following: ' + permittedValues + '.';
    case 'boolean':
    case 'string':
    case 'integer':
    case 'number':
    default:
      return 'The value for ' + name + ' must be a ' + type + '.';
  }
}; /**
    * @fileoverview Enforce ARIA state and property values are valid.
    * @author Ethan Cohen
    */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var validityCheck = function validityCheck(value, expectedType, permittedValues) {
  switch (expectedType) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'tristate':
      return typeof value === 'boolean' || value === 'mixed';
    case 'integer':
    case 'number':
      // Booleans resolve to 0/1 values so hard check that it's not first.
      return typeof value !== 'boolean' && isNaN(Number(value)) === false;
    case 'token':
      return permittedValues.indexOf(typeof value === 'string' ? value.toLowerCase() : value) > -1;
    case 'tokenlist':
      return typeof value === 'string' && value.split(' ').every(function (token) {
        return permittedValues.indexOf(token.toLowerCase()) > -1;
      });
    default:
      return false;
  }
};

var schema = (0, _schemas.generateObjSchema)();

module.exports = {
  validityCheck: validityCheck,
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXAttribute: function JSXAttribute(attribute) {
        var name = (0, _jsxAstUtils.propName)(attribute);
        var normalizedName = name ? name.toLowerCase() : '';

        // Not a valid aria-* state or property.
        if (normalizedName.indexOf('aria-') !== 0 || _ariaQuery.aria.get(normalizedName) === undefined) {
          return;
        }

        var value = (0, _jsxAstUtils.getLiteralPropValue)(attribute);

        // We only want to check literal prop values, so just pass if it's null.
        if (value === null) {
          return;
        }

        // These are the attributes of the property/state to check against.
        var attributes = _ariaQuery.aria.get(normalizedName);
        var permittedType = attributes.type;
        var allowUndefined = attributes.allowUndefined || false;
        var permittedValues = attributes.values || [];

        var isValid = validityCheck(value, permittedType, permittedValues) || allowUndefined && value === undefined;

        if (isValid) {
          return;
        }

        context.report({
          node: attribute,
          message: errorMessage(name, permittedType, permittedValues)
        });
      }
    };
  }
};