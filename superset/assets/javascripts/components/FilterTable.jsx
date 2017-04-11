import { List } from 'immutable';
import React, { PropTypes, PureComponent } from 'react';
import {
  Column,
  Table,
  SortDirection,
  SortIndicator,
} from 'react-virtualized';
import { getTextWidth } from '../modules/utils';

require('../../stylesheets/react-virtualized/table-styles.css');

const propTypes = {
  columns: PropTypes.array.isRequired,
  data: PropTypes.array.isRequired,
  height: PropTypes.number.isRequired,
  filterText: PropTypes.string,
  headerHeight: PropTypes.number,
  overscanRowCount: PropTypes.number,
  rowHeight: PropTypes.number,
  striped: PropTypes.boolean,
};

const defaultProps = {
  filterText: '',
  headerHeight: 32,
  overscanRowCount: 10,
  rowHeight: 32,
  striped: true,
};

export default class FilterTable extends PureComponent {
  constructor(props) {
    super(props);
    this.list = List(this.formatTableData(props.data));
    this.columnKeys = props.columns.map(col => col.name);
    this.headerRenderer = this.headerRenderer.bind(this);
    this.rowClassName = this.rowClassName.bind(this);
    this.sort = this.sort.bind(this);

    this.widthsForColumnsByKey = this.getWidthsForColumns();
    this.totalTableWidth = this.columnKeys
      .map(key => this.widthsForColumnsByKey[key])
      .reduce((curr, next) => curr + next);

    this.state = {
      height: props.height - 2, // minus 2 to account for top/bottom borders
      sortBy: this.columnKeys[0],
      sortDirection: SortDirection.ASC,
    };
  }

  hasMatch(text, row) {
    const values = [];
    for (const key in row) {
      if (row.hasOwnProperty(key)) {
        values.push(row[key].toLowerCase());
      }
    }
    return values.some(v => v.includes(text.toLowerCase()));
  }

  formatTableData(data) {
    const formattedData = data.map((row) => {
      const newRow = {};
      for (const k in row) {
        const val = row[k];
        if (typeof(val) === 'string') {
          newRow[k] = val;
        } else {
          newRow[k] = JSON.stringify(val);
        }
      }
      return newRow;
    });
    return formattedData;
  }

  getWidthsForColumns() {
    const PADDING = 40; // accounts for cell padding and width of sorting icon
    const widthsByColumnKey = {};
    this.columnKeys.forEach((key) => {
      const colWidths = this.list.toArray().map(d => getTextWidth(d[key]) + PADDING);
      // push width of column key to array as well
      colWidths.push(getTextWidth(key) + PADDING);
      // set max width as value for key
      widthsByColumnKey[key] = Math.max(...colWidths);
    });
    return widthsByColumnKey;
  }

  render() {
    const { height, sortBy, sortDirection } = this.state;
    const { filterText, overscanRowCount, rowHeight, headerHeight } = this.props;

    let sortedAndFilteredList = this.list;
    // filter list
    if (filterText) {
      sortedAndFilteredList = this.list.filter(row => this.hasMatch(filterText, row));
    }
    // sort list
    sortedAndFilteredList = sortedAndFilteredList
      .sortBy(item => item[sortBy])
      .update(list => sortDirection === SortDirection.DESC ? list.reverse() : list);

    const rowGetter = ({ index }) => this.getDatum(sortedAndFilteredList, index);

    return (
      <Table
        ref="Table"
        headerHeight={headerHeight}
        height={height}
        overscanRowCount={overscanRowCount}
        rowClassName={this.rowClassName}
        rowHeight={rowHeight}
        rowGetter={rowGetter}
        rowCount={sortedAndFilteredList.size}
        sort={this.sort}
        sortBy={sortBy}
        sortDirection={sortDirection}
        width={this.totalTableWidth}
      >
        {this.columnKeys.map((columnKey) => (
          <Column
            dataKey={columnKey}
            disableSort={false}
            headerRenderer={this.headerRenderer}
            width={this.widthsForColumnsByKey[columnKey]}
            label={columnKey}
            key={columnKey}
          />
        ))}
      </Table>
    );
  }

  getDatum(list, index) {
    return list.get(index % list.size);
  }

  headerRenderer({ dataKey, label, sortBy, sortDirection }) {
    return (
      <div>
        {label}
        {sortBy === dataKey &&
          <SortIndicator sortDirection={sortDirection} />
        }
      </div>
    );
  }

  rowClassName({ index }) {
    return index % 2 === 0 ? 'even-row' : 'odd-row';
  }

  sort({ sortBy, sortDirection }) {
    this.setState({ sortBy, sortDirection });
  }
}

FilterTable.propTypes = propTypes;
FilterTable.defaultProps = defaultProps;
