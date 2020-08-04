"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _helperCreateRegexpFeaturesPlugin = require("@babel/helper-create-regexp-features-plugin");

function _default(core, options) {
  const {
    runtime = true
  } = options;

  if (typeof runtime !== "boolean") {
    throw new Error("The 'runtime' option must be boolean");
  }

  return (0, _helperCreateRegexpFeaturesPlugin.createRegExpFeaturePlugin)({
    name: "transform-named-capturing-groups-regex",
    feature: "namedCaptureGroups",
    options: {
      runtime
    }
  });
}