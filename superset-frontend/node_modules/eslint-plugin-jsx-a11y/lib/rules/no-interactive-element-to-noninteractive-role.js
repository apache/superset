'use strict';

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _arrayIncludes = require('array-includes');

var _arrayIncludes2 = _interopRequireDefault(_arrayIncludes);

var _isInteractiveElement = require('../util/isInteractiveElement');

var _isInteractiveElement2 = _interopRequireDefault(_isInteractiveElement);

var _isNonInteractiveRole = require('../util/isNonInteractiveRole');

var _isNonInteractiveRole2 = _interopRequireDefault(_isNonInteractiveRole);

var _isPresentationRole = require('../util/isPresentationRole');

var _isPresentationRole2 = _interopRequireDefault(_isPresentationRole);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * @fileoverview Disallow inherently interactive elements to be assigned
                                                                                                                                                                                                     * non-interactive roles.
                                                                                                                                                                                                     * @author Jesse Beach
                                                                                                                                                                                                     * 
                                                                                                                                                                                                     */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = 'Interactive elements should not be assigned non-interactive roles.';

var domElements = [].concat(_toConsumableArray(_ariaQuery.dom.keys()));

module.exports = {
  meta: {
    docs: {},
    schema: [{
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'string'
        },
        uniqueItems: true
      }
    }]
  },

  create: function create(context) {
    var options = context.options;
    return {
      JSXAttribute: function JSXAttribute(attribute) {
        var attributeName = (0, _jsxAstUtils.propName)(attribute);
        if (attributeName !== 'role') {
          return;
        }
        var node = attribute.parent;
        var attributes = node.attributes;
        var type = (0, _jsxAstUtils.elementType)(node);
        var role = (0, _jsxAstUtils.getLiteralPropValue)((0, _jsxAstUtils.getProp)(node.attributes, 'role'));

        if (!(0, _arrayIncludes2.default)(domElements, type)) {
          // Do not test higher level JSX components, as we do not know what
          // low-level DOM element this maps to.
          return;
        }
        // Allow overrides from rule configuration for specific elements and
        // roles.
        var allowedRoles = options[0] || {};
        if (Object.prototype.hasOwnProperty.call(allowedRoles, type) && (0, _arrayIncludes2.default)(allowedRoles[type], role)) {
          return;
        }
        if ((0, _isInteractiveElement2.default)(type, attributes) && ((0, _isNonInteractiveRole2.default)(type, attributes) || (0, _isPresentationRole2.default)(type, attributes))) {
          // Visible, non-interactive elements should not have an interactive handler.
          context.report({
            node: attribute,
            message: errorMessage
          });
        }
      }
    };
  }
};