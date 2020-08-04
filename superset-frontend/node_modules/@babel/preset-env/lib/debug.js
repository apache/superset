"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.logUsagePolyfills = exports.logEntryPolyfills = exports.logPluginOrPolyfill = void 0;

var _helperCompilationTargets = require("@babel/helper-compilation-targets");

const wordEnds = size => {
  return size > 1 ? "s" : "";
};

const logPluginOrPolyfill = (item, targetVersions, list) => {
  const filteredList = (0, _helperCompilationTargets.getInclusionReasons)(item, targetVersions, list);
  const formattedTargets = JSON.stringify(filteredList).replace(/,/g, ", ").replace(/^\{"/, '{ "').replace(/"\}$/, '" }');
  console.log(`  ${item} ${formattedTargets}`);
};

exports.logPluginOrPolyfill = logPluginOrPolyfill;

const logEntryPolyfills = (polyfillName, importPolyfillIncluded, polyfills, filename, polyfillTargets, allBuiltInsList) => {
  if (process.env.BABEL_ENV === "test") {
    filename = filename.replace(/\\/g, "/");
  }

  if (!importPolyfillIncluded) {
    console.log(`\n[${filename}] Import of ${polyfillName} was not found.`);
    return;
  }

  if (!polyfills.size) {
    console.log(`\n[${filename}] Based on your targets, polyfills were not added.`);
    return;
  }

  console.log(`\n[${filename}] Replaced ${polyfillName} entries with the following polyfill${wordEnds(polyfills.size)}:`);

  for (const polyfill of polyfills) {
    logPluginOrPolyfill(polyfill, polyfillTargets, allBuiltInsList);
  }
};

exports.logEntryPolyfills = logEntryPolyfills;

const logUsagePolyfills = (polyfills, filename, polyfillTargets, allBuiltInsList) => {
  if (process.env.BABEL_ENV === "test") {
    filename = filename.replace(/\\/g, "/");
  }

  if (!polyfills.size) {
    console.log(`\n[${filename}] Based on your code and targets, core-js polyfills were not added.`);
    return;
  }

  console.log(`\n[${filename}] Added following core-js polyfill${wordEnds(polyfills.size)}:`);

  for (const polyfill of polyfills) {
    logPluginOrPolyfill(polyfill, polyfillTargets, allBuiltInsList);
  }
};

exports.logUsagePolyfills = logUsagePolyfills;