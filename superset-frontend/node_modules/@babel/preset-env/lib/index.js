"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isPluginRequired = isPluginRequired;
exports.default = exports.getPolyfillPlugins = exports.getModulesPluginNames = exports.transformIncludesAndExcludes = void 0;

var _semver = require("semver");

var _debug = require("./debug");

var _getOptionSpecificExcludes = _interopRequireDefault(require("./get-option-specific-excludes"));

var _filterItems = require("./filter-items");

var _moduleTransformations = _interopRequireDefault(require("./module-transformations"));

var _normalizeOptions = _interopRequireDefault(require("./normalize-options"));

var _pluginsCompatData = _interopRequireDefault(require("./plugins-compat-data"));

var _shippedProposals = require("../data/shipped-proposals");

var _overlappingPlugins = _interopRequireDefault(require("@babel/compat-data/overlapping-plugins"));

var _usagePlugin = _interopRequireDefault(require("./polyfills/corejs2/usage-plugin"));

var _usagePlugin2 = _interopRequireDefault(require("./polyfills/corejs3/usage-plugin"));

var _usagePlugin3 = _interopRequireDefault(require("./polyfills/regenerator/usage-plugin"));

var _entryPlugin = _interopRequireDefault(require("./polyfills/corejs2/entry-plugin"));

var _entryPlugin2 = _interopRequireDefault(require("./polyfills/corejs3/entry-plugin"));

var _entryPlugin3 = _interopRequireDefault(require("./polyfills/regenerator/entry-plugin"));

var _helperCompilationTargets = _interopRequireWildcard(require("@babel/helper-compilation-targets"));

var _availablePlugins = _interopRequireDefault(require("./available-plugins"));

var _utils = require("./utils");

var _helperPluginUtils = require("@babel/helper-plugin-utils");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function isPluginRequired(targets, support) {
  return (0, _helperCompilationTargets.isRequired)("fake-name", targets, {
    compatData: {
      "fake-name": support
    }
  });
}

const pluginListWithoutProposals = (0, _utils.filterStageFromList)(_pluginsCompatData.default, _shippedProposals.proposalPlugins);

const getPlugin = pluginName => {
  const plugin = _availablePlugins.default[pluginName];

  if (!plugin) {
    throw new Error(`Could not find plugin "${pluginName}". Ensure there is an entry in ./available-plugins.js for it.`);
  }

  return plugin;
};

const transformIncludesAndExcludes = opts => {
  return opts.reduce((result, opt) => {
    const target = opt.match(/^(es|es6|es7|esnext|web)\./) ? "builtIns" : "plugins";
    result[target].add(opt);
    return result;
  }, {
    all: opts,
    plugins: new Set(),
    builtIns: new Set()
  });
};

exports.transformIncludesAndExcludes = transformIncludesAndExcludes;

const getModulesPluginNames = ({
  modules,
  transformations,
  shouldTransformESM,
  shouldTransformDynamicImport,
  shouldParseTopLevelAwait
}) => {
  const modulesPluginNames = [];

  if (modules !== false && transformations[modules]) {
    if (shouldTransformESM) {
      modulesPluginNames.push(transformations[modules]);
    }

    if (shouldTransformDynamicImport && shouldTransformESM && modules !== "umd") {
      modulesPluginNames.push("proposal-dynamic-import");
    } else {
      if (shouldTransformDynamicImport) {
        console.warn("Dynamic import can only be supported when transforming ES modules" + " to AMD, CommonJS or SystemJS. Only the parser plugin will be enabled.");
      }

      modulesPluginNames.push("syntax-dynamic-import");
    }
  } else {
    modulesPluginNames.push("syntax-dynamic-import");
  }

  if (shouldParseTopLevelAwait) {
    modulesPluginNames.push("syntax-top-level-await");
  }

  return modulesPluginNames;
};

exports.getModulesPluginNames = getModulesPluginNames;

const getPolyfillPlugins = ({
  useBuiltIns,
  corejs,
  polyfillTargets,
  include,
  exclude,
  proposals,
  shippedProposals,
  regenerator,
  debug
}) => {
  const polyfillPlugins = [];

  if (useBuiltIns === "usage" || useBuiltIns === "entry") {
    const pluginOptions = {
      corejs,
      polyfillTargets,
      include,
      exclude,
      proposals,
      shippedProposals,
      regenerator,
      debug
    };

    if (corejs) {
      if (useBuiltIns === "usage") {
        if (corejs.major === 2) {
          polyfillPlugins.push([_usagePlugin.default, pluginOptions]);
        } else {
          polyfillPlugins.push([_usagePlugin2.default, pluginOptions]);
        }

        if (regenerator) {
          polyfillPlugins.push([_usagePlugin3.default, pluginOptions]);
        }
      } else {
        if (corejs.major === 2) {
          polyfillPlugins.push([_entryPlugin.default, pluginOptions]);
        } else {
          polyfillPlugins.push([_entryPlugin2.default, pluginOptions]);

          if (!regenerator) {
            polyfillPlugins.push([_entryPlugin3.default, pluginOptions]);
          }
        }
      }
    }
  }

  return polyfillPlugins;
};

exports.getPolyfillPlugins = getPolyfillPlugins;

function supportsStaticESM(caller) {
  return !!(caller && caller.supportsStaticESM);
}

function supportsDynamicImport(caller) {
  return !!(caller && caller.supportsDynamicImport);
}

function supportsTopLevelAwait(caller) {
  return !!(caller && caller.supportsTopLevelAwait);
}

var _default = (0, _helperPluginUtils.declare)((api, opts) => {
  api.assertVersion(7);
  const {
    configPath,
    debug,
    exclude: optionsExclude,
    forceAllTransforms,
    ignoreBrowserslistConfig,
    include: optionsInclude,
    loose,
    modules,
    shippedProposals,
    spec,
    targets: optionsTargets,
    useBuiltIns,
    corejs: {
      version: corejs,
      proposals
    }
  } = (0, _normalizeOptions.default)(opts);
  let hasUglifyTarget = false;

  if (optionsTargets && optionsTargets.uglify) {
    hasUglifyTarget = true;
    delete optionsTargets.uglify;
    console.log("");
    console.log("The uglify target has been deprecated. Set the top level");
    console.log("option `forceAllTransforms: true` instead.");
    console.log("");
  }

  if (optionsTargets && optionsTargets.esmodules && optionsTargets.browsers) {
    console.log("");
    console.log("@babel/preset-env: esmodules and browsers targets have been specified together.");
    console.log(`\`browsers\` target, \`${optionsTargets.browsers}\` will be ignored.`);
    console.log("");
  }

  const targets = (0, _helperCompilationTargets.default)(optionsTargets, {
    ignoreBrowserslistConfig,
    configPath
  });
  const include = transformIncludesAndExcludes(optionsInclude);
  const exclude = transformIncludesAndExcludes(optionsExclude);
  const transformTargets = forceAllTransforms || hasUglifyTarget ? {} : targets;
  const modulesPluginNames = getModulesPluginNames({
    modules,
    transformations: _moduleTransformations.default,
    shouldTransformESM: modules !== "auto" || !api.caller || !api.caller(supportsStaticESM),
    shouldTransformDynamicImport: modules !== "auto" || !api.caller || !api.caller(supportsDynamicImport),
    shouldParseTopLevelAwait: !api.caller || api.caller(supportsTopLevelAwait)
  });
  const pluginNames = (0, _helperCompilationTargets.filterItems)(shippedProposals ? _pluginsCompatData.default : pluginListWithoutProposals, include.plugins, exclude.plugins, transformTargets, modulesPluginNames, (0, _getOptionSpecificExcludes.default)({
    loose
  }), _shippedProposals.pluginSyntaxMap);
  (0, _filterItems.removeUnnecessaryItems)(pluginNames, _overlappingPlugins.default);
  const polyfillPlugins = getPolyfillPlugins({
    useBuiltIns,
    corejs,
    polyfillTargets: targets,
    include: include.builtIns,
    exclude: exclude.builtIns,
    proposals,
    shippedProposals,
    regenerator: pluginNames.has("transform-regenerator"),
    debug
  });
  const pluginUseBuiltIns = useBuiltIns !== false;
  const plugins = Array.from(pluginNames).map(pluginName => [getPlugin(pluginName), {
    spec,
    loose,
    useBuiltIns: pluginUseBuiltIns
  }]).concat(polyfillPlugins);

  if (debug) {
    console.log("@babel/preset-env: `DEBUG` option");
    console.log("\nUsing targets:");
    console.log(JSON.stringify((0, _helperCompilationTargets.prettifyTargets)(targets), null, 2));
    console.log(`\nUsing modules transform: ${modules.toString()}`);
    console.log("\nUsing plugins:");
    pluginNames.forEach(pluginName => {
      (0, _debug.logPluginOrPolyfill)(pluginName, targets, _pluginsCompatData.default);
    });

    if (!useBuiltIns) {
      console.log("\nUsing polyfills: No polyfills were added, since the `useBuiltIns` option was not set.");
    } else {
      console.log(`\nUsing polyfills with \`${useBuiltIns}\` option:`);
    }
  }

  return {
    plugins
  };
});

exports.default = _default;