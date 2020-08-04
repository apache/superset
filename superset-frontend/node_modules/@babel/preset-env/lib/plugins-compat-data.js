"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _plugins = _interopRequireDefault(require("@babel/compat-data/plugins"));

var _availablePlugins = _interopRequireDefault(require("./available-plugins"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const filtered = {};
exports.default = filtered;

for (const plugin of Object.keys(_plugins.default)) {
  if (Object.hasOwnProperty.call(_availablePlugins.default, plugin)) {
    filtered[plugin] = _plugins.default[plugin];
  }
}