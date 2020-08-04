"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = levenArray;

var _leven = _interopRequireDefault(require("leven"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function levenArray(str, array) {
  var minLeven = Number.POSITIVE_INFINITY;
  var result = undefined;

  for (var _i2 = 0; _i2 < array.length; _i2++) {
    var item = array[_i2];
    var distance = (0, _leven.default)(str, item);

    if (distance < minLeven) {
      minLeven = distance;
      result = item;
    }
  }

  return result;
}
