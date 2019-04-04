'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _jsxAstUtils = require('jsx-ast-utils');

var presentationRoles = new Set(['presentation', 'none']);

var isPresentationRole = function isPresentationRole(tagName, attributes) {
  return presentationRoles.has((0, _jsxAstUtils.getLiteralPropValue)((0, _jsxAstUtils.getProp)(attributes, 'role')));
};

exports.default = isPresentationRole;