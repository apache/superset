import Immutable, { List } from 'immutable'
import React, { PropTypes, PureComponent } from 'react'
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  Column,
  Table,
  SortDirection,
  SortIndicator
} from 'react-virtualized';

function formatTableData(data) {
  const formattedData = data.map((row, i) => {
    console.log('i', i)
    const newRow = {
      index: i,
      size: 75,
    };
    for (const k in row) {
      const val = row[k];
      if (typeof(val) === 'string') {
        newRow[k] = val;
      } else {
        newRow[k] = JSON.stringify(val);
      }
    }
    console.log('newRow', newRow)
    return newRow;
  });
  return formattedData;
}

export default class FilterTable extends PureComponent {
  constructor (props, context) {
    super(props, context)
    this.list = List(formatTableData(this.props.data));
    this.state = {
      disableHeader: false,
      headerHeight: 40,
      height: this.props.height,
      hideIndexRow: false,
      overscanRowCount: 10,
      rowHeight: 40,
      rowCount: this.props.data.length,
      scrollToIndex: undefined,
      sortBy: 'index',
      sortDirection: SortDirection.ASC,
      useDynamicRowHeight: false,
      width: this.props.width,
    };

    this._columnKeys = props.columns.map(col => col.name);

    this._getRowHeight = this._getRowHeight.bind(this)
    this._headerRenderer = this._headerRenderer.bind(this)
    this._noRowsRenderer = this._noRowsRenderer.bind(this)
    this._onRowCountChange = this._onRowCountChange.bind(this)
    this._onScrollToRowChange = this._onScrollToRowChange.bind(this)
    this._rowClassName = this._rowClassName.bind(this)
    this._sort = this._sort.bind(this)
  }

  render () {
    const {
      disableHeader,
      headerHeight,
      height,
      hideIndexRow,
      overscanRowCount,
      rowHeight,
      rowCount,
      scrollToIndex,
      sortBy,
      sortDirection,
      useDynamicRowHeight,
      width
    } = this.state

    const { list } = this;
    const sortedList = this._isSortEnabled()
      ? list
        .sortBy(item => item[sortBy])
        .update(list =>
          sortDirection === SortDirection.DESC
            ? list.reverse()
            : list
        )
      : list

    const rowGetter = ({ index }) => this._getDatum(sortedList, index)

    return (
      <Table
        ref='Table'
        disableHeader={disableHeader}
        headerClassName='headerColumn'
        headerHeight={headerHeight}
        height={height}
        noRowsRenderer={this._noRowsRenderer}
        overscanRowCount={overscanRowCount}
        rowClassName={this._rowClassName}
        rowHeight={useDynamicRowHeight ? this._getRowHeight : rowHeight}
        rowGetter={rowGetter}
        rowCount={rowCount}
        scrollToIndex={scrollToIndex}
        sort={this._sort}
        sortBy={sortBy}
        sortDirection={sortDirection}
        width={this._columnKeys.length * 150}
      >
        {this._columnKeys.map((columnKey) => {
          return (
            <Column
              dataKey={columnKey}
              disableSort={false}
              headerRenderer={this._headerRenderer}
              width={150}
              label={columnKey}
              key={columnKey}
            />
          )
        })}
      </Table>
    )
  }

  _getDatum (list, index) {
    return list.get(index % list.size)
  }

  _getRowHeight ({ index }) {
    const { list } = this;

    return this._getDatum(list, index).size
  }

  _headerRenderer ({
    columnData,
    dataKey,
    disableSort,
    label,
    sortBy,
    sortDirection
  }) {
    return (
      <div>
        {label}
        {sortBy === dataKey &&
          <SortIndicator sortDirection={sortDirection} />
        }
      </div>
    )
  }

  _isSortEnabled () {
    const { list } = this;
    const { rowCount } = this.state

    return rowCount <= list.size
  }

  _noRowsRenderer () {
    return (
      <div className='noRows'>
        No rows
      </div>
    )
  }

  _onRowCountChange (event) {
    const rowCount = parseInt(event.target.value, 10) || 0

    this.setState({ rowCount })
  }

  _onScrollToRowChange (event) {
    const { rowCount } = this.state
    let scrollToIndex = Math.min(rowCount - 1, parseInt(event.target.value, 10))

    if (isNaN(scrollToIndex)) {
      scrollToIndex = undefined
    }

    this.setState({ scrollToIndex })
  }

  _rowClassName ({ index }) {
    if (index < 0) {
      return 'headerRow'
    } else {
      return index % 2 === 0 ? 'evenRow' : 'oddRow'
    }
  }

  _sort ({ sortBy, sortDirection }) {
    this.setState({ sortBy, sortDirection })
  }

  _updateUseDynamicRowHeight (value) {
    this.setState({
      useDynamicRowHeight: value
    })
  }
}
