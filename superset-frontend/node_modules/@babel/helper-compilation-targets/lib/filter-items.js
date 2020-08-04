"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.targetsSupported = targetsSupported;
exports.isRequired = isRequired;
exports.default = filterItems;

var _semver = _interopRequireDefault(require("semver"));

var _plugins = _interopRequireDefault(require("@babel/compat-data/plugins"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function targetsSupported(target, support) {
  const targetEnvironments = Object.keys(target);

  if (targetEnvironments.length === 0) {
    return false;
  }

  const unsupportedEnvironments = targetEnvironments.filter(environment => {
    const lowestImplementedVersion = (0, _utils.getLowestImplementedVersion)(support, environment);

    if (!lowestImplementedVersion) {
      return true;
    }

    const lowestTargetedVersion = target[environment];

    if ((0, _utils.isUnreleasedVersion)(lowestTargetedVersion, environment)) {
      return false;
    }

    if ((0, _utils.isUnreleasedVersion)(lowestImplementedVersion, environment)) {
      return true;
    }

    if (!_semver.default.valid(lowestTargetedVersion.toString())) {
      throw new Error(`Invalid version passed for target "${environment}": "${lowestTargetedVersion}". ` + "Versions must be in semver format (major.minor.patch)");
    }

    return _semver.default.gt((0, _utils.semverify)(lowestImplementedVersion), lowestTargetedVersion.toString());
  });
  return unsupportedEnvironments.length === 0;
}

function isRequired(name, targets, {
  compatData = _plugins.default,
  includes,
  excludes
} = {}) {
  if (excludes && excludes.has(name)) return false;
  if (includes && includes.has(name)) return true;
  return !targetsSupported(targets, compatData[name]);
}

function filterItems(list, includes, excludes, targets, defaultIncludes, defaultExcludes, pluginSyntaxMap) {
  const result = new Set();
  const options = {
    compatData: list,
    includes,
    excludes
  };

  for (const item in list) {
    if (isRequired(item, targets, options)) {
      result.add(item);
    } else if (pluginSyntaxMap) {
      const shippedProposalsSyntax = pluginSyntaxMap.get(item);

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
}