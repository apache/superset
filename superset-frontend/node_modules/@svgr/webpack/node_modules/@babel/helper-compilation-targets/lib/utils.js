"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.semverMin = semverMin;
exports.semverify = semverify;
exports.isUnreleasedVersion = isUnreleasedVersion;
exports.getLowestUnreleased = getLowestUnreleased;
exports.getLowestImplementedVersion = getLowestImplementedVersion;

var _invariant = _interopRequireDefault(require("invariant"));

var _semver = _interopRequireDefault(require("semver"));

var _targets = require("./targets");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const versionRegExp = /^(\d+|\d+.\d+)$/;

function semverMin(first, second) {
  return first && _semver.default.lt(first, second) ? first : second;
}

function semverify(version) {
  if (typeof version === "string" && _semver.default.valid(version)) {
    return version;
  }

  (0, _invariant.default)(typeof version === "number" || typeof version === "string" && versionRegExp.test(version), `'${version}' is not a valid version`);
  const split = version.toString().split(".");

  while (split.length < 3) {
    split.push("0");
  }

  return split.join(".");
}

function isUnreleasedVersion(version, env) {
  const unreleasedLabel = _targets.unreleasedLabels[env];
  return !!unreleasedLabel && unreleasedLabel === version.toString().toLowerCase();
}

function getLowestUnreleased(a, b, env) {
  const unreleasedLabel = _targets.unreleasedLabels[env];
  const hasUnreleased = [a, b].some(item => item === unreleasedLabel);

  if (hasUnreleased) {
    return a === hasUnreleased ? b : a || b;
  }

  return semverMin(a, b);
}

function getLowestImplementedVersion(plugin, environment) {
  const result = plugin[environment];

  if (!result && environment === "android") {
    return plugin.chrome;
  }

  return result;
}