"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultReduceOptions = void 0;

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var defaultReduceOptions = function defaultReduceOptions(prevOptions, loadedOptions) {
  return [].concat((0, _toConsumableArray2["default"])(prevOptions), (0, _toConsumableArray2["default"])(loadedOptions));
};

exports.defaultReduceOptions = defaultReduceOptions;