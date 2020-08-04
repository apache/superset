"use strict";

exports.__esModule = true;
exports.default = labelTransformFactory;

/** Returns a function which takes a Datum and index as input, and returns a formatted label object. */
function labelTransformFactory(_ref) {
  var scale = _ref.scale,
      labelFormat = _ref.labelFormat;
  return function (d, i) {
    return {
      datum: d,
      index: i,
      text: "" + labelFormat(d, i),
      // @ts-ignore
      value: scale(d)
    };
  };
}