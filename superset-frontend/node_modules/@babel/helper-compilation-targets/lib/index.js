"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isBrowsersQueryValid = isBrowsersQueryValid;
exports.default = getTargets;
Object.defineProperty(exports, "unreleasedLabels", {
  enumerable: true,
  get: function () {
    return _targets.unreleasedLabels;
  }
});
Object.defineProperty(exports, "prettifyTargets", {
  enumerable: true,
  get: function () {
    return _pretty.prettifyTargets;
  }
});
Object.defineProperty(exports, "getInclusionReasons", {
  enumerable: true,
  get: function () {
    return _debug.getInclusionReasons;
  }
});
Object.defineProperty(exports, "filterItems", {
  enumerable: true,
  get: function () {
    return _filterItems.default;
  }
});
Object.defineProperty(exports, "isRequired", {
  enumerable: true,
  get: function () {
    return _filterItems.isRequired;
  }
});

var _browserslist = _interopRequireDefault(require("browserslist"));

var _levenary = _interopRequireDefault(require("levenary"));

var _invariant = _interopRequireDefault(require("invariant"));

var _nativeModules = _interopRequireDefault(require("@babel/compat-data/native-modules"));

var _utils = require("./utils");

var _targets = require("./targets");

var _options = require("./options");

var _pretty = require("./pretty");

var _debug = require("./debug");

var _filterItems = _interopRequireWildcard(require("./filter-items"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const browserslistDefaults = _browserslist.default.defaults;
const validBrowserslistTargets = [...Object.keys(_browserslist.default.data), ...Object.keys(_browserslist.default.aliases)];

function objectToBrowserslist(object) {
  return Object.keys(object).reduce((list, targetName) => {
    if (validBrowserslistTargets.indexOf(targetName) >= 0) {
      const targetVersion = object[targetName];
      return list.concat(`${targetName} ${targetVersion}`);
    }

    return list;
  }, []);
}

function validateTargetNames(targets) {
  const validTargets = Object.keys(_options.TargetNames);

  for (const target in targets) {
    if (!_options.TargetNames[target]) {
      throw new Error(`Invalid Option: '${target}' is not a valid target
        Maybe you meant to use '${(0, _levenary.default)(target, validTargets)}'?`);
    }
  }
}

function isBrowsersQueryValid(browsers) {
  return typeof browsers === "string" || Array.isArray(browsers);
}

function validateBrowsers(browsers) {
  (0, _invariant.default)(typeof browsers === "undefined" || isBrowsersQueryValid(browsers), `Invalid Option: '${browsers}' is not a valid browserslist query`);
  return browsers;
}

function mergeBrowsers(fromQuery, fromTarget) {
  return Object.keys(fromTarget).reduce((queryObj, targKey) => {
    if (targKey !== _options.TargetNames.browsers) {
      queryObj[targKey] = fromTarget[targKey];
    }

    return queryObj;
  }, fromQuery);
}

function getLowestVersions(browsers) {
  return browsers.reduce((all, browser) => {
    const [browserName, browserVersion] = browser.split(" ");
    const normalizedBrowserName = _targets.browserNameMap[browserName];

    if (!normalizedBrowserName) {
      return all;
    }

    try {
      const splitVersion = browserVersion.split("-")[0].toLowerCase();
      const isSplitUnreleased = (0, _utils.isUnreleasedVersion)(splitVersion, browserName);

      if (!all[normalizedBrowserName]) {
        all[normalizedBrowserName] = isSplitUnreleased ? splitVersion : (0, _utils.semverify)(splitVersion);
        return all;
      }

      const version = all[normalizedBrowserName];
      const isUnreleased = (0, _utils.isUnreleasedVersion)(version, browserName);

      if (isUnreleased && isSplitUnreleased) {
        all[normalizedBrowserName] = (0, _utils.getLowestUnreleased)(version, splitVersion, browserName);
      } else if (isUnreleased) {
        all[normalizedBrowserName] = (0, _utils.semverify)(splitVersion);
      } else if (!isUnreleased && !isSplitUnreleased) {
        const parsedBrowserVersion = (0, _utils.semverify)(splitVersion);
        all[normalizedBrowserName] = (0, _utils.semverMin)(version, parsedBrowserVersion);
      }
    } catch (e) {}

    return all;
  }, {});
}

function outputDecimalWarning(decimalTargets) {
  if (!decimalTargets || !decimalTargets.length) {
    return;
  }

  console.log("Warning, the following targets are using a decimal version:");
  console.log("");
  decimalTargets.forEach(({
    target,
    value
  }) => console.log(`  ${target}: ${value}`));
  console.log("");
  console.log("We recommend using a string for minor/patch versions to avoid numbers like 6.10");
  console.log("getting parsed as 6.1, which can lead to unexpected behavior.");
  console.log("");
}

function semverifyTarget(target, value) {
  try {
    return (0, _utils.semverify)(value);
  } catch (error) {
    throw new Error(`Invalid Option: '${value}' is not a valid value for 'targets.${target}'.`);
  }
}

const targetParserMap = {
  __default(target, value) {
    const version = (0, _utils.isUnreleasedVersion)(value, target) ? value.toLowerCase() : semverifyTarget(target, value);
    return [target, version];
  },

  node(target, value) {
    const parsed = value === true || value === "current" ? process.versions.node : semverifyTarget(target, value);
    return [target, parsed];
  }

};

function getTargets(targets = {}, options = {}) {
  const targetOpts = {};
  validateTargetNames(targets);

  if (targets.esmodules) {
    const supportsESModules = _nativeModules.default["es6.module"];
    targets.browsers = Object.keys(supportsESModules).map(browser => `${browser} ${supportsESModules[browser]}`).join(", ");
  }

  delete targets.esmodules;
  const browsersquery = validateBrowsers(targets.browsers);
  const hasTargets = Object.keys(targets).length > 0;
  const shouldParseBrowsers = !!targets.browsers;
  const shouldSearchForConfig = !options.ignoreBrowserslistConfig && !hasTargets;

  if (shouldParseBrowsers || shouldSearchForConfig) {
    if (!hasTargets) {
      _browserslist.default.defaults = objectToBrowserslist(targets);
    }

    const browsers = (0, _browserslist.default)(browsersquery, {
      path: options.configPath,
      mobileToDesktop: true
    });
    const queryBrowsers = getLowestVersions(browsers);
    targets = mergeBrowsers(queryBrowsers, targets);
    _browserslist.default.defaults = browserslistDefaults;
  }

  const parsed = Object.keys(targets).filter(value => value !== _options.TargetNames.esmodules).sort().reduce((results, target) => {
    if (target !== _options.TargetNames.browsers) {
      const value = targets[target];

      if (typeof value === "number" && value % 1 !== 0) {
        results.decimalWarnings.push({
          target,
          value
        });
      }

      const parser = targetParserMap[target] || targetParserMap.__default;
      const [parsedTarget, parsedValue] = parser(target, value);

      if (parsedValue) {
        results.targets[parsedTarget] = parsedValue;
      }
    }

    return results;
  }, {
    targets: targetOpts,
    decimalWarnings: []
  });
  outputDecimalWarning(parsed.decimalWarnings);
  return parsed.targets;
}