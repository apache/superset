"use strict";

exports.__esModule = true;
exports.default = luminanceFromRGB;
exports.LUMINANCE_BLUE_WEIGHT = exports.LUMINANCE_GREEN_WEIGHT = exports.LUMINANCE_RED_WEIGHT = void 0;
const LUMINANCE_RED_WEIGHT = 0.2126;
exports.LUMINANCE_RED_WEIGHT = LUMINANCE_RED_WEIGHT;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
exports.LUMINANCE_GREEN_WEIGHT = LUMINANCE_GREEN_WEIGHT;
const LUMINANCE_BLUE_WEIGHT = 0.0722;
exports.LUMINANCE_BLUE_WEIGHT = LUMINANCE_BLUE_WEIGHT;

function luminanceFromRGB(r, g, b) {
  // Formula: https://en.wikipedia.org/wiki/Relative_luminance
  return LUMINANCE_RED_WEIGHT * r + LUMINANCE_GREEN_WEIGHT * g + LUMINANCE_BLUE_WEIGHT * b;
}