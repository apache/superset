'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

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

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _Column = require('./Column');

var _Column2 = _interopRequireDefault(_Column);

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

var _react = require('react');

var React = _interopRequireWildcard(_react);

var _reactDom = require('react-dom');

var _Grid2 = require('../Grid');

var _Grid3 = _interopRequireDefault(_Grid2);

var _defaultRowRenderer = require('./defaultRowRenderer');

var _defaultRowRenderer2 = _interopRequireDefault(_defaultRowRenderer);

var _defaultHeaderRowRenderer = require('./defaultHeaderRowRenderer');

var _defaultHeaderRowRenderer2 = _interopRequireDefault(_defaultHeaderRowRenderer);

var _SortDirection = require('./SortDirection');

var _SortDirection2 = _interopRequireDefault(_SortDirection);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Table component with fixed headers and virtualized rows for improved performance with large data sets.
 * This component expects explicit width, height, and padding parameters.
 */
var Table = function (_React$PureComponent) {
  (0, _inherits3.default)(Table, _React$PureComponent);

  function Table(props) {
    (0, _classCallCheck3.default)(this, Table);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Table.__proto__ || (0, _getPrototypeOf2.default)(Table)).call(this, props));

    _this.state = {
      scrollbarWidth: 0
    };

    _this._createColumn = _this._createColumn.bind(_this);
    _this._createRow = _this._createRow.bind(_this);
    _this._onScroll = _this._onScroll.bind(_this);
    _this._onSectionRendered = _this._onSectionRendered.bind(_this);
    _this._setRef = _this._setRef.bind(_this);
    return _this;
  }

  (0, _createClass3.default)(Table, [{
    key: 'forceUpdateGrid',
    value: function forceUpdateGrid() {
      if (this.Grid) {
        this.Grid.forceUpdate();
      }
    }

    /** See Grid#getOffsetForCell */

  }, {
    key: 'getOffsetForRow',
    value: function getOffsetForRow(_ref) {
      var alignment = _ref.alignment,
          index = _ref.index;

      if (this.Grid) {
        var _Grid$getOffsetForCel = this.Grid.getOffsetForCell({
          alignment: alignment,
          rowIndex: index
        }),
            scrollTop = _Grid$getOffsetForCel.scrollTop;

        return scrollTop;
      }
      return 0;
    }

    /** CellMeasurer compatibility */

  }, {
    key: 'invalidateCellSizeAfterRender',
    value: function invalidateCellSizeAfterRender(_ref2) {
      var columnIndex = _ref2.columnIndex,
          rowIndex = _ref2.rowIndex;

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
      var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref3$columnIndex = _ref3.columnIndex,
          columnIndex = _ref3$columnIndex === undefined ? 0 : _ref3$columnIndex,
          _ref3$rowIndex = _ref3.rowIndex,
          rowIndex = _ref3$rowIndex === undefined ? 0 : _ref3$rowIndex;

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
          rowIndex: index
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
    key: 'componentDidMount',
    value: function componentDidMount() {
      this._setScrollbarWidth();
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate() {
      this._setScrollbarWidth();
    }
  }, {
    key: 'render',
    value: function render() {
      var _this2 = this;

      var _props = this.props,
          children = _props.children,
          className = _props.className,
          disableHeader = _props.disableHeader,
          gridClassName = _props.gridClassName,
          gridStyle = _props.gridStyle,
          headerHeight = _props.headerHeight,
          headerRowRenderer = _props.headerRowRenderer,
          height = _props.height,
          id = _props.id,
          noRowsRenderer = _props.noRowsRenderer,
          rowClassName = _props.rowClassName,
          rowStyle = _props.rowStyle,
          scrollToIndex = _props.scrollToIndex,
          style = _props.style,
          width = _props.width;
      var scrollbarWidth = this.state.scrollbarWidth;


      var availableRowsHeight = disableHeader ? height : height - headerHeight;

      var rowClass = typeof rowClassName === 'function' ? rowClassName({ index: -1 }) : rowClassName;
      var rowStyleObject = typeof rowStyle === 'function' ? rowStyle({ index: -1 }) : rowStyle;

      // Precompute and cache column styles before rendering rows and columns to speed things up
      this._cachedColumnStyles = [];
      React.Children.toArray(children).forEach(function (column, index) {
        var flexStyles = _this2._getFlexStyleForColumn(column, column.props.style);

        _this2._cachedColumnStyles[index] = (0, _extends3.default)({}, flexStyles, {
          overflow: 'hidden'
        });
      });

      // Note that we specify :rowCount, :scrollbarWidth, :sortBy, and :sortDirection as properties on Grid even though these have nothing to do with Grid.
      // This is done because Grid is a pure component and won't update unless its properties or state has changed.
      // Any property that should trigger a re-render of Grid then is specified here to avoid a stale display.
      return React.createElement(
        'div',
        {
          className: (0, _classnames2.default)('ReactVirtualized__Table', className),
          id: id,
          role: 'grid',
          style: style },
        !disableHeader && headerRowRenderer({
          className: (0, _classnames2.default)('ReactVirtualized__Table__headerRow', rowClass),
          columns: this._getHeaderColumns(),
          style: (0, _extends3.default)({}, rowStyleObject, {
            height: headerHeight,
            overflow: 'hidden',
            paddingRight: scrollbarWidth,
            width: width
          })
        }),
        React.createElement(_Grid3.default, (0, _extends3.default)({}, this.props, {
          autoContainerWidth: true,
          className: (0, _classnames2.default)('ReactVirtualized__Table__Grid', gridClassName),
          cellRenderer: this._createRow,
          columnWidth: width,
          columnCount: 1,
          height: availableRowsHeight,
          id: undefined,
          noContentRenderer: noRowsRenderer,
          onScroll: this._onScroll,
          onSectionRendered: this._onSectionRendered,
          ref: this._setRef,
          role: 'rowgroup',
          scrollbarWidth: scrollbarWidth,
          scrollToRow: scrollToIndex,
          style: (0, _extends3.default)({}, gridStyle, {
            overflowX: 'hidden'
          })
        }))
      );
    }
  }, {
    key: '_createColumn',
    value: function _createColumn(_ref4) {
      var column = _ref4.column,
          columnIndex = _ref4.columnIndex,
          isScrolling = _ref4.isScrolling,
          parent = _ref4.parent,
          rowData = _ref4.rowData,
          rowIndex = _ref4.rowIndex;
      var _column$props = column.props,
          cellDataGetter = _column$props.cellDataGetter,
          cellRenderer = _column$props.cellRenderer,
          className = _column$props.className,
          columnData = _column$props.columnData,
          dataKey = _column$props.dataKey,
          id = _column$props.id;


      var cellData = cellDataGetter({ columnData: columnData, dataKey: dataKey, rowData: rowData });
      var renderedCell = cellRenderer({
        cellData: cellData,
        columnData: columnData,
        columnIndex: columnIndex,
        dataKey: dataKey,
        isScrolling: isScrolling,
        parent: parent,
        rowData: rowData,
        rowIndex: rowIndex
      });

      var style = this._cachedColumnStyles[columnIndex];

      var title = typeof renderedCell === 'string' ? renderedCell : null;

      // Avoid using object-spread syntax with multiple objects here,
      // Since it results in an extra method call to 'babel-runtime/helpers/extends'
      // See PR https://github.com/bvaughn/react-virtualized/pull/942
      return React.createElement(
        'div',
        {
          'aria-describedby': id,
          className: (0, _classnames2.default)('ReactVirtualized__Table__rowColumn', className),
          key: 'Row' + rowIndex + '-' + 'Col' + columnIndex,
          role: 'gridcell',
          style: style,
          title: title },
        renderedCell
      );
    }
  }, {
    key: '_createHeader',
    value: function _createHeader(_ref5) {
      var column = _ref5.column,
          index = _ref5.index;
      var _props2 = this.props,
          headerClassName = _props2.headerClassName,
          headerStyle = _props2.headerStyle,
          onHeaderClick = _props2.onHeaderClick,
          sort = _props2.sort,
          sortBy = _props2.sortBy,
          sortDirection = _props2.sortDirection;
      var _column$props2 = column.props,
          columnData = _column$props2.columnData,
          dataKey = _column$props2.dataKey,
          defaultSortDirection = _column$props2.defaultSortDirection,
          disableSort = _column$props2.disableSort,
          headerRenderer = _column$props2.headerRenderer,
          id = _column$props2.id,
          label = _column$props2.label;

      var sortEnabled = !disableSort && sort;

      var classNames = (0, _classnames2.default)('ReactVirtualized__Table__headerColumn', headerClassName, column.props.headerClassName, {
        ReactVirtualized__Table__sortableHeaderColumn: sortEnabled
      });
      var style = this._getFlexStyleForColumn(column, (0, _extends3.default)({}, headerStyle, column.props.headerStyle));

      var renderedHeader = headerRenderer({
        columnData: columnData,
        dataKey: dataKey,
        disableSort: disableSort,
        label: label,
        sortBy: sortBy,
        sortDirection: sortDirection
      });

      var headerOnClick = void 0,
          headerOnKeyDown = void 0,
          headerTabIndex = void 0,
          headerAriaSort = void 0,
          headerAriaLabel = void 0;

      if (sortEnabled || onHeaderClick) {
        // If this is a sortable header, clicking it should update the table data's sorting.
        var isFirstTimeSort = sortBy !== dataKey;

        // If this is the firstTime sort of this column, use the column default sort order.
        // Otherwise, invert the direction of the sort.
        var newSortDirection = isFirstTimeSort ? defaultSortDirection : sortDirection === _SortDirection2.default.DESC ? _SortDirection2.default.ASC : _SortDirection2.default.DESC;

        var onClick = function onClick(event) {
          sortEnabled && sort({
            defaultSortDirection: defaultSortDirection,
            event: event,
            sortBy: dataKey,
            sortDirection: newSortDirection
          });
          onHeaderClick && onHeaderClick({ columnData: columnData, dataKey: dataKey, event: event });
        };

        var onKeyDown = function onKeyDown(event) {
          if (event.key === 'Enter' || event.key === ' ') {
            onClick(event);
          }
        };

        headerAriaLabel = column.props['aria-label'] || label || dataKey;
        headerTabIndex = 0;
        headerOnClick = onClick;
        headerOnKeyDown = onKeyDown;
      }

      if (sortBy === dataKey) {
        headerAriaSort = sortDirection === _SortDirection2.default.ASC ? 'ascending' : 'descending';
      }

      // Avoid using object-spread syntax with multiple objects here,
      // Since it results in an extra method call to 'babel-runtime/helpers/extends'
      // See PR https://github.com/bvaughn/react-virtualized/pull/942
      return React.createElement(
        'div',
        {
          'aria-label': headerAriaLabel,
          'aria-sort': headerAriaSort,
          className: classNames,
          id: id,
          key: 'Header-Col' + index,
          onClick: headerOnClick,
          onKeyDown: headerOnKeyDown,
          role: 'columnheader',
          style: style,
          tabIndex: headerTabIndex },
        renderedHeader
      );
    }
  }, {
    key: '_createRow',
    value: function _createRow(_ref6) {
      var _this3 = this;

      var index = _ref6.rowIndex,
          isScrolling = _ref6.isScrolling,
          key = _ref6.key,
          parent = _ref6.parent,
          style = _ref6.style;
      var _props3 = this.props,
          children = _props3.children,
          onRowClick = _props3.onRowClick,
          onRowDoubleClick = _props3.onRowDoubleClick,
          onRowRightClick = _props3.onRowRightClick,
          onRowMouseOver = _props3.onRowMouseOver,
          onRowMouseOut = _props3.onRowMouseOut,
          rowClassName = _props3.rowClassName,
          rowGetter = _props3.rowGetter,
          rowRenderer = _props3.rowRenderer,
          rowStyle = _props3.rowStyle;
      var scrollbarWidth = this.state.scrollbarWidth;


      var rowClass = typeof rowClassName === 'function' ? rowClassName({ index: index }) : rowClassName;
      var rowStyleObject = typeof rowStyle === 'function' ? rowStyle({ index: index }) : rowStyle;
      var rowData = rowGetter({ index: index });

      var columns = React.Children.toArray(children).map(function (column, columnIndex) {
        return _this3._createColumn({
          column: column,
          columnIndex: columnIndex,
          isScrolling: isScrolling,
          parent: parent,
          rowData: rowData,
          rowIndex: index,
          scrollbarWidth: scrollbarWidth
        });
      });

      var className = (0, _classnames2.default)('ReactVirtualized__Table__row', rowClass);
      var flattenedStyle = (0, _extends3.default)({}, style, rowStyleObject, {
        height: this._getRowHeight(index),
        overflow: 'hidden',
        paddingRight: scrollbarWidth
      });

      return rowRenderer({
        className: className,
        columns: columns,
        index: index,
        isScrolling: isScrolling,
        key: key,
        onRowClick: onRowClick,
        onRowDoubleClick: onRowDoubleClick,
        onRowRightClick: onRowRightClick,
        onRowMouseOver: onRowMouseOver,
        onRowMouseOut: onRowMouseOut,
        rowData: rowData,
        style: flattenedStyle
      });
    }

    /**
     * Determines the flex-shrink, flex-grow, and width values for a cell (header or column).
     */

  }, {
    key: '_getFlexStyleForColumn',
    value: function _getFlexStyleForColumn(column) {
      var customStyle = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      var flexValue = column.props.flexGrow + ' ' + column.props.flexShrink + ' ' + column.props.width + 'px';

      var style = (0, _extends3.default)({}, customStyle, {
        flex: flexValue,
        msFlex: flexValue,
        WebkitFlex: flexValue
      });

      if (column.props.maxWidth) {
        style.maxWidth = column.props.maxWidth;
      }

      if (column.props.minWidth) {
        style.minWidth = column.props.minWidth;
      }

      return style;
    }
  }, {
    key: '_getHeaderColumns',
    value: function _getHeaderColumns() {
      var _this4 = this;

      var _props4 = this.props,
          children = _props4.children,
          disableHeader = _props4.disableHeader;

      var items = disableHeader ? [] : React.Children.toArray(children);

      return items.map(function (column, index) {
        return _this4._createHeader({ column: column, index: index });
      });
    }
  }, {
    key: '_getRowHeight',
    value: function _getRowHeight(rowIndex) {
      var rowHeight = this.props.rowHeight;


      return typeof rowHeight === 'function' ? rowHeight({ index: rowIndex }) : rowHeight;
    }
  }, {
    key: '_onScroll',
    value: function _onScroll(_ref7) {
      var clientHeight = _ref7.clientHeight,
          scrollHeight = _ref7.scrollHeight,
          scrollTop = _ref7.scrollTop;
      var onScroll = this.props.onScroll;


      onScroll({ clientHeight: clientHeight, scrollHeight: scrollHeight, scrollTop: scrollTop });
    }
  }, {
    key: '_onSectionRendered',
    value: function _onSectionRendered(_ref8) {
      var rowOverscanStartIndex = _ref8.rowOverscanStartIndex,
          rowOverscanStopIndex = _ref8.rowOverscanStopIndex,
          rowStartIndex = _ref8.rowStartIndex,
          rowStopIndex = _ref8.rowStopIndex;
      var onRowsRendered = this.props.onRowsRendered;


      onRowsRendered({
        overscanStartIndex: rowOverscanStartIndex,
        overscanStopIndex: rowOverscanStopIndex,
        startIndex: rowStartIndex,
        stopIndex: rowStopIndex
      });
    }
  }, {
    key: '_setRef',
    value: function _setRef(ref) {
      this.Grid = ref;
    }
  }, {
    key: '_setScrollbarWidth',
    value: function _setScrollbarWidth() {
      if (this.Grid) {
        var _Grid = (0, _reactDom.findDOMNode)(this.Grid);
        var clientWidth = _Grid.clientWidth || 0;
        var offsetWidth = _Grid.offsetWidth || 0;
        var scrollbarWidth = offsetWidth - clientWidth;

        this.setState({ scrollbarWidth: scrollbarWidth });
      }
    }
  }]);
  return Table;
}(React.PureComponent);

Table.defaultProps = {
  disableHeader: false,
  estimatedRowSize: 30,
  headerHeight: 0,
  headerStyle: {},
  noRowsRenderer: function noRowsRenderer() {
    return null;
  },
  onRowsRendered: function onRowsRendered() {
    return null;
  },
  onScroll: function onScroll() {
    return null;
  },
  overscanIndicesGetter: _Grid2.accessibilityOverscanIndicesGetter,
  overscanRowCount: 10,
  rowRenderer: _defaultRowRenderer2.default,
  headerRowRenderer: _defaultHeaderRowRenderer2.default,
  rowStyle: {},
  scrollToAlignment: 'auto',
  scrollToIndex: -1,
  style: {}
};
exports.default = Table;
Table.propTypes = process.env.NODE_ENV !== "production" ? {
  'aria-label': _propTypes2.default.string,

  /**
   * Removes fixed height from the scrollingContainer so that the total height
   * of rows can stretch the window. Intended for use with WindowScroller
   */
  autoHeight: _propTypes2.default.bool,

  /** One or more Columns describing the data displayed in this row */
  children: function children(props) {
    var children = React.Children.toArray(props.children);
    for (var i = 0; i < children.length; i++) {
      var childType = children[i].type;
      if (childType !== _Column2.default && !(childType.prototype instanceof _Column2.default)) {
        return new Error('Table only accepts children of type Column');
      }
    }
  },

  /** Optional CSS class name */
  className: _propTypes2.default.string,

  /** Disable rendering the header at all */
  disableHeader: _propTypes2.default.bool,

  /**
   * Used to estimate the total height of a Table before all of its rows have actually been measured.
   * The estimated total height is adjusted as rows are rendered.
   */
  estimatedRowSize: _propTypes2.default.number.isRequired,

  /** Optional custom CSS class name to attach to inner Grid element. */
  gridClassName: _propTypes2.default.string,

  /** Optional inline style to attach to inner Grid element. */
  gridStyle: _propTypes2.default.object,

  /** Optional CSS class to apply to all column headers */
  headerClassName: _propTypes2.default.string,

  /** Fixed height of header row */
  headerHeight: _propTypes2.default.number.isRequired,

  /**
   * Responsible for rendering a table row given an array of columns:
   * Should implement the following interface: ({
   *   className: string,
   *   columns: any[],
   *   style: any
   * }): PropTypes.node
   */
  headerRowRenderer: _propTypes2.default.func,

  /** Optional custom inline style to attach to table header columns. */
  headerStyle: _propTypes2.default.object,

  /** Fixed/available height for out DOM element */
  height: _propTypes2.default.number.isRequired,

  /** Optional id */
  id: _propTypes2.default.string,

  /** Optional renderer to be used in place of table body rows when rowCount is 0 */
  noRowsRenderer: _propTypes2.default.func,

  /**
   * Optional callback when a column's header is clicked.
   * ({ columnData: any, dataKey: string }): void
   */
  onHeaderClick: _propTypes2.default.func,

  /**
   * Callback invoked when a user clicks on a table row.
   * ({ index: number }): void
   */
  onRowClick: _propTypes2.default.func,

  /**
   * Callback invoked when a user double-clicks on a table row.
   * ({ index: number }): void
   */
  onRowDoubleClick: _propTypes2.default.func,

  /**
   * Callback invoked when the mouse leaves a table row.
   * ({ index: number }): void
   */
  onRowMouseOut: _propTypes2.default.func,

  /**
   * Callback invoked when a user moves the mouse over a table row.
   * ({ index: number }): void
   */
  onRowMouseOver: _propTypes2.default.func,

  /**
   * Callback invoked when a user right-clicks on a table row.
   * ({ index: number }): void
   */
  onRowRightClick: _propTypes2.default.func,

  /**
   * Callback invoked with information about the slice of rows that were just rendered.
   * ({ startIndex, stopIndex }): void
   */
  onRowsRendered: _propTypes2.default.func,

  /**
   * Callback invoked whenever the scroll offset changes within the inner scrollable region.
   * This callback can be used to sync scrolling between lists, tables, or grids.
   * ({ clientHeight, scrollHeight, scrollTop }): void
   */
  onScroll: _propTypes2.default.func.isRequired,

  /** See Grid#overscanIndicesGetter */
  overscanIndicesGetter: _propTypes2.default.func.isRequired,

  /**
   * Number of rows to render above/below the visible bounds of the list.
   * These rows can help for smoother scrolling on touch devices.
   */
  overscanRowCount: _propTypes2.default.number.isRequired,

  /**
   * Optional CSS class to apply to all table rows (including the header row).
   * This property can be a CSS class name (string) or a function that returns a class name.
   * If a function is provided its signature should be: ({ index: number }): string
   */
  rowClassName: _propTypes2.default.oneOfType([_propTypes2.default.string, _propTypes2.default.func]),

  /**
   * Callback responsible for returning a data row given an index.
   * ({ index: number }): any
   */
  rowGetter: _propTypes2.default.func.isRequired,

  /**
   * Either a fixed row height (number) or a function that returns the height of a row given its index.
   * ({ index: number }): number
   */
  rowHeight: _propTypes2.default.oneOfType([_propTypes2.default.number, _propTypes2.default.func]).isRequired,

  /** Number of rows in table. */
  rowCount: _propTypes2.default.number.isRequired,

  /**
   * Responsible for rendering a table row given an array of columns:
   * Should implement the following interface: ({
   *   className: string,
   *   columns: Array,
   *   index: number,
   *   isScrolling: boolean,
   *   onRowClick: ?Function,
   *   onRowDoubleClick: ?Function,
   *   onRowMouseOver: ?Function,
   *   onRowMouseOut: ?Function,
   *   rowData: any,
   *   style: any
   * }): PropTypes.node
   */
  rowRenderer: _propTypes2.default.func,

  /** Optional custom inline style to attach to table rows. */
  rowStyle: _propTypes2.default.oneOfType([_propTypes2.default.object, _propTypes2.default.func]).isRequired,

  /** See Grid#scrollToAlignment */
  scrollToAlignment: _propTypes2.default.oneOf(['auto', 'end', 'start', 'center']).isRequired,

  /** Row index to ensure visible (by forcefully scrolling if necessary) */
  scrollToIndex: _propTypes2.default.number.isRequired,

  /** Vertical offset. */
  scrollTop: _propTypes2.default.number,

  /**
   * Sort function to be called if a sortable header is clicked.
   * Should implement the following interface: ({
   *   defaultSortDirection: 'ASC' | 'DESC',
   *   event: MouseEvent,
   *   sortBy: string,
   *   sortDirection: SortDirection
   * }): void
   */
  sort: _propTypes2.default.func,

  /** Table data is currently sorted by this :dataKey (if it is sorted at all) */
  sortBy: _propTypes2.default.string,

  /** Table data is currently sorted in this direction (if it is sorted at all) */
  sortDirection: _propTypes2.default.oneOf([_SortDirection2.default.ASC, _SortDirection2.default.DESC]),

  /** Optional inline style */
  style: _propTypes2.default.object,

  /** Tab index for focus */
  tabIndex: _propTypes2.default.number,

  /** Width of list */
  width: _propTypes2.default.number.isRequired
} : {};