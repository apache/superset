"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.logUsagePolyfills = exports.logEntryPolyfills = exports.logPlugin = exports.logMessage = void 0;

function _semver() {
  const data = _interopRequireDefault(require("semver"));

  _semver = function () {
    return data;
  };

  return data;
}

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const wordEnds = size => {
  return size > 1 ? "s" : "";
};

const logMessage = (message, context) => {
  const pre = context ? `[${context}] ` : "";
  const logStr = `  ${pre}${message}`;
  console.log(logStr);
};

exports.logMessage = logMessage;

const logPlugin = (item, targetVersions, list, context) => {
  const minVersions = list[item] || {};
  const filteredList = Object.keys(targetVersions).reduce((result, env) => {
    const minVersion = minVersions[env];
    const targetVersion = targetVersions[env];

    if (!minVersion) {
      result[env] = (0, _utils.prettifyVersion)(targetVersion);
    } else {
      const minIsUnreleased = (0, _utils.isUnreleasedVersion)(minVersion, env);
      const targetIsUnreleased = (0, _utils.isUnreleasedVersion)(targetVersion, env);

      if (!targetIsUnreleased && (minIsUnreleased || _semver().default.lt(targetVersion, (0, _utils.semverify)(minVersion)))) {
        result[env] = (0, _utils.prettifyVersion)(targetVersion);
      }
    }

    return result;
  }, {});
  const formattedTargets = JSON.stringify(filteredList).replace(/,/g, ", ").replace(/^\{"/, '{ "').replace(/"\}$/, '" }');
  logMessage(`${item} ${formattedTargets}`, context);
};

exports.logPlugin = logPlugin;

const logEntryPolyfills = (importPolyfillIncluded, polyfills, filename, onDebug) => {
  if (!importPolyfillIncluded) {
    console.log(`
[${filename}] \`import '@babel/polyfill'\` was not found.`);
    return;
  }

  if (!polyfills.size) {
    console.log(`
[${filename}] Based on your targets, none were added.`);
    return;
  }

  console.log(`
[${filename}] Replaced \`@babel/polyfill\` with the following polyfill${wordEnds(polyfills.size)}:`);
  onDebug(polyfills);
};

exports.logEntryPolyfills = logEntryPolyfills;

const logUsagePolyfills = (polyfills, filename, onDebug) => {
  if (!polyfills.size) {
    console.log(`
[${filename}] Based on your code and targets, none were added.`);
    return;
  }

  console.log(`
[${filename}] Added following polyfill${wordEnds(polyfills.size)}:`);
  onDebug(polyfills);
};

exports.logUsagePolyfills = logUsagePolyfills;