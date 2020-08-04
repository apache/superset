"use strict";

exports.__esModule = true;
exports.resolveConfig = resolveConfig;
exports.resolveConfigFile = resolveConfigFile;
exports.loadConfig = loadConfig;
exports.DEFAULT_CONFIG = void 0;

var _cosmiconfig = require("cosmiconfig");

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

const DEFAULT_CONFIG = {
  dimensions: true,
  expandProps: 'end',
  icon: false,
  native: false,
  typescript: false,
  prettier: true,
  prettierConfig: null,
  memo: false,
  ref: false,
  replaceAttrValues: null,
  svgProps: null,
  svgo: true,
  svgoConfig: null,
  template: null,
  titleProp: false,
  runtimeConfig: true,
  plugins: null
};
exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
const explorer = (0, _cosmiconfig.cosmiconfig)('svgr', {
  sync: true,
  cache: true,
  rcExtensions: true
});
const explorerSync = (0, _cosmiconfig.cosmiconfigSync)('svgr', {
  sync: true,
  cache: true,
  rcExtensions: true
});

async function resolveConfig(searchFrom, configFile) {
  if (configFile == null) {
    const result = await explorer.search(searchFrom);
    return result ? result.config : null;
  }

  const result = await explorer.load(configFile);
  return result ? result.config : null;
}

resolveConfig.sync = (searchFrom, configFile) => {
  if (configFile == null) {
    const result = explorerSync.search(searchFrom);
    return result ? result.config : null;
  }

  const result = explorerSync.load(configFile);
  return result ? result.config : null;
};

async function resolveConfigFile(filePath) {
  const result = await explorer.search(filePath);
  return result ? result.filepath : null;
}

resolveConfigFile.sync = filePath => {
  const result = explorerSync.search(filePath);
  return result ? result.filepath : null;
};

async function loadConfig(_ref, state = {}) {
  let {
    configFile
  } = _ref,
      baseConfig = _objectWithoutPropertiesLoose(_ref, ["configFile"]);

  const rcConfig = state.filePath && baseConfig.runtimeConfig !== false ? await resolveConfig(state.filePath, configFile) : {};
  return _extends({}, DEFAULT_CONFIG, {}, rcConfig, {}, baseConfig);
}

loadConfig.sync = (_ref2, state = {}) => {
  let {
    configFile
  } = _ref2,
      baseConfig = _objectWithoutPropertiesLoose(_ref2, ["configFile"]);

  const rcConfig = state.filePath && baseConfig.runtimeConfig !== false ? resolveConfig.sync(state.filePath, configFile) : {};
  return _extends({}, DEFAULT_CONFIG, {}, rcConfig, {}, baseConfig);
};