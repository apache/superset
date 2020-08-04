"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _transformClassic = _interopRequireDefault(require("./transform-classic"));

var _transformAutomatic = _interopRequireDefault(require("./transform-automatic"));

var _helperPluginUtils = require("@babel/helper-plugin-utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _helperPluginUtils.declare)((api, options) => {
  const {
    runtime = "classic"
  } = options;

  if (runtime === "classic") {
    return (0, _transformClassic.default)(api, options);
  } else {
    return (0, _transformAutomatic.default)(api, options);
  }
});

exports.default = _default;