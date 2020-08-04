"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultShouldLoadMore = void 0;
var AVAILABLE_DELTA = 10;

var defaultShouldLoadMore = function defaultShouldLoadMore(scrollHeight, clientHeight, scrollTop) {
  var bottomBorder = scrollHeight - clientHeight - AVAILABLE_DELTA;
  return bottomBorder < scrollTop;
};

exports.defaultShouldLoadMore = defaultShouldLoadMore;