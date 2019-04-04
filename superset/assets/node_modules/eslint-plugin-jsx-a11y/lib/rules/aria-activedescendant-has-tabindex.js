'use strict';

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _schemas = require('../util/schemas');

var _getTabIndex = require('../util/getTabIndex');

var _getTabIndex2 = _interopRequireDefault(_getTabIndex);

var _isInteractiveElement = require('../util/isInteractiveElement');

var _isInteractiveElement2 = _interopRequireDefault(_isInteractiveElement);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * @fileoverview Enforce elements with aria-activedescendant are tabbable.
                                                                                                                                                                                                     * @author Jesse Beach <@jessebeach>
                                                                                                                                                                                                     */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = 'An element that manages focus with `aria-activedescendant` must be tabbable';

var schema = (0, _schemas.generateObjSchema)();

var domElements = [].concat(_toConsumableArray(_ariaQuery.dom.keys()));

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXOpeningElement: function JSXOpeningElement(node) {
        var attributes = node.attributes;


        if ((0, _jsxAstUtils.getProp)(attributes, 'aria-activedescendant') === undefined) {
          return;
        }

        var type = (0, _jsxAstUtils.elementType)(node);
        // Do not test higher level JSX components, as we do not know what
        // low-level DOM element this maps to.
        if (domElements.indexOf(type) === -1) {
          return;
        }
        var tabIndex = (0, _getTabIndex2.default)((0, _jsxAstUtils.getProp)(attributes, 'tabIndex'));

        // If this is an interactive element, tabIndex must be either left
        // unspecified allowing the inherent tabIndex to obtain or it must be
        // zero (allowing for positive, even though that is not ideal). It cannot
        // be given a negative value.
        if ((0, _isInteractiveElement2.default)(type, attributes) && (tabIndex === undefined || tabIndex >= 0)) {
          return;
        }

        if (tabIndex >= 0) {
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