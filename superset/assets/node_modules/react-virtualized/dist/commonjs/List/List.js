'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _getOwnPropertyDescriptor = require('babel-runtime/core-js/object/get-own-property-descriptor');

var _getOwnPropertyDescriptor2 = _interopRequireDefault(_getOwnPropertyDescriptor);

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

var _Grid = require('../Grid');

var _Grid2 = _interopRequireDefault(_Grid);

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _types = require('./types');

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * It is inefficient to create and manage a large list of DOM elements within a scrolling container
 * if only a few of those elements are visible. The primary purpose of this component is to improve
 * performance by only rendering the DOM nodes that a user is able to see based on their current
 * scroll position.
 *
 * This component renders a virtualized list of elements with either fixed or dynamic heights.
 */

var List = function (_React$PureComponent) {
  (0, _inherits3.default)(List, _React$PureComponent);

  function List() {
    var _ref;

    var _temp, _this, _ret;

    (0, _classCallCheck3.default)(this, List);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = (0, _possibleConstructorReturn3.default)(this, (_ref = List.__proto__ || (0, _getPrototypeOf2.default)(List)).call.apply(_ref, [this].concat(args))), _this), _this._cellRenderer = function (_ref2) {
      var parent = _ref2.parent,
          rowIndex = _ref2.rowIndex,
          style = _ref2.style,
          isScrolling = _ref2.isScrolling,
          isVisible = _ref2.isVisible,
          key = _ref2.key;
      var rowRenderer = _this.props.rowRenderer;

      // TRICKY The style object is sometimes cached by Grid.
      // This prevents new style objects from bypassing shallowCompare().
      // However as of React 16, style props are auto-frozen (at least in dev mode)
      // Check to make sure we can still modify the style before proceeding.
      // https://github.com/facebook/react/commit/977357765b44af8ff0cfea327866861073095c12#commitcomment-20648713

      var _Object$getOwnPropert = (0, _getOwnPropertyDescriptor2.default)(style, 'width'),
          writable = _Object$getOwnPropert.writable;

      if (writable) {
        // By default, List cells should be 100% width.
        // This prevents them from flowing under a scrollbar (if present).
        style.width = '100%';
      }

      return rowRenderer({
        index: rowIndex,
        style: style,
        isScrolling: isScrolling,
        isVisible: isVisible,
        key: key,
        parent: parent
      });
    }, _this._setRef = function (ref) {
      _this.Grid = ref;
    }, _this._onScroll = function (_ref3) {
      var clientHeight = _ref3.clientHeight,
          scrollHeight = _ref3.scrollHeight,
          scrollTop = _ref3.scrollTop;
      var onScroll = _this.props.onScroll;


      onScroll({ clientHeight: clientHeight, scrollHeight: scrollHeight, scrollTop: scrollTop });
    }, _this._onSectionRendered = function (_ref4) {
      var rowOverscanStartIndex = _ref4.rowOverscanStartIndex,
          rowOverscanStopIndex = _ref4.rowOverscanStopIndex,
          rowStartIndex = _ref4.rowStartIndex,
          rowStopIndex = _ref4.rowStopIndex;
      var onRowsRendered = _this.props.onRowsRendered;


      onRowsRendered({
        overscanStartIndex: rowOverscanStartIndex,
        overscanStopIndex: rowOverscanStopIndex,
        startIndex: rowStartIndex,
        stopIndex: rowStopIndex
      });
    }, _temp), (0, _possibleConstructorReturn3.default)(_this, _ret);
  }

  (0, _createClass3.default)(List, [{
    key: 'forceUpdateGrid',
    value: function forceUpdateGrid() {
      if (this.Grid) {
        this.Grid.forceUpdate();
      }
    }

    /** See Grid#getOffsetForCell */

  }, {
    key: 'getOffsetForRow',
    value: function getOffsetForRow(_ref5) {
      var alignment = _ref5.alignment,
          index = _ref5.index;

      if (this.Grid) {
        var _Grid$getOffsetForCel = this.Grid.getOffsetForCell({
          alignment: alignment,
          rowIndex: index,
          columnIndex: 0
        }),
            _scrollTop = _Grid$getOffsetForCel.scrollTop;

        return _scrollTop;
      }
      return 0;
    }

    /** CellMeasurer compatibility */

  }, {
    key: 'invalidateCellSizeAfterRender',
    value: function invalidateCellSizeAfterRender(_ref6) {
      var columnIndex = _ref6.columnIndex,
          rowIndex = _ref6.rowIndex;

      if (this.Grid) {
        this.Grid.invalidateCellSizeAfterRender({
          rowIndex: rowIndex,
          columnIndex: columnIndex
        });
      }
    }

    /** See Grid#measureAllCells */

  }, {
    key: 'measureAllRows',
    value: function measureAllRows() {
      if (this.Grid) {
        this.Grid.measureAllCells();
      }
    }

    /** CellMeasurer compatibility */

  }, {
    key: 'recomputeGridSize',
    value: function recomputeGridSize() {
      var _ref7 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref7$columnIndex = _ref7.columnIndex,
          columnIndex = _ref7$columnIndex === undefined ? 0 : _ref7$columnIndex,
          _ref7$rowIndex = _ref7.rowIndex,
          rowIndex = _ref7$rowIndex === undefined ? 0 : _ref7$rowIndex;

      if (this.Grid) {
        this.Grid.recomputeGridSize({
          rowIndex: rowIndex,
          columnIndex: columnIndex
        });
      }
    }

    /** See Grid#recomputeGridSize */

  }, {
    key: 'recomputeRowHeights',
    value: function recomputeRowHeights() {
      var index = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      if (this.Grid) {
        this.Grid.recomputeGridSize({
          rowIndex: index,
          columnIndex: 0
        });
      }
    }

    /** See Grid#scrollToPosition */

  }, {
    key: 'scrollToPosition',
    value: function scrollToPosition() {
      var scrollTop = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      if (this.Grid) {
        this.Grid.scrollToPosition({ scrollTop: scrollTop });
      }
    }

    /** See Grid#scrollToCell */

  }, {
    key: 'scrollToRow',
    value: function scrollToRow() {
      var index = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;

      if (this.Grid) {
        this.Grid.scrollToCell({
          columnIndex: 0,
          rowIndex: index
        });
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var _props = this.props,
          className = _props.className,
          noRowsRenderer = _props.noRowsRenderer,
          scrollToIndex = _props.scrollToIndex,
          width = _props.width;


      var classNames = (0, _classnames2.default)('ReactVirtualized__List', className);

      return React.createElement(_Grid2.default, (0, _extends3.default)({}, this.props, {
        autoContainerWidth: true,
        cellRenderer: this._cellRenderer,
        className: classNames,
        columnWidth: width,
        columnCount: 1,
        noContentRenderer: noRowsRenderer,
        onScroll: this._onScroll,
        onSectionRendered: this._onSectionRendered,
        ref: this._setRef,
        scrollToRow: scrollToIndex
      }));
    }
  }]);
  return List;
}(React.PureComponent);

List.defaultProps = {
  autoHeight: false,
  estimatedRowSize: 30,
  onScroll: function onScroll() {},
  noRowsRenderer: function noRowsRenderer() {
    return null;
  },
  onRowsRendered: function onRowsRendered() {},
  overscanIndicesGetter: _Grid.accessibilityOverscanIndicesGetter,
  overscanRowCount: 10,
  scrollToAlignment: 'auto',
  scrollToIndex: -1,
  style: {}
};
List.propTypes = process.env.NODE_ENV === 'production' ? null : {
  "aria-label": _propTypes2.default.string,


  /**
   * Removes fixed height from the scrollingContainer so that the total height
   * of rows can stretch the window. Intended for use with WindowScroller
   */
  autoHeight: _propTypes2.default.bool.isRequired,


  /** Optional CSS class name */
  className: _propTypes2.default.string,


  /**
   * Used to estimate the total height of a List before all of its rows have actually been measured.
   * The estimated total height is adjusted as rows are rendered.
   */
  estimatedRowSize: _propTypes2.default.number.isRequired,


  /** Height constraint for list (determines how many actual rows are rendered) */
  height: _propTypes2.default.number.isRequired,


  /** Optional renderer to be used in place of rows when rowCount is 0 */
  noRowsRenderer: function noRowsRenderer() {
    return (typeof _Grid.bpfrpt_proptype_NoContentRenderer === 'function' ? _Grid.bpfrpt_proptype_NoContentRenderer.isRequired ? _Grid.bpfrpt_proptype_NoContentRenderer.isRequired : _Grid.bpfrpt_proptype_NoContentRenderer : _propTypes2.default.shape(_Grid.bpfrpt_proptype_NoContentRenderer).isRequired).apply(this, arguments);
  },


  /** Callback invoked with information about the slice of rows that were just rendered.  */

  onRowsRendered: _propTypes2.default.func.isRequired,


  /**
   * Callback invoked whenever the scroll offset changes within the inner scrollable region.
   * This callback can be used to sync scrolling between lists, tables, or grids.
   */
  onScroll: _propTypes2.default.func.isRequired,


  /** See Grid#overscanIndicesGetter */
  overscanIndicesGetter: function overscanIndicesGetter() {
    return (typeof _Grid.bpfrpt_proptype_OverscanIndicesGetter === 'function' ? _Grid.bpfrpt_proptype_OverscanIndicesGetter.isRequired ? _Grid.bpfrpt_proptype_OverscanIndicesGetter.isRequired : _Grid.bpfrpt_proptype_OverscanIndicesGetter : _propTypes2.default.shape(_Grid.bpfrpt_proptype_OverscanIndicesGetter).isRequired).apply(this, arguments);
  },


  /**
   * Number of rows to render above/below the visible bounds of the list.
   * These rows can help for smoother scrolling on touch devices.
   */
  overscanRowCount: _propTypes2.default.number.isRequired,


  /** Either a fixed row height (number) or a function that returns the height of a row given its index.  */
  rowHeight: function rowHeight() {
    return (typeof _Grid.bpfrpt_proptype_CellSize === 'function' ? _Grid.bpfrpt_proptype_CellSize.isRequired ? _Grid.bpfrpt_proptype_CellSize.isRequired : _Grid.bpfrpt_proptype_CellSize : _propTypes2.default.shape(_Grid.bpfrpt_proptype_CellSize).isRequired).apply(this, arguments);
  },


  /** Responsible for rendering a row given an index; ({ index: number }): node */
  rowRenderer: function rowRenderer() {
    return (typeof _types.bpfrpt_proptype_RowRenderer === 'function' ? _types.bpfrpt_proptype_RowRenderer.isRequired ? _types.bpfrpt_proptype_RowRenderer.isRequired : _types.bpfrpt_proptype_RowRenderer : _propTypes2.default.shape(_types.bpfrpt_proptype_RowRenderer).isRequired).apply(this, arguments);
  },


  /** Number of rows in list. */
  rowCount: _propTypes2.default.number.isRequired,


  /** See Grid#scrollToAlignment */
  scrollToAlignment: function scrollToAlignment() {
    return (typeof _Grid.bpfrpt_proptype_Alignment === 'function' ? _Grid.bpfrpt_proptype_Alignment.isRequired ? _Grid.bpfrpt_proptype_Alignment.isRequired : _Grid.bpfrpt_proptype_Alignment : _propTypes2.default.shape(_Grid.bpfrpt_proptype_Alignment).isRequired).apply(this, arguments);
  },


  /** Row index to ensure visible (by forcefully scrolling if necessary) */
  scrollToIndex: _propTypes2.default.number.isRequired,


  /** Vertical offset. */
  scrollTop: _propTypes2.default.number,


  /** Optional inline style */
  style: _propTypes2.default.object.isRequired,


  /** Tab index for focus */
  tabIndex: _propTypes2.default.number,


  /** Width of list */
  width: _propTypes2.default.number.isRequired
};
exports.default = List;