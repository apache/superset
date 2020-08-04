'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /**
                                                                                                                                                                                                                                                                   * @fileoverview Disallow tabindex on static and noninteractive elements
                                                                                                                                                                                                                                                                   * @author jessebeach
                                                                                                                                                                                                                                                                   * 
                                                                                                                                                                                                                                                                   */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _arrayIncludes = require('array-includes');

var _arrayIncludes2 = _interopRequireDefault(_arrayIncludes);

var _isInteractiveElement = require('../util/isInteractiveElement');

var _isInteractiveElement2 = _interopRequireDefault(_isInteractiveElement);

var _isInteractiveRole = require('../util/isInteractiveRole');

var _isInteractiveRole2 = _interopRequireDefault(_isInteractiveRole);

var _schemas = require('../util/schemas');

var _getTabIndex = require('../util/getTabIndex');

var _getTabIndex2 = _interopRequireDefault(_getTabIndex);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var errorMessage = '`tabIndex` should only be declared on interactive elements.';

var schema = (0, _schemas.generateObjSchema)({
  roles: _extends({}, _schemas.arraySchema, {
    description: 'An array of ARIA roles'
  }),
  tags: _extends({}, _schemas.arraySchema, {
    description: 'An array of HTML tag names'
  })
});

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    var options = context.options;
    return {
      JSXOpeningElement: function JSXOpeningElement(node) {
        var type = (0, _jsxAstUtils.elementType)(node);
        var attributes = node.attributes;
        var tabIndexProp = (0, _jsxAstUtils.getProp)(attributes, 'tabIndex');
        var tabIndex = (0, _getTabIndex2.default)(tabIndexProp);
        // Early return;
        if (typeof tabIndex === 'undefined') {
          return;
        }
        var role = (0, _jsxAstUtils.getLiteralPropValue)((0, _jsxAstUtils.getProp)(node.attributes, 'role'));

        if (!_ariaQuery.dom.has(type)) {
          // Do not test higher level JSX components, as we do not know what
          // low-level DOM element this maps to.
          return;
        }
        // Allow for configuration overrides.

        var _ref = options[0] || {},
            tags = _ref.tags,
            roles = _ref.roles;

        if (tags && (0, _arrayIncludes2.default)(tags, type) || roles && (0, _arrayIncludes2.default)(roles, role)) {
          return;
        }
        if ((0, _isInteractiveElement2.default)(type, attributes) || (0, _isInteractiveRole2.default)(type, attributes)) {
          return;
        }
        if (tabIndex >= 0) {
          context.report({
            node: tabIndexProp,
            message: errorMessage
          });
        }
      }
    };
  }
};