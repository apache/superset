"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.reduceGroupedOptions = void 0;

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread2"));

var reduceGroupedOptions = function reduceGroupedOptions(prevOptions, loadedOptions) {
  var res = prevOptions.slice();
  var mapLabelToIndex = {};
  var prevOptionsIndex = 0;
  var prevOptionsLength = prevOptions.length;
  loadedOptions.forEach(function (group) {
    var label = group.label;
    var groupIndex = mapLabelToIndex[label];

    if (typeof groupIndex !== 'number') {
      for (; prevOptionsIndex < prevOptionsLength && typeof mapLabelToIndex[label] !== 'number'; ++prevOptionsIndex) {
        var prevGroup = prevOptions[prevOptionsIndex];
        mapLabelToIndex[prevGroup.label] = prevOptionsIndex;
      }

      groupIndex = mapLabelToIndex[label];
    }

    if (typeof groupIndex !== 'number') {
      mapLabelToIndex[label] = res.length;
      res.push(group);
      return;
    }

    res[groupIndex] = (0, _objectSpread2["default"])((0, _objectSpread2["default"])({}, res[groupIndex]), {}, {
      options: res[groupIndex].options.concat(group.options)
    });
  });
  return res;
};

exports.reduceGroupedOptions = reduceGroupedOptions;