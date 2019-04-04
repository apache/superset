'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

var _arrayIncludes = require('array-includes');

var _arrayIncludes2 = _interopRequireDefault(_arrayIncludes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var roles = [].concat(_toConsumableArray(_ariaQuery.roles.keys()));
var nonInteractiveRoles = roles.filter(function (name) {
  return !_ariaQuery.roles.get(name).abstract;
}).filter(function (name) {
  return !_ariaQuery.roles.get(name).superClass.some(function (klasses) {
    return (0, _arrayIncludes2.default)(klasses, 'widget');
  });
});

/**
 * Returns boolean indicating whether the given element has a role
 * that is associated with a non-interactive component. Non-interactive roles
 * include `listitem`, `article`, or `dialog`. These are roles that indicate
 * for the most part containers.
 *
 * Elements with these roles should not respond or handle user interactions.
 * For example, an `onClick` handler should not be assigned to an element with
 * the role `listitem`. An element inside the `listitem`, like a button or a
 * link, should handle the click.
 *
 * This utility returns true for elements that are assigned a non-interactive
 * role. It will return false for elements that do not have a role. So whereas
 * a `div` might be considered non-interactive, for the purpose of this utility,
 * it is considered neither interactive nor non-interactive -- a determination
 * cannot be made in this case and false is returned.
 */

var isNonInteractiveRole = function isNonInteractiveRole(tagName, attributes) {
  // Do not test higher level JSX components, as we do not know what
  // low-level DOM element this maps to.
  if (!_ariaQuery.dom.has(tagName)) {
    return false;
  }

  var role = (0, _jsxAstUtils.getLiteralPropValue)((0, _jsxAstUtils.getProp)(attributes, 'role'));

  var isNonInteractive = false;
  var normalizedValues = String(role).toLowerCase().split(' ');
  var validRoles = normalizedValues.reduce(function (accumulator, name) {
    if ((0, _arrayIncludes2.default)(roles, name)) {
      accumulator.push(name);
    }
    return accumulator;
  }, []);
  if (validRoles.length > 0) {
    // The first role value is a series takes precedence.
    isNonInteractive = (0, _arrayIncludes2.default)(nonInteractiveRoles, validRoles[0]);
  }

  return isNonInteractive;
};

exports.default = isNonInteractiveRole;