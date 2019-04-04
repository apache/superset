'use strict';

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _arrayIncludes = require('array-includes');

var _arrayIncludes2 = _interopRequireDefault(_arrayIncludes);

var _schemas = require('../util/schemas');

var _isAbstractRole = require('../util/isAbstractRole');

var _isAbstractRole2 = _interopRequireDefault(_isAbstractRole);

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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                     * @fileoverview Enforce non-interactive elements have no interactive handlers.
                                                                                                                                                                                                     * @author Jese Beach
                                                                                                                                                                                                     * 
                                                                                                                                                                                                     */
// ----------------------------------------------------------------------------
// Rule Definition
// ----------------------------------------------------------------------------

var errorMessage = 'Non-interactive elements should not be assigned mouse or keyboard event listeners.';

var domElements = [].concat(_toConsumableArray(_ariaQuery.dom.keys()));
var defaultInteractiveProps = _jsxAstUtils.eventHandlers;
var schema = (0, _schemas.generateObjSchema)({
  handlers: _schemas.arraySchema
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
        var attributes = node.attributes;
        var type = (0, _jsxAstUtils.elementType)(node);
        var interactiveProps = options[0] ? options[0].handlers : defaultInteractiveProps;

        var hasInteractiveProps = interactiveProps.some(function (prop) {
          return (0, _jsxAstUtils.hasProp)(attributes, prop) && (0, _jsxAstUtils.getPropValue)((0, _jsxAstUtils.getProp)(attributes, prop)) != null;
        });

        if (!(0, _arrayIncludes2.default)(domElements, type)) {
          // Do not test higher level JSX components, as we do not know what
          // low-level DOM element this maps to.
          return;
        } else if (!hasInteractiveProps || (0, _isHiddenFromScreenReader2.default)(type, attributes) || (0, _isPresentationRole2.default)(type, attributes)) {
          // Presentation is an intentional signal from the author that this
          // element is not meant to be perceivable. For example, a click screen
          // to close a dialog .
          return;
        } else if ((0, _isInteractiveElement2.default)(type, attributes) || (0, _isInteractiveRole2.default)(type, attributes) || !(0, _isNonInteractiveElement2.default)(type, attributes) && !(0, _isNonInteractiveRole2.default)(type, attributes) || (0, _isAbstractRole2.default)(type, attributes)) {
          // This rule has no opinion about abtract roles.
          return;
        }

        // Visible, non-interactive elements should not have an interactive handler.
        context.report({
          node: node,
          message: errorMessage
        });
      }
    };
  }
};