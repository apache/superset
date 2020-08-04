"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateRegexpuOptions = generateRegexpuOptions;

var _features = require("./features");

function generateRegexpuOptions(node, features) {
  let useUnicodeFlag = false,
      dotAllFlag = false,
      unicodePropertyEscape = false,
      namedGroup = false;
  const {
    flags,
    pattern
  } = node;
  const flagsIncludesU = flags.includes("u");

  if (flagsIncludesU) {
    if (!(0, _features.hasFeature)(features, _features.FEATURES.unicodeFlag)) {
      useUnicodeFlag = true;
    }

    if ((0, _features.hasFeature)(features, _features.FEATURES.unicodePropertyEscape) && /\\[pP]{/.test(pattern)) {
      unicodePropertyEscape = true;
    }
  }

  if ((0, _features.hasFeature)(features, _features.FEATURES.dotAllFlag) && flags.indexOf("s") >= 0) {
    dotAllFlag = true;
  }

  if ((0, _features.hasFeature)(features, _features.FEATURES.namedCaptureGroups) && /\(\?<(?![=!])/.test(pattern)) {
    namedGroup = true;
  }

  if (!namedGroup && !unicodePropertyEscape && !dotAllFlag && (!flagsIncludesU || useUnicodeFlag)) {
    return null;
  }

  if (flagsIncludesU && flags.indexOf("s") >= 0) {
    dotAllFlag = true;
  }

  return {
    useUnicodeFlag,
    onNamedGroup: () => {},
    namedGroup,
    unicodePropertyEscape,
    dotAllFlag,
    lookbehind: true
  };
}