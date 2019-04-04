'use strict';

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _arrayIncludes = require('array-includes');

var _arrayIncludes2 = _interopRequireDefault(_arrayIncludes);

var _schemas = require('../util/schemas');

var _isHiddenFromScreenReader = require('../util/isHiddenFromScreenReader');

var _isHiddenFromScreenReader2 = _interopRequireDefault(_isHiddenFromScreenReader);

var _isInteractiveElement = require('../util/isInteractiveElement');

var _isInteractiveElement2 = _interopRequireDefault(_isInteractiveElement);

var _isInteractiveRole = require('../util/isInteractiveRole');

var _isInteractiveRole2 = _interopRequireDefault(_isInteractiveRole);

var _isNonInteractiveElement = require('../util/isNonInteractiveElement');

var _isNonInteractiveElement2 = _interopRequireDefault(_isNonInteractiveElement);

var _isNonInteractiveRole = require('../util/isNonInteractiveRole');

var _isNonInteractiveRole2 = _interopRequireDefault(_isNonInteractiveRole);

var _isPresentationRole = require('../util/isPresentationRole');

var _isPresentationRole2 = _interopRequireDefault(_isPresentationRole);

var _getTabIndex = require('../util/getTabIndex');

var _getTabIndex2 = _interopRequireDefault(_getTabIndex);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * @fileoverview Enforce that elements with onClick handlers must be tabbable.
                                                                                                                                                                                                     * @author Ethan Cohen
                                                                                                                                                                                                     * 
                                                                                                                                                                                                     */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var schema = (0, _schemas.generateObjSchema)({
  tabbable: (0, _schemas.enumArraySchema)([].concat(_toConsumableArray(_ariaQuery.roles.keys())).filter(function (name) {
    return !_ariaQuery.roles.get(name).abstract;
  }).filter(function (name) {
    return _ariaQuery.roles.get(name).superClass.some(function (klasses) {
      return (0, _arrayIncludes2.default)(klasses, 'widget');
    });
  }))
});
var domElements = [].concat(_toConsumableArray(_ariaQuery.dom.keys()));

var interactiveProps = [].concat(_toConsumableArray(_jsxAstUtils.eventHandlersByType.mouse), _toConsumableArray(_jsxAstUtils.eventHandlersByType.keyboard));

module.exports = {
  meta: {
    docs: {},
    schema: [schema]
  },

  create: function create(context) {
    return {
      JSXOpeningElement: function JSXOpeningElement(node) {
        var tabbable = context.options && context.options[0] && context.options[0].tabbable || [];
        var attributes = node.attributes;
        var type = (0, _jsxAstUtils.elementType)(node);
        var hasInteractiveProps = (0, _jsxAstUtils.hasAnyProp)(attributes, interactiveProps);
        var hasTabindex = (0, _getTabIndex2.default)((0, _jsxAstUtils.getProp)(attributes, 'tabIndex')) !== undefined;

        if (!(0, _arrayIncludes2.default)(domElements, type)) {
          // Do not test higher level JSX components, as we do not know what
          // low-level DOM element this maps to.
          return;
        } else if (!hasInteractiveProps || (0, _isHiddenFromScreenReader2.default)(type, attributes) || (0, _isPresentationRole2.default)(type, attributes)) {
          // Presentation is an intentional signal from the author that this
          // element is not meant to be perceivable. For example, a click screen
          // to close a dialog .
          return;
        }

        if (hasInteractiveProps && (0, _isInteractiveRole2.default)(type, attributes) && !(0, _isInteractiveElement2.default)(type, attributes) && !(0, _isNonInteractiveElement2.default)(type, attributes) && !(0, _isNonInteractiveRole2.default)(type, attributes) && !hasTabindex) {
          var role = (0, _jsxAstUtils.getLiteralPropValue)((0, _jsxAstUtils.getProp)(attributes, 'role'));
          if ((0, _arrayIncludes2.default)(tabbable, role)) {
            // Always tabbable, tabIndex = 0
            context.report({
              node: node,
              message: 'Elements with the \'' + role + '\' interactive role must be tabbable.'
            });
          } else {
            // Focusable, tabIndex = -1 or 0
            context.report({
              node: node,
              message: 'Elements with the \'' + role + '\' interactive role must be focusable.'
            });
          }
        }
      }
    };
  }
};