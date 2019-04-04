"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.transformIncludesAndExcludes = exports.isPluginRequired = void 0;

function _semver() {
  const data = _interopRequireDefault(require("semver"));

  _semver = function () {
    return data;
  };

  return data;
}

var _builtIns = _interopRequireDefault(require("../data/built-ins.json"));

var _debug = require("./debug");

var _defaults = require("./defaults");

var _moduleTransformations = _interopRequireDefault(require("./module-transformations"));

var _normalizeOptions = _interopRequireDefault(require("./normalize-options.js"));

var _plugins = _interopRequireDefault(require("../data/plugins.json"));

var _shippedProposals = require("../data/shipped-proposals.js");

var _useBuiltInsEntryPlugin = _interopRequireDefault(require("./use-built-ins-entry-plugin"));

var _useBuiltInsPlugin = _interopRequireDefault(require("./use-built-ins-plugin"));

var _targetsParser = _interopRequireDefault(require("./targets-parser"));

var _availablePlugins = _interopRequireDefault(require("./available-plugins"));

var _utils = require("./utils");

function _helperPluginUtils() {
  const data = require("@babel/helper-plugin-utils");

  _helperPluginUtils = function () {
    return data;
  };

  return data;
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const getPlugin = pluginName => {
  const plugin = _availablePlugins.default[pluginName];

  if (!plugin) {
    throw new Error(`Could not find plugin "${pluginName}". Ensure there is an entry in ./available-plugins.js for it.`);
  }

  return plugin;
};

const builtInsListWithoutProposals = (0, _utils.filterStageFromList)(_builtIns.default, _shippedProposals.builtIns);
const pluginListWithoutProposals = (0, _utils.filterStageFromList)(_plugins.default, _shippedProposals.features);

const isPluginRequired = (supportedEnvironments, plugin) => {
  const targetEnvironments = Object.keys(supportedEnvironments);

  if (targetEnvironments.length === 0) {
    return true;
  }

  const isRequiredForEnvironments = targetEnvironments.filter(environment => {
    if (!plugin[environment]) {
      return true;
    }

    const lowestImplementedVersion = plugin[environment];
    const lowestTargetedVersion = supportedEnvironments[environment];

    if ((0, _utils.isUnreleasedVersion)(lowestTargetedVersion, environment)) {
      return false;
    } else if ((0, _utils.isUnreleasedVersion)(lowestImplementedVersion, environment)) {
      return true;
    }

    if (!_semver().default.valid(lowestTargetedVersion)) {
      throw new Error(`Invalid version passed for target "${environment}": "${lowestTargetedVersion}". ` + "Versions must be in semver format (major.minor.patch)");
    }

    return _semver().default.gt((0, _utils.semverify)(lowestImplementedVersion), lowestTargetedVersion);
  });
  return isRequiredForEnvironments.length > 0;
};

exports.isPluginRequired = isPluginRequired;

const getBuiltInTargets = targets => {
  const builtInTargets = Object.assign({}, targets);

  if (builtInTargets.uglify != null) {
    delete builtInTargets.uglify;
  }

  return builtInTargets;
};

const transformIncludesAndExcludes = opts => {
  return opts.reduce((result, opt) => {
    const target = opt.match(/^(es\d+|web)\./) ? "builtIns" : "plugins";
    result[target].add(opt);
    return result;
  }, {
    all: opts,
    plugins: new Set(),
    builtIns: new Set()
  });
};

exports.transformIncludesAndExcludes = transformIncludesAndExcludes;

const filterItems = (list, includes, excludes, targets, defaultIncludes, defaultExcludes) => {
  const result = new Set();

  for (const item in list) {
    if (!excludes.has(item) && (isPluginRequired(targets, list[item]) || includes.has(item))) {
      result.add(item);
    } else {
      const shippedProposalsSyntax = _shippedProposals.pluginSyntaxMap.get(item);

      if (shippedProposalsSyntax) {
        result.add(shippedProposalsSyntax);
      }
    }
  }

  if (defaultIncludes) {
    defaultIncludes.forEach(item => !excludes.has(item) && result.add(item));
  }

  if (defaultExcludes) {
    defaultExcludes.forEach(item => !includes.has(item) && result.delete(item));
  }

  return result;
};

function supportsStaticESM(caller) {
  return !!(caller && caller.supportsStaticESM);
}

var _default = (0, _helperPluginUtils().declare)((api, opts) => {
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
    useBuiltIns
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

  const targets = (0, _targetsParser.default)(optionsTargets, {
    ignoreBrowserslistConfig,
    configPath
  });
  const include = transformIncludesAndExcludes(optionsInclude);
  const exclude = transformIncludesAndExcludes(optionsExclude);
  const transformTargets = forceAllTransforms || hasUglifyTarget ? {} : targets;
  const transformations = filterItems(shippedProposals ? _plugins.default : pluginListWithoutProposals, include.plugins, exclude.plugins, transformTargets, null, (0, _defaults.getOptionSpecificExcludesFor)({
    loose
  }));
  let polyfills;
  let polyfillTargets;

  if (useBuiltIns) {
    polyfillTargets = getBuiltInTargets(targets);
    polyfills = filterItems(shippedProposals ? _builtIns.default : builtInsListWithoutProposals, include.builtIns, exclude.builtIns, polyfillTargets, (0, _defaults.getPlatformSpecificDefaultFor)(polyfillTargets));
  }

  const plugins = [];
  const pluginUseBuiltIns = useBuiltIns !== false;

  if (modules !== false && _moduleTransformations.default[modules] && (modules !== "auto" || !api.caller || !api.caller(supportsStaticESM))) {
    plugins.push([getPlugin(_moduleTransformations.default[modules]), {
      loose
    }]);
  }

  transformations.forEach(pluginName => plugins.push([getPlugin(pluginName), {
    spec,
    loose,
    useBuiltIns: pluginUseBuiltIns
  }]));
  const regenerator = transformations.has("transform-regenerator");

  if (debug) {
    console.log("@babel/preset-env: `DEBUG` option");
    console.log("\nUsing targets:");
    console.log(JSON.stringify((0, _utils.prettifyTargets)(targets), null, 2));
    console.log(`\nUsing modules transform: ${modules.toString()}`);
    console.log("\nUsing plugins:");
    transformations.forEach(transform => {
      (0, _debug.logPlugin)(transform, targets, _plugins.default);
    });

    if (!useBuiltIns) {
      console.log("\nUsing polyfills: No polyfills were added, since the `useBuiltIns` option was not set.");
    } else {
      console.log(`
Using polyfills with \`${useBuiltIns}\` option:`);
    }
  }

  if (useBuiltIns === "usage" || useBuiltIns === "entry") {
    const pluginOptions = {
      debug,
      polyfills,
      regenerator,
      onDebug: (polyfills, context) => {
        polyfills.forEach(polyfill => (0, _debug.logPlugin)(polyfill, polyfillTargets, _builtIns.default, context));
      }
    };
    plugins.push([useBuiltIns === "usage" ? _useBuiltInsPlugin.default : _useBuiltInsEntryPlugin.default, pluginOptions]);
  }

  return {
    plugins
  };
});

exports.default = _default;