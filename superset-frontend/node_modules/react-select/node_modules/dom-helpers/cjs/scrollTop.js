"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.default = void 0;

var _getScrollAccessor = _interopRequireDefault(require("./getScrollAccessor"));

var _default = (0, _getScrollAccessor.default)('pageYOffset');

exports.default = _default;
module.exports = exports["default"];