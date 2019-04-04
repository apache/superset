"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isRequire = exports.createImport = exports.getModulePath = exports.isPolyfillSource = exports.filterStageFromList = exports.getLowestUnreleased = exports.isUnreleasedVersion = exports.prettifyTargets = exports.prettifyVersion = exports.findSuggestion = exports.getValues = exports.semverify = void 0;

function _invariant() {
  const data = _interopRequireDefault(require("invariant"));

  _invariant = function () {
    return data;
  };

  return data;
}

function _semver() {
  const data = _interopRequireDefault(require("semver"));

  _semver = function () {
    return data;
  };

  return data;
}

function _jsLevenshtein() {
  const data = _interopRequireDefault(require("js-levenshtein"));

  _jsLevenshtein = function () {
    return data;
  };

  return data;
}

function _helperModuleImports() {
  const data = require("@babel/helper-module-imports");

  _helperModuleImports = function () {
    return data;
  };

  return data;
}

var _unreleasedLabels = _interopRequireDefault(require("../data/unreleased-labels"));

var _targetsParser = require("./targets-parser");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const versionRegExp = /^(\d+|\d+.\d+)$/;

const semverify = version => {
  if (typeof version === "string" && _semver().default.valid(version)) {
    return version;
  }

  (0, _invariant().default)(typeof version === "number" || typeof version === "string" && versionRegExp.test(version), `'${version}' is not a valid version`);
  const split = version.toString().split(".");

  while (split.length < 3) {
    split.push("0");
  }

  return split.join(".");
};

exports.semverify = semverify;

const getValues = object => Object.keys(object).map(key => object[key]);

exports.getValues = getValues;

const findSuggestion = (options, option) => {
  let levenshteinValue = Infinity;
  return options.reduce((suggestion, validOption) => {
    const value = (0, _jsLevenshtein().default)(validOption, option);

    if (value < levenshteinValue) {
      levenshteinValue = value;
      return validOption;
    }

    return suggestion;
  }, undefined);
};

exports.findSuggestion = findSuggestion;

const prettifyVersion = version => {
  if (typeof version !== "string") {
    return version;
  }

  const parts = [_semver().default.major(version)];

  const minor = _semver().default.minor(version);

  const patch = _semver().default.patch(version);

  if (minor || patch) {
    parts.push(minor);
  }

  if (patch) {
    parts.push(patch);
  }

  return parts.join(".");
};

exports.prettifyVersion = prettifyVersion;

const prettifyTargets = targets => {
  return Object.keys(targets).reduce((results, target) => {
    let value = targets[target];
    const unreleasedLabel = _unreleasedLabels.default[target];

    if (typeof value === "string" && unreleasedLabel !== value) {
      value = prettifyVersion(value);
    }

    results[target] = value;
    return results;
  }, {});
};

exports.prettifyTargets = prettifyTargets;

const isUnreleasedVersion = (version, env) => {
  const unreleasedLabel = _unreleasedLabels.default[env];
  return !!unreleasedLabel && unreleasedLabel === version.toString().toLowerCase();
};

exports.isUnreleasedVersion = isUnreleasedVersion;

const getLowestUnreleased = (a, b, env) => {
  const unreleasedLabel = _unreleasedLabels.default[env];
  const hasUnreleased = [a, b].some(item => item === unreleasedLabel);

  if (hasUnreleased) {
    return a === hasUnreleased ? b : a || b;
  }

  return (0, _targetsParser.semverMin)(a, b);
};

exports.getLowestUnreleased = getLowestUnreleased;

const filterStageFromList = (list, stageList) => {
  return Object.keys(list).reduce((result, item) => {
    if (!stageList[item]) {
      result[item] = list[item];
    }

    return result;
  }, {});
};

exports.filterStageFromList = filterStageFromList;

const isPolyfillSource = source => source === "@babel/polyfill" || source === "core-js";

exports.isPolyfillSource = isPolyfillSource;
const modulePathMap = {
  "regenerator-runtime": "regenerator-runtime/runtime"
};

const getModulePath = mod => modulePathMap[mod] || `core-js/modules/${mod}`;

exports.getModulePath = getModulePath;

const createImport = (path, mod) => (0, _helperModuleImports().addSideEffect)(path, getModulePath(mod));

exports.createImport = createImport;

const isRequire = (t, path) => t.isExpressionStatement(path.node) && t.isCallExpression(path.node.expression) && t.isIdentifier(path.node.expression.callee) && path.node.expression.callee.name === "require" && path.node.expression.arguments.length === 1 && t.isStringLiteral(path.node.expression.arguments[0]) && isPolyfillSource(path.node.expression.arguments[0].value);

exports.isRequire = isRequire;