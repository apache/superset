"use strict";

exports.__esModule = true;
exports.default = computeBoundsFromPoints;

var _d3Array = require("d3-array");

const LAT_LIMIT = [-90, 90];
const LNG_LIMIT = [-180, 180];
/**
 * Expand a coordinate range by `padding` and within limits, if needed
 */

function expandIfNeeded(_ref, _ref2, padding) {
  let [curMin, curMax] = _ref;
  let [minBound, maxBound] = _ref2;

  if (padding === void 0) {
    padding = 0.25;
  }

  return curMin < curMax ? [curMin, curMax] : [Math.max(minBound, curMin - padding), Math.min(maxBound, curMax + padding)];
}

function computeBoundsFromPoints(points) {
  const latBounds = expandIfNeeded((0, _d3Array.extent)(points, x => x[1]), LAT_LIMIT);
  const lngBounds = expandIfNeeded((0, _d3Array.extent)(points, x => x[0]), LNG_LIMIT);
  return [[lngBounds[0], latBounds[0]], [lngBounds[1], latBounds[1]]];
}