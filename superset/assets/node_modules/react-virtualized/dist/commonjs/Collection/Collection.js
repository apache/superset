'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _CollectionView = require('./CollectionView');

var _CollectionView2 = _interopRequireDefault(_CollectionView);

var _calculateSizeAndPositionData2 = require('./utils/calculateSizeAndPositionData');

var _calculateSizeAndPositionData3 = _interopRequireDefault(_calculateSizeAndPositionData2);

var _getUpdatedOffsetForIndex = require('../utils/getUpdatedOffsetForIndex');

var _getUpdatedOffsetForIndex2 = _interopRequireDefault(_getUpdatedOffsetForIndex);

var _types = require('./types');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Renders scattered or non-linear data.
 * Unlike Grid, which renders checkerboard data, Collection can render arbitrarily positioned- even overlapping- data.
 */
var Collection = function (_React$PureComponent) {
  (0, _inherits3.default)(Collection, _React$PureComponent);

  function Collection(props, context) {
    (0, _classCallCheck3.default)(this, Collection);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Collection.__proto__ || (0, _getPrototypeOf2.default)(Collection)).call(this, props, context));

    _this._cellMetadata = [];
    _this._lastRenderedCellIndices = [];

    // Cell cache during scroll (for perforamnce)
    _this._cellCache = [];

    _this._isScrollingChange = _this._isScrollingChange.bind(_this);
    _this._setCollectionViewRef = _this._setCollectionViewRef.bind(_this);
    return _this;
  }

  (0, _createClass3.default)(Collection, [{
    key: 'forceUpdate',
    value: function forceUpdate() {
      if (this._collectionView !== undefined) {
        this._collectionView.forceUpdate();
      }
    }

    /** See Collection#recomputeCellSizesAndPositions */

  }, {
    key: 'recomputeCellSizesAndPositions',
    value: function recomputeCellSizesAndPositions() {
      this._cellCache = [];
      this._collectionView.recomputeCellSizesAndPositions();
    }

    /** React lifecycle methods */

  }, {
    key: 'render',
    value: function render() {
      var props = (0, _objectWithoutProperties3.default)(this.props, []);


      return React.createElement(_CollectionView2.default, (0, _extends3.default)({
        cellLayoutManager: this,
        isScrollingChange: this._isScrollingChange,
        ref: this._setCollectionViewRef
      }, props));
    }

    /** CellLayoutManager interface */

  }, {
    key: 'calculateSizeAndPositionData',
    value: function calculateSizeAndPositionData() {
      var _props = this.props,
          cellCount = _props.cellCount,
          cellSizeAndPositionGetter = _props.cellSizeAndPositionGetter,
          sectionSize = _props.sectionSize;


      var data = (0, _calculateSizeAndPositionData3.default)({
        cellCount: cellCount,
        cellSizeAndPositionGetter: cellSizeAndPositionGetter,
        sectionSize: sectionSize
      });

      this._cellMetadata = data.cellMetadata;
      this._sectionManager = data.sectionManager;
      this._height = data.height;
      this._width = data.width;
    }

    /**
     * Returns the most recently rendered set of cell indices.
     */

  }, {
    key: 'getLastRenderedIndices',
    value: function getLastRenderedIndices() {
      return this._lastRenderedCellIndices;
    }

    /**
     * Calculates the minimum amount of change from the current scroll position to ensure the specified cell is (fully) visible.
     */

  }, {
    key: 'getScrollPositionForCell',
    value: function getScrollPositionForCell(_ref) {
      var align = _ref.align,
          cellIndex = _ref.cellIndex,
          height = _ref.height,
          scrollLeft = _ref.scrollLeft,
          scrollTop = _ref.scrollTop,
          width = _ref.width;
      var cellCount = this.props.cellCount;


      if (cellIndex >= 0 && cellIndex < cellCount) {
        var cellMetadata = this._cellMetadata[cellIndex];

        scrollLeft = (0, _getUpdatedOffsetForIndex2.default)({
          align: align,
          cellOffset: cellMetadata.x,
          cellSize: cellMetadata.width,
          containerSize: width,
          currentOffset: scrollLeft,
          targetIndex: cellIndex
        });

        scrollTop = (0, _getUpdatedOffsetForIndex2.default)({
          align: align,
          cellOffset: cellMetadata.y,
          cellSize: cellMetadata.height,
          containerSize: height,
          currentOffset: scrollTop,
          targetIndex: cellIndex
        });
      }

      return {
        scrollLeft: scrollLeft,
        scrollTop: scrollTop
      };
    }
  }, {
    key: 'getTotalSize',
    value: function getTotalSize() {
      return {
        height: this._height,
        width: this._width
      };
    }
  }, {
    key: 'cellRenderers',
    value: function cellRenderers(_ref2) {
      var _this2 = this;

      var height = _ref2.height,
          isScrolling = _ref2.isScrolling,
          width = _ref2.width,
          x = _ref2.x,
          y = _ref2.y;
      var _props2 = this.props,
          cellGroupRenderer = _props2.cellGroupRenderer,
          cellRenderer = _props2.cellRenderer;

      // Store for later calls to getLastRenderedIndices()

      this._lastRenderedCellIndices = this._sectionManager.getCellIndices({
        height: height,
        width: width,
        x: x,
        y: y
      });

      return cellGroupRenderer({
        cellCache: this._cellCache,
        cellRenderer: cellRenderer,
        cellSizeAndPositionGetter: function cellSizeAndPositionGetter(_ref3) {
          var index = _ref3.index;
          return _this2._sectionManager.getCellMetadata({ index: index });
        },
        indices: this._lastRenderedCellIndices,
        isScrolling: isScrolling
      });
    }
  }, {
    key: '_isScrollingChange',
    value: function _isScrollingChange(isScrolling) {
      if (!isScrolling) {
        this._cellCache = [];
      }
    }
  }, {
    key: '_setCollectionViewRef',
    value: function _setCollectionViewRef(ref) {
      this._collectionView = ref;
    }
  }]);
  return Collection;
}(React.PureComponent);

Collection.defaultProps = {
  'aria-label': 'grid',
  cellGroupRenderer: defaultCellGroupRenderer
};
exports.default = Collection;
Collection.propTypes = process.env.NODE_ENV !== "production" ? {
  'aria-label': _propTypes2.default.string,

  /**
   * Number of cells in Collection.
   */
  cellCount: _propTypes2.default.number.isRequired,

  /**
   * Responsible for rendering a group of cells given their indices.
   * Should implement the following interface: ({
   *   cellSizeAndPositionGetter:Function,
   *   indices: Array<number>,
   *   cellRenderer: Function
   * }): Array<PropTypes.node>
   */
  cellGroupRenderer: _propTypes2.default.func.isRequired,

  /**
   * Responsible for rendering a cell given an row and column index.
   * Should implement the following interface: ({ index: number, key: string, style: object }): PropTypes.element
   */
  cellRenderer: _propTypes2.default.func.isRequired,

  /**
   * Callback responsible for returning size and offset/position information for a given cell (index).
   * ({ index: number }): { height: number, width: number, x: number, y: number }
   */
  cellSizeAndPositionGetter: _propTypes2.default.func.isRequired,

  /**
   * Optionally override the size of the sections a Collection's cells are split into.
   */
  sectionSize: _propTypes2.default.number
} : {};


function defaultCellGroupRenderer(_ref4) {
  var cellCache = _ref4.cellCache,
      cellRenderer = _ref4.cellRenderer,
      cellSizeAndPositionGetter = _ref4.cellSizeAndPositionGetter,
      indices = _ref4.indices,
      isScrolling = _ref4.isScrolling;

  return indices.map(function (index) {
    var cellMetadata = cellSizeAndPositionGetter({ index: index });

    var cellRendererProps = {
      index: index,
      isScrolling: isScrolling,
      key: index,
      style: {
        height: cellMetadata.height,
        left: cellMetadata.x,
        position: 'absolute',
        top: cellMetadata.y,
        width: cellMetadata.width
      }
    };

    // Avoid re-creating cells while scrolling.
    // This can lead to the same cell being created many times and can cause performance issues for "heavy" cells.
    // If a scroll is in progress- cache and reuse cells.
    // This cache will be thrown away once scrolling complets.
    if (isScrolling) {
      if (!(index in cellCache)) {
        cellCache[index] = cellRenderer(cellRendererProps);
      }

      return cellCache[index];
    } else {
      return cellRenderer(cellRendererProps);
    }
  }).filter(function (renderedCell) {
    return !!renderedCell;
  });
}