'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _ariaQuery = require('aria-query');

var _jsxAstUtils = require('jsx-ast-utils');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var abstractRoles = new Set([].concat(_toConsumableArray(_ariaQuery.roles.keys())).filter(function (role) {
  return _ariaQuery.roles.get(role).abstract;
}));

var DOMElements = [].concat(_toConsumableArray(_ariaQuery.dom.keys()));

var isAbstractRole = function isAbstractRole(tagName, attributes) {
  // Do not test higher level JSX components, as we do not know what
  // low-level DOM element this maps to.
  if (DOMElements.indexOf(tagName) === -1) {
    return false;
  }

  var role = (0, _jsxAstUtils.getLiteralPropValue)((0, _jsxAstUtils.getProp)(attributes, 'role'));

  return abstractRoles.has(role);
};

exports.default = isAbstractRole;