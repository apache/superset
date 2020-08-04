"use strict";

exports.__esModule = true;
exports.default = createMarginSelector;
exports.DEFAULT_MARGIN = void 0;

var _reselect = require("reselect");

const DEFAULT_MARGIN = {
  bottom: 16,
  left: 16,
  right: 16,
  top: 16
};
exports.DEFAULT_MARGIN = DEFAULT_MARGIN;

function createMarginSelector(defaultMargin = DEFAULT_MARGIN) {
  return (0, _reselect.createSelector)(margin => margin.bottom, margin => margin.left, margin => margin.right, margin => margin.top, (bottom = defaultMargin.bottom, left = defaultMargin.left, right = defaultMargin.right, top = defaultMargin.top) => ({
    bottom,
    left,
    right,
    top
  }));
}