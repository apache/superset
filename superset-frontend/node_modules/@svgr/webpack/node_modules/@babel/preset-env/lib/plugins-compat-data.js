"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.pluginsBugfixes = exports.plugins = void 0;

var _plugins = _interopRequireDefault(require("@babel/compat-data/plugins"));

var _pluginBugfixes = _interopRequireDefault(require("@babel/compat-data/plugin-bugfixes"));

var _availablePlugins = _interopRequireDefault(require("./available-plugins"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const pluginsFiltered = {};
exports.plugins = pluginsFiltered;
const bugfixPluginsFiltered = {};
exports.pluginsBugfixes = bugfixPluginsFiltered;

for (const plugin of Object.keys(_plugins.default)) {
  if (Object.hasOwnProperty.call(_availablePlugins.default, plugin)) {
    pluginsFiltered[plugin] = _plugins.default[plugin];
  }
}

for (const plugin of Object.keys(_pluginBugfixes.default)) {
  if (Object.hasOwnProperty.call(_availablePlugins.default, plugin)) {
    bugfixPluginsFiltered[plugin] = _pluginBugfixes.default[plugin];
  }
}

pluginsFiltered["proposal-class-properties"] = pluginsFiltered["proposal-private-methods"];