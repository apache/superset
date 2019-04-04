'use strict';

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

var _ISO = require('../util/attributes/ISO.json');

var _ISO2 = _interopRequireDefault(_ISO);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var errorMessage = 'lang attribute must have a valid value.'; /**
                                                               * @fileoverview Enforce lang attribute has a valid value.
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
      JSXAttribute: function JSXAttribute(node) {
        var name = (0, _jsxAstUtils.propName)(node);
        if (name && name.toUpperCase() !== 'LANG') {
          return;
        }

        var parent = node.parent;

        var type = (0, _jsxAstUtils.elementType)(parent);
        if (type && type !== 'html') {
          return;
        }

        var value = (0, _jsxAstUtils.getLiteralPropValue)(node);

        // Don't check identifiers
        if (value === null) {
          return;
        } else if (value === undefined) {
          context.report({
            node: node,
            message: errorMessage
          });

          return;
        }

        var hyphen = value.indexOf('-');
        var lang = hyphen > -1 ? value.substring(0, hyphen) : value;
        var country = hyphen > -1 ? value.substring(3) : undefined;

        if (_ISO2.default.languages.indexOf(lang) > -1 && (country === undefined || _ISO2.default.countries.indexOf(country) > -1)) {
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