"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = height;

var _isWindow = _interopRequireDefault(require("./isWindow"));

var _offset = _interopRequireDefault(require("./offset"));

function height(node, client) {
  var win = (0, _isWindow.default)(node);
  return win ? win.innerHeight : client ? node.clientHeight : (0, _offset.default)(node).height;
}

module.exports = exports["default"];