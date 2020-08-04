"use strict";

exports.__esModule = true;
exports.getFilePath = getFilePath;
exports.getBaseSvgoConfig = getBaseSvgoConfig;
exports.getPlugins = getPlugins;
exports.mergeSvgoConfig = mergeSvgoConfig;

var _mergeDeep = _interopRequireDefault(require("merge-deep"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function getFilePath(state) {
  return state.filePath || process.cwd();
}

function getBaseSvgoConfig(config) {
  const baseSvgoConfig = {
    plugins: [{
      prefixIds: true
    }]
  };

  if (config.icon || config.dimensions === false) {
    baseSvgoConfig.plugins.push({
      removeViewBox: false
    });
  }

  return baseSvgoConfig;
}

function getPlugins(config) {
  if (!config || !config.plugins) {
    return [];
  }

  if (!Array.isArray(config.plugins)) {
    throw Error('`svgoConfig.plugins` must be an array');
  }

  return config.plugins;
}

function extractPlugins(config) {
  if (!config) return [];
  if (!config.plugins) return [];
  if (!Array.isArray(config.plugins)) return [config.plugins];
  return config.plugins;
}

function mergePlugins(configs) {
  const plugins = configs.reduce((merged, config) => (0, _mergeDeep.default)(merged, ...extractPlugins(config)), {});
  return Object.keys(plugins).reduce((array, key) => {
    array.push({
      [key]: plugins[key]
    });
    return array;
  }, []);
}

function mergeSvgoConfig(...configs) {
  const plugins = mergePlugins(configs);
  return _extends({}, (0, _mergeDeep.default)(...configs), {
    plugins
  });
}