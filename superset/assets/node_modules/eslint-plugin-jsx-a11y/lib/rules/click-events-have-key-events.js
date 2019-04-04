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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * @fileoverview Enforce a clickable non-interactive element has at least 1 keyboard event listener.
                                                                                                                                                                                                     * @author Ethan Cohen
                                                                                                                                                                                                     */

// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = 'Visible, non-interactive elements with click handlers' + ' must have at least one keyboard listener.';

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
        var props = node.attributes;
        if ((0, _jsxAstUtils.getProp)(props, 'onclick') === undefined) {
          return;
        }

        var type = (0, _jsxAstUtils.elementType)(node);
        var requiredProps = ['onkeydown', 'onkeyup', 'onkeypress'];

        if (!(0, _arrayIncludes2.default)(domElements, type)) {
          // Do not test higher level JSX components, as we do not know what
          // low-level DOM element this maps to.
          return;
        } else if ((0, _isHiddenFromScreenReader2.default)(type, props)) {
          return;
        } else if ((0, _isInteractiveElement2.default)(type, props)) {
          return;
        } else if ((0, _jsxAstUtils.hasAnyProp)(props, requiredProps)) {
          return;
        }

        // Visible, non-interactive elements with click handlers require one keyboard event listener.
        context.report({
          node: node,
          message: errorMessage
        });
      }
    };
  }
};