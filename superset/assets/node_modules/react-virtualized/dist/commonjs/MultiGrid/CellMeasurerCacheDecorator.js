'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _CellMeasurer = require('../CellMeasurer');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Caches measurements for a given cell.
 */
var CellMeasurerCacheDecorator = function () {
  function CellMeasurerCacheDecorator() {
    var _this = this;

    var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    (0, _classCallCheck3.default)(this, CellMeasurerCacheDecorator);

    this.columnWidth = function (_ref) {
      var index = _ref.index;

      _this._cellMeasurerCache.columnWidth({
        index: index + _this._columnIndexOffset
      });
    };

    this.rowHeight = function (_ref2) {
      var index = _ref2.index;

      _this._cellMeasurerCache.rowHeight({
        index: index + _this._rowIndexOffset
      });
    };

    var cellMeasurerCache = params.cellMeasurerCache,
        _params$columnIndexOf = params.columnIndexOffset,
        columnIndexOffset = _params$columnIndexOf === undefined ? 0 : _params$columnIndexOf,
        _params$rowIndexOffse = params.rowIndexOffset,
        rowIndexOffset = _params$rowIndexOffse === undefined ? 0 : _params$rowIndexOffse;


    this._cellMeasurerCache = cellMeasurerCache;
    this._columnIndexOffset = columnIndexOffset;
    this._rowIndexOffset = rowIndexOffset;
  }

  (0, _createClass3.default)(CellMeasurerCacheDecorator, [{
    key: 'clear',
    value: function clear(rowIndex, columnIndex) {
      this._cellMeasurerCache.clear(rowIndex + this._rowIndexOffset, columnIndex + this._columnIndexOffset);
    }
  }, {
    key: 'clearAll',
    value: function clearAll() {
      this._cellMeasurerCache.clearAll();
    }
  }, {
    key: 'hasFixedHeight',
    value: function hasFixedHeight() {
      return this._cellMeasurerCache.hasFixedHeight();
    }
  }, {
    key: 'hasFixedWidth',
    value: function hasFixedWidth() {
      return this._cellMeasurerCache.hasFixedWidth();
    }
  }, {
    key: 'getHeight',
    value: function getHeight(rowIndex) {
      var columnIndex = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

      return this._cellMeasurerCache.getHeight(rowIndex + this._rowIndexOffset, columnIndex + this._columnIndexOffset);
    }
  }, {
    key: 'getWidth',
    value: function getWidth(rowIndex) {
      var columnIndex = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

      return this._cellMeasurerCache.getWidth(rowIndex + this._rowIndexOffset, columnIndex + this._columnIndexOffset);
    }
  }, {
    key: 'has',
    value: function has(rowIndex) {
      var columnIndex = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;

      return this._cellMeasurerCache.has(rowIndex + this._rowIndexOffset, columnIndex + this._columnIndexOffset);
    }
  }, {
    key: 'set',
    value: function set(rowIndex, columnIndex, width, height) {
      this._cellMeasurerCache.set(rowIndex + this._rowIndexOffset, columnIndex + this._columnIndexOffset, width, height);
    }
  }, {
    key: 'defaultHeight',
    get: function get() {
      return this._cellMeasurerCache.defaultHeight;
    }
  }, {
    key: 'defaultWidth',
    get: function get() {
      return this._cellMeasurerCache.defaultWidth;
    }
  }]);
  return CellMeasurerCacheDecorator;
}();

exports.default = CellMeasurerCacheDecorator;