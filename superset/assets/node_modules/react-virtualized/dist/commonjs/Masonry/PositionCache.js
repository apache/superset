'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _intervalTree = require('../vendor/intervalTree');

var _intervalTree2 = _interopRequireDefault(_intervalTree);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Position cache requirements:
//   O(log(n)) lookup of cells to render for a given viewport size
//   O(1) lookup of shortest measured column (so we know when to enter phase 1)
var PositionCache = function () {
  function PositionCache() {
    (0, _classCallCheck3.default)(this, PositionCache);
    this._columnSizeMap = {};
    this._intervalTree = (0, _intervalTree2.default)();
    this._leftMap = {};
  }
  // Tracks the height of each column


  // Store tops and bottoms of each cell for fast intersection lookup.


  // Maps cell index to x coordinates for quick lookup.


  (0, _createClass3.default)(PositionCache, [{
    key: 'estimateTotalHeight',
    value: function estimateTotalHeight(cellCount, columnCount, defaultCellHeight) {
      var unmeasuredCellCount = cellCount - this.count;
      return this.tallestColumnSize + Math.ceil(unmeasuredCellCount / columnCount) * defaultCellHeight;
    }

    // Render all cells visible within the viewport range defined.

  }, {
    key: 'range',
    value: function range(scrollTop, clientHeight, renderCallback) {
      var _this = this;

      this._intervalTree.queryInterval(scrollTop, scrollTop + clientHeight, function (_ref) {
        var _ref2 = (0, _slicedToArray3.default)(_ref, 3),
            top = _ref2[0],
            _ = _ref2[1],
            index = _ref2[2];

        return renderCallback(index, _this._leftMap[index], top);
      });
    }
  }, {
    key: 'setPosition',
    value: function setPosition(index, left, top, height) {
      this._intervalTree.insert([top, top + height, index]);
      this._leftMap[index] = left;

      var columnSizeMap = this._columnSizeMap;
      var columnHeight = columnSizeMap[left];
      if (columnHeight === undefined) {
        columnSizeMap[left] = top + height;
      } else {
        columnSizeMap[left] = Math.max(columnHeight, top + height);
      }
    }
  }, {
    key: 'count',
    get: function get() {
      return this._intervalTree.count;
    }
  }, {
    key: 'shortestColumnSize',
    get: function get() {
      var columnSizeMap = this._columnSizeMap;

      var size = 0;

      for (var i in columnSizeMap) {
        var height = columnSizeMap[i];
        size = size === 0 ? height : Math.min(size, height);
      }

      return size;
    }
  }, {
    key: 'tallestColumnSize',
    get: function get() {
      var columnSizeMap = this._columnSizeMap;

      var size = 0;

      for (var i in columnSizeMap) {
        var height = columnSizeMap[i];
        size = Math.max(size, height);
      }

      return size;
    }
  }]);
  return PositionCache;
}();

exports.default = PositionCache;