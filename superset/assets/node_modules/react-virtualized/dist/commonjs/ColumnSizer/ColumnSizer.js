'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

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

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * High-order component that auto-calculates column-widths for `Grid` cells.
 */
var ColumnSizer = function (_React$PureComponent) {
  (0, _inherits3.default)(ColumnSizer, _React$PureComponent);

  function ColumnSizer(props, context) {
    (0, _classCallCheck3.default)(this, ColumnSizer);

    var _this = (0, _possibleConstructorReturn3.default)(this, (ColumnSizer.__proto__ || (0, _getPrototypeOf2.default)(ColumnSizer)).call(this, props, context));

    _this._registerChild = _this._registerChild.bind(_this);
    return _this;
  }

  (0, _createClass3.default)(ColumnSizer, [{
    key: 'componentDidUpdate',
    value: function componentDidUpdate(prevProps) {
      var _props = this.props,
          columnMaxWidth = _props.columnMaxWidth,
          columnMinWidth = _props.columnMinWidth,
          columnCount = _props.columnCount,
          width = _props.width;


      if (columnMaxWidth !== prevProps.columnMaxWidth || columnMinWidth !== prevProps.columnMinWidth || columnCount !== prevProps.columnCount || width !== prevProps.width) {
        if (this._registeredChild) {
          this._registeredChild.recomputeGridSize();
        }
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var _props2 = this.props,
          children = _props2.children,
          columnMaxWidth = _props2.columnMaxWidth,
          columnMinWidth = _props2.columnMinWidth,
          columnCount = _props2.columnCount,
          width = _props2.width;


      var safeColumnMinWidth = columnMinWidth || 1;

      var safeColumnMaxWidth = columnMaxWidth ? Math.min(columnMaxWidth, width) : width;

      var columnWidth = width / columnCount;
      columnWidth = Math.max(safeColumnMinWidth, columnWidth);
      columnWidth = Math.min(safeColumnMaxWidth, columnWidth);
      columnWidth = Math.floor(columnWidth);

      var adjustedWidth = Math.min(width, columnWidth * columnCount);

      return children({
        adjustedWidth: adjustedWidth,
        columnWidth: columnWidth,
        getColumnWidth: function getColumnWidth() {
          return columnWidth;
        },
        registerChild: this._registerChild
      });
    }
  }, {
    key: '_registerChild',
    value: function _registerChild(child) {
      if (child && typeof child.recomputeGridSize !== 'function') {
        throw Error('Unexpected child type registered; only Grid/MultiGrid children are supported.');
      }

      this._registeredChild = child;

      if (this._registeredChild) {
        this._registeredChild.recomputeGridSize();
      }
    }
  }]);
  return ColumnSizer;
}(React.PureComponent);

exports.default = ColumnSizer;
ColumnSizer.propTypes = process.env.NODE_ENV !== "production" ? {
  /**
   * Function responsible for rendering a virtualized Grid.
   * This function should implement the following signature:
   * ({ adjustedWidth, getColumnWidth, registerChild }) => PropTypes.element
   *
   * The specified :getColumnWidth function should be passed to the Grid's :columnWidth property.
   * The :registerChild should be passed to the Grid's :ref property.
   * The :adjustedWidth property is optional; it reflects the lesser of the overall width or the width of all columns.
   */
  children: _propTypes2.default.func.isRequired,

  /** Optional maximum allowed column width */
  columnMaxWidth: _propTypes2.default.number,

  /** Optional minimum allowed column width */
  columnMinWidth: _propTypes2.default.number,

  /** Number of columns in Grid or Table child */
  columnCount: _propTypes2.default.number.isRequired,

  /** Width of Grid or Table child */
  width: _propTypes2.default.number.isRequired
} : {};