"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOptionSpecificExcludesFor = exports.getPlatformSpecificDefaultFor = void 0;
const defaultWebIncludes = ["web.timers", "web.immediate", "web.dom.iterable"];
const defaultExcludesForLooseMode = ["transform-typeof-symbol"];

const getPlatformSpecificDefaultFor = targets => {
  const targetNames = Object.keys(targets);
  const isAnyTarget = !targetNames.length;
  const isWebTarget = targetNames.some(name => name !== "node");
  return isAnyTarget || isWebTarget ? defaultWebIncludes : null;
};

exports.getPlatformSpecificDefaultFor = getPlatformSpecificDefaultFor;

const getOptionSpecificExcludesFor = ({
  loose
}) => {
  if (loose) {
    return defaultExcludesForLooseMode;
  }

  return null;
};

exports.getOptionSpecificExcludesFor = getOptionSpecificExcludesFor;