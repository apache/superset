'use strict';

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

var _getImplicitRole = require('../util/getImplicitRole');

var _getImplicitRole2 = _interopRequireDefault(_getImplicitRole);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var errorMessage = function errorMessage(element, implicitRole) {
  return 'The element ' + element + ' has an implicit role of ' + implicitRole + '. Defining this explicitly is redundant and should be avoided.';
}; /**
    * @fileoverview Enforce explicit role property is not the
    * same as implicit/default role property on element.
    * @author Ethan Cohen <@evcohen>
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
        var type = (0, _jsxAstUtils.elementType)(node);
        var implicitRole = (0, _getImplicitRole2.default)(type, node.attributes);

        if (implicitRole === '') {
          return;
        }

        var role = (0, _jsxAstUtils.getProp)(node.attributes, 'role');
        var roleValue = (0, _jsxAstUtils.getLiteralPropValue)(role);

        if (typeof roleValue === 'string' && roleValue.toUpperCase() === implicitRole.toUpperCase()) {
          context.report({
            node: node,
            message: errorMessage(type, implicitRole.toLowerCase())
          });
        }
      }
    };
  }
};