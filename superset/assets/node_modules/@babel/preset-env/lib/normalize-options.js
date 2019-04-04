"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = normalizeOptions;
exports.validateUseBuiltInsOption = exports.objectToBrowserslist = exports.validateModulesOption = exports.validateIgnoreBrowserslistConfig = exports.validateBoolOption = exports.validateConfigPathOption = exports.checkDuplicateIncludeExcludes = exports.normalizePluginName = void 0;

function _invariant() {
  const data = _interopRequireDefault(require("invariant"));

  _invariant = function () {
    return data;
  };

  return data;
}

function _browserslist() {
  const data = _interopRequireDefault(require("browserslist"));

  _browserslist = function () {
    return data;
  };

  return data;
}

var _builtIns = _interopRequireDefault(require("../data/built-ins.json"));

var _defaultIncludes = require("./default-includes");

var _moduleTransformations = _interopRequireDefault(require("./module-transformations"));

var _targetsParser = require("./targets-parser");

var _utils = require("./utils");

var _plugins = _interopRequireDefault(require("../data/plugins.json"));

var _options = require("./options");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const validateTopLevelOptions = options => {
  for (const option in options) {
    if (!_options.TopLevelOptions[option]) {
      const validOptions = (0, _utils.getValues)(_options.TopLevelOptions);
      throw new Error(`Invalid Option: ${option} is not a valid top-level option.
        Maybe you meant to use '${(0, _utils.findSuggestion)(validOptions, option)}'?`);
    }
  }
};

const validIncludesAndExcludes = new Set([...Object.keys(_plugins.default), ...Object.keys(_moduleTransformations.default).map(m => _moduleTransformations.default[m]), ...Object.keys(_builtIns.default), ..._defaultIncludes.defaultWebIncludes]);

const pluginToRegExp = plugin => {
  if (plugin instanceof RegExp) return plugin;

  try {
    return new RegExp(`^${normalizePluginName(plugin)}$`);
  } catch (e) {
    return null;
  }
};

const selectPlugins = regexp => Array.from(validIncludesAndExcludes).filter(item => regexp instanceof RegExp && regexp.test(item));

const flatten = array => [].concat(...array);

const expandIncludesAndExcludes = (plugins = [], type) => {
  if (plugins.length === 0) return [];
  const selectedPlugins = plugins.map(plugin => selectPlugins(pluginToRegExp(plugin)));
  const invalidRegExpList = plugins.filter((p, i) => selectedPlugins[i].length === 0);
  (0, _invariant().default)(invalidRegExpList.length === 0, `Invalid Option: The plugins/built-ins '${invalidRegExpList.join(", ")}' passed to the '${type}' option are not
    valid. Please check data/[plugin-features|built-in-features].js in babel-preset-env`);
  return flatten(selectedPlugins);
};

const validBrowserslistTargets = [...Object.keys(_browserslist().default.data), ...Object.keys(_browserslist().default.aliases)];

const normalizePluginName = plugin => plugin.replace(/^babel-plugin-/, "");

exports.normalizePluginName = normalizePluginName;

const checkDuplicateIncludeExcludes = (include = [], exclude = []) => {
  const duplicates = include.filter(opt => exclude.indexOf(opt) >= 0);
  (0, _invariant().default)(duplicates.length === 0, `Invalid Option: The plugins/built-ins '${duplicates.join(", ")}' were found in both the "include" and
    "exclude" options.`);
};

exports.checkDuplicateIncludeExcludes = checkDuplicateIncludeExcludes;

const normalizeTargets = targets => {
  if ((0, _targetsParser.isBrowsersQueryValid)(targets)) {
    return {
      browsers: targets
    };
  }

  return Object.assign({}, targets);
};

const validateConfigPathOption = (configPath = process.cwd()) => {
  (0, _invariant().default)(typeof configPath === "string", `Invalid Option: The configPath option '${configPath}' is invalid, only strings are allowed.`);
  return configPath;
};

exports.validateConfigPathOption = validateConfigPathOption;

const validateBoolOption = (name, value, defaultValue) => {
  if (typeof value === "undefined") {
    value = defaultValue;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Preset env: '${name}' option must be a boolean.`);
  }

  return value;
};

exports.validateBoolOption = validateBoolOption;

const validateIgnoreBrowserslistConfig = ignoreBrowserslistConfig => validateBoolOption(_options.TopLevelOptions.ignoreBrowserslistConfig, ignoreBrowserslistConfig, false);

exports.validateIgnoreBrowserslistConfig = validateIgnoreBrowserslistConfig;

const validateModulesOption = (modulesOpt = _options.ModulesOption.auto) => {
  (0, _invariant().default)(_options.ModulesOption[modulesOpt] || _options.ModulesOption[modulesOpt] === _options.ModulesOption.false, `Invalid Option: The 'modules' option must be one of \n` + ` - 'false' to indicate no module processing\n` + ` - a specific module type: 'commonjs', 'amd', 'umd', 'systemjs'` + ` - 'auto' (default) which will automatically select 'false' if the current\n` + `   process is known to support ES module syntax, or "commonjs" otherwise\n`);
  return modulesOpt;
};

exports.validateModulesOption = validateModulesOption;

const objectToBrowserslist = object => {
  return Object.keys(object).reduce((list, targetName) => {
    if (validBrowserslistTargets.indexOf(targetName) >= 0) {
      const targetVersion = object[targetName];
      return list.concat(`${targetName} ${targetVersion}`);
    }

    return list;
  }, []);
};

exports.objectToBrowserslist = objectToBrowserslist;

const validateUseBuiltInsOption = (builtInsOpt = false) => {
  (0, _invariant().default)(_options.UseBuiltInsOption[builtInsOpt] || _options.UseBuiltInsOption[builtInsOpt] === _options.UseBuiltInsOption.false, `Invalid Option: The 'useBuiltIns' option must be either
    'false' (default) to indicate no polyfill,
    '"entry"' to indicate replacing the entry polyfill, or
    '"usage"' to import only used polyfills per file`);
  return builtInsOpt;
};

exports.validateUseBuiltInsOption = validateUseBuiltInsOption;

function normalizeOptions(opts) {
  validateTopLevelOptions(opts);
  const include = expandIncludesAndExcludes(opts.include, _options.TopLevelOptions.include);
  const exclude = expandIncludesAndExcludes(opts.exclude, _options.TopLevelOptions.exclude);
  checkDuplicateIncludeExcludes(include, exclude);
  return {
    configPath: validateConfigPathOption(opts.configPath),
    debug: validateBoolOption(_options.TopLevelOptions.debug, opts.debug, false),
    include,
    exclude,
    forceAllTransforms: validateBoolOption(_options.TopLevelOptions.forceAllTransforms, opts.forceAllTransforms, false),
    ignoreBrowserslistConfig: validateIgnoreBrowserslistConfig(opts.ignoreBrowserslistConfig),
    loose: validateBoolOption(_options.TopLevelOptions.loose, opts.loose, false),
    modules: validateModulesOption(opts.modules),
    shippedProposals: validateBoolOption(_options.TopLevelOptions.shippedProposals, opts.shippedProposals, false),
    spec: validateBoolOption(_options.TopLevelOptions.spec, opts.spec, false),
    targets: normalizeTargets(opts.targets),
    useBuiltIns: validateUseBuiltInsOption(opts.useBuiltIns)
  };
}