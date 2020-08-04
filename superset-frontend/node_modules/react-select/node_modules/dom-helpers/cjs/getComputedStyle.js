"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = getComputedStyle;

var _ownerWindow = _interopRequireDefault(require("./ownerWindow"));

function getComputedStyle(node, psuedoElement) {
  return (0, _ownerWindow.default)(node).getComputedStyle(node, psuedoElement);
}

module.exports = exports["default"];