'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getCellMetadata = getCellMetadata;

var _initCellMetadata = require('./initCellMetadata');

var _initCellMetadata2 = _interopRequireDefault(_initCellMetadata);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Default cell sizes and offsets for use in below tests
function getCellMetadata() {
  var cellSizes = [10, // 0: 0..0 (min)
  20, // 1: 0..10
  15, // 2: 0..30
  10, // 3: 5..45
  15, // 4: 20..55
  30, // 5: 50..70
  20, // 6: 70..100
  10, // 7: 80..110
  30];
  return (0, _initCellMetadata2.default)({
    cellCount: cellSizes.length,
    size: function size(_ref) {
      var index = _ref.index;
      return cellSizes[index];
    }
  });
}