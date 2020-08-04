"use strict";

exports.__esModule = true;
var _exportNames = {};
exports.default = void 0;

var _convert = _interopRequireDefault(require("./convert"));

exports.default = _convert.default;

var _config = require("./config");

Object.keys(_config).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  exports[key] = _config[key];
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }