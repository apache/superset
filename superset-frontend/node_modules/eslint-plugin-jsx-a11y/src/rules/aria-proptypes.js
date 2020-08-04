/**
 * @fileoverview Enforce ARIA state and property values are valid.
 * @author Ethan Cohen
 */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

import { aria } from 'aria-query';
import { getLiteralPropValue, propName } from 'jsx-ast-utils';
import { generateObjSchema } from '../util/schemas';

const errorMessage = (name, type, permittedValues) => {
  switch (type) {
    case 'tristate':
      return `The value for ${name} must be a boolean or the string "mixed".`;
    case 'token':
      return `The value for ${name} must be a single token from the following: ${permittedValues}.`;
    case 'tokenlist':
      return `The value for ${name} must be a list of one or more \
tokens from the following: ${permittedValues}.`;
    case 'boolean':
    case 'string':
    case 'integer':
    case 'number':
    default:
      return `The value for ${name} must be a ${type}.`;
  }
};

const validityCheck = (value, expectedType, permittedValues) => {
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
      return typeof value === 'string' &&
        value.split(' ').every(token => permittedValues.indexOf(token.toLowerCase()) > -1);
    default:
      return false;
  }
};

const schema = generateObjSchema();

module.exports = {
  validityCheck,
  meta: {
    docs: {},
    schema: [schema],
  },

  create: context => ({
    JSXAttribute: (attribute) => {
      const name = propName(attribute);
      const normalizedName = name ? name.toLowerCase() : '';

      // Not a valid aria-* state or property.
      if (normalizedName.indexOf('aria-') !== 0 || aria.get(normalizedName) === undefined) {
        return;
      }

      const value = getLiteralPropValue(attribute);

      // We only want to check literal prop values, so just pass if it's null.
      if (value === null) {
        return;
      }

      // These are the attributes of the property/state to check against.
      const attributes = aria.get(normalizedName);
      const permittedType = attributes.type;
      const allowUndefined = attributes.allowUndefined || false;
      const permittedValues = attributes.values || [];

      const isValid = validityCheck(value, permittedType, permittedValues) ||
        (allowUndefined && value === undefined);

      if (isValid) {
        return;
      }

      context.report({
        node: attribute,
        message: errorMessage(name, permittedType, permittedValues),
      });
    },
  }),
};
