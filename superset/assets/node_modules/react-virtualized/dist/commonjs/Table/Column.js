'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _defaultHeaderRenderer = require('./defaultHeaderRenderer');

var _defaultHeaderRenderer2 = _interopRequireDefault(_defaultHeaderRenderer);

var _defaultCellRenderer = require('./defaultCellRenderer');

var _defaultCellRenderer2 = _interopRequireDefault(_defaultCellRenderer);

var _defaultCellDataGetter = require('./defaultCellDataGetter');

var _defaultCellDataGetter2 = _interopRequireDefault(_defaultCellDataGetter);

var _SortDirection = require('./SortDirection');

var _SortDirection2 = _interopRequireDefault(_SortDirection);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Describes the header and cell contents of a table column.
 */
var Column = function (_React$Component) {
  (0, _inherits3.default)(Column, _React$Component);

  function Column() {
    (0, _classCallCheck3.default)(this, Column);
    return (0, _possibleConstructorReturn3.default)(this, (Column.__proto__ || (0, _getPrototypeOf2.default)(Column)).apply(this, arguments));
  }

  return Column;
}(React.Component);

Column.defaultProps = {
  cellDataGetter: _defaultCellDataGetter2.default,
  cellRenderer: _defaultCellRenderer2.default,
  defaultSortDirection: _SortDirection2.default.ASC,
  flexGrow: 0,
  flexShrink: 1,
  headerRenderer: _defaultHeaderRenderer2.default,
  style: {}
};
exports.default = Column;
Column.propTypes = process.env.NODE_ENV !== "production" ? {
  /** Optional aria-label value to set on the column header */
  'aria-label': _propTypes2.default.string,

  /**
   * Callback responsible for returning a cell's data, given its :dataKey
   * ({ columnData: any, dataKey: string, rowData: any }): any
   */
  cellDataGetter: _propTypes2.default.func,

  /**
   * Callback responsible for rendering a cell's contents.
   * ({ cellData: any, columnData: any, dataKey: string, rowData: any, rowIndex: number }): node
   */
  cellRenderer: _propTypes2.default.func,

  /** Optional CSS class to apply to cell */
  className: _propTypes2.default.string,

  /** Optional additional data passed to this column's :cellDataGetter */
  columnData: _propTypes2.default.object,

  /** Uniquely identifies the row-data attribute corresponding to this cell */
  dataKey: _propTypes2.default.any.isRequired,

  /** Optional direction to be used when clicked the first time */
  defaultSortDirection: _propTypes2.default.oneOf([_SortDirection2.default.ASC, _SortDirection2.default.DESC]),

  /** If sort is enabled for the table at large, disable it for this column */
  disableSort: _propTypes2.default.bool,

  /** Flex grow style; defaults to 0 */
  flexGrow: _propTypes2.default.number,

  /** Flex shrink style; defaults to 1 */
  flexShrink: _propTypes2.default.number,

  /** Optional CSS class to apply to this column's header */
  headerClassName: _propTypes2.default.string,

  /**
   * Optional callback responsible for rendering a column header contents.
   * ({ columnData: object, dataKey: string, disableSort: boolean, label: node, sortBy: string, sortDirection: string }): PropTypes.node
   */
  headerRenderer: _propTypes2.default.func.isRequired,

  /** Optional inline style to apply to this column's header */
  headerStyle: _propTypes2.default.object,

  /** Optional id to set on the column header */
  id: _propTypes2.default.string,

  /** Header label for this column */
  label: _propTypes2.default.node,

  /** Maximum width of column; this property will only be used if :flexGrow is > 0. */
  maxWidth: _propTypes2.default.number,

  /** Minimum width of column. */
  minWidth: _propTypes2.default.number,

  /** Optional inline style to apply to cell */
  style: _propTypes2.default.object,

  /** Flex basis (width) for this column; This value can grow or shrink based on :flexGrow and :flexShrink properties. */
  width: _propTypes2.default.number.isRequired
} : {};