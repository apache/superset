/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import JSONbig from 'json-bigint';
import React, { PureComponent } from 'react';
import JSONTree from 'react-json-tree';
import {
  Column,
  Grid,
  ScrollSync,
  SortDirection,
  SortDirectionType,
  SortIndicator,
  Table,
} from 'react-virtualized';
import { getMultipleTextDimensions, t, styled } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import Button from '../Button';
import CopyToClipboard from '../CopyToClipboard';
import ModalTrigger from '../ModalTrigger';

function safeJsonObjectParse(
  data: unknown,
): null | unknown[] | Record<string, unknown> {
  // First perform a cheap proxy to avoid calling JSON.parse on data that is clearly not a
  // JSON object or array
  if (
    typeof data !== 'string' ||
    ['{', '['].indexOf(data.substring(0, 1)) === -1
  ) {
    return null;
  }

  // We know `data` is a string starting with '{' or '[', so try to parse it as a valid object
  try {
    const jsonData = JSON.parse(data);
    if (jsonData && typeof jsonData === 'object') {
      return jsonData;
    }
    return null;
  } catch (_) {
    return null;
  }
}

const SCROLL_BAR_HEIGHT = 15;
const GRID_POSITION_ADJUSTMENT = 4;
const JSON_TREE_THEME = {
  scheme: 'monokai',
  author: 'wimer hazenberg (http://www.monokai.nl)',
  base00: '#272822',
  base01: '#383830',
  base02: '#49483e',
  base03: '#75715e',
  base04: '#a59f85',
  base05: '#f8f8f2',
  base06: '#f5f4f1',
  base07: '#f9f8f5',
  base08: '#f92672',
  base09: '#fd971f',
  base0A: '#f4bf75',
  base0B: '#a6e22e',
  base0C: '#a1efe4',
  base0D: '#66d9ef',
  base0E: '#ae81ff',
  base0F: '#cc6633',
};

const StyledFilterableTable = styled.div`
  height: 100%;
  overflow-x: auto;
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  overflow-y: hidden;
`;

// when more than MAX_COLUMNS_FOR_TABLE are returned, switch from table to grid view
export const MAX_COLUMNS_FOR_TABLE = 50;

type CellDataType = string | number | null;
type Datum = Record<string, CellDataType>;

interface FilterableTableProps {
  orderedColumnKeys: string[];
  data: Record<string, unknown>[];
  height: number;
  filterText: string;
  headerHeight: number;
  overscanColumnCount: number;
  overscanRowCount: number;
  rowHeight: number;
  striped: boolean;
  expandedColumns: string[];
}

interface FilterableTableState {
  sortBy?: string;
  sortDirection: SortDirectionType;
  fitted: boolean;
}

export default class FilterableTable extends PureComponent<
  FilterableTableProps,
  FilterableTableState
> {
  static defaultProps = {
    filterText: '',
    headerHeight: 32,
    overscanColumnCount: 10,
    overscanRowCount: 10,
    rowHeight: 32,
    striped: true,
    expandedColumns: [],
  };

  list: Datum[];

  complexColumns: Record<string, boolean>;

  widthsForColumnsByKey: Record<string, number>;

  totalTableWidth: number;

  totalTableHeight: number;

  container: React.RefObject<HTMLDivElement>;

  constructor(props: FilterableTableProps) {
    super(props);
    this.list = this.formatTableData(props.data);
    this.addJsonModal = this.addJsonModal.bind(this);
    this.getCellContent = this.getCellContent.bind(this);
    this.renderGridCell = this.renderGridCell.bind(this);
    this.renderGridCellHeader = this.renderGridCellHeader.bind(this);
    this.renderGrid = this.renderGrid.bind(this);
    this.renderTableCell = this.renderTableCell.bind(this);
    this.renderTableHeader = this.renderTableHeader.bind(this);
    this.sortResults = this.sortResults.bind(this);
    this.renderTable = this.renderTable.bind(this);
    this.rowClassName = this.rowClassName.bind(this);
    this.sort = this.sort.bind(this);

    // columns that have complex type and were expanded into sub columns
    this.complexColumns = props.orderedColumnKeys.reduce(
      (obj, key) => ({
        ...obj,
        [key]: props.expandedColumns.some(name => name.startsWith(`${key}.`)),
      }),
      {},
    );

    this.widthsForColumnsByKey = this.getWidthsForColumns();
    this.totalTableWidth = props.orderedColumnKeys
      .map(key => this.widthsForColumnsByKey[key])
      .reduce((curr, next) => curr + next);
    this.totalTableHeight = props.height;

    this.state = {
      sortDirection: SortDirection.ASC,
      fitted: false,
    };

    this.container = React.createRef();
  }

  componentDidMount() {
    this.fitTableToWidthIfNeeded();
  }

  getDatum(list: Datum[], index: number) {
    return list[index % list.length];
  }

  getWidthsForColumns() {
    const PADDING = 40; // accounts for cell padding and width of sorting icon
    const widthsByColumnKey = {};
    const cellContent = ([] as string[]).concat(
      ...this.props.orderedColumnKeys.map(key => {
        const cellContentList = this.list.map((data: Datum) =>
          this.getCellContent({ cellData: data[key], columnKey: key }),
        );
        cellContentList.push(key);
        return cellContentList;
      }),
    );

    const colWidths = getMultipleTextDimensions({
      className: 'cell-text-for-measuring',
      texts: cellContent,
    }).map(dimension => dimension.width);

    this.props.orderedColumnKeys.forEach((key, index) => {
      // we can't use Math.max(...colWidths.slice(...)) here since the number
      // of elements might be bigger than the number of allowed arguments in a
      // Javascript function
      widthsByColumnKey[key] =
        colWidths
          .slice(
            index * (this.list.length + 1),
            (index + 1) * (this.list.length + 1),
          )
          .reduce((a, b) => Math.max(a, b)) + PADDING;
    });

    return widthsByColumnKey;
  }

  getCellContent({
    cellData,
    columnKey,
  }: {
    cellData: CellDataType;
    columnKey: string;
  }) {
    if (cellData === null) {
      return 'NULL';
    }
    const content = String(cellData);
    const firstCharacter = content.substring(0, 1);
    let truncated;
    if (firstCharacter === '[') {
      truncated = '[…]';
    } else if (firstCharacter === '{') {
      truncated = '{…}';
    } else {
      truncated = '';
    }
    return this.complexColumns[columnKey] ? truncated : content;
  }

  formatTableData(data: Record<string, unknown>[]): Datum[] {
    return data.map(row => {
      const newRow = {};
      Object.entries(row).forEach(([key, val]) => {
        if (['string', 'number'].indexOf(typeof val) >= 0) {
          newRow[key] = val;
        } else {
          newRow[key] = val === null ? null : JSONbig.stringify(val);
        }
      });
      return newRow;
    });
  }

  hasMatch(text: string, row: Datum) {
    const values: string[] = [];
    Object.keys(row).forEach(key => {
      if (row.hasOwnProperty(key)) {
        const cellValue = row[key];
        if (typeof cellValue === 'string') {
          values.push(cellValue.toLowerCase());
        } else if (
          cellValue !== null &&
          typeof cellValue.toString === 'function'
        ) {
          values.push(cellValue.toString());
        }
      }
    });
    const lowerCaseText = text.toLowerCase();
    return values.some(v => v.includes(lowerCaseText));
  }

  rowClassName({ index }: { index: number }) {
    let className = '';
    if (this.props.striped) {
      className = index % 2 === 0 ? 'even-row' : 'odd-row';
    }
    return className;
  }

  sort({
    sortBy,
    sortDirection,
  }: {
    sortBy: string;
    sortDirection: SortDirectionType;
  }) {
    this.setState({ sortBy, sortDirection });
  }

  fitTableToWidthIfNeeded() {
    const containerWidth = this.container.current?.clientWidth ?? 0;
    if (this.totalTableWidth < containerWidth) {
      // fit table width if content doesn't fill the width of the container
      this.totalTableWidth = containerWidth;
    }
    this.setState({ fitted: true });
  }

  addJsonModal(
    node: React.ReactNode,
    jsonObject: Record<string, unknown> | unknown[],
    jsonString: CellDataType,
  ) {
    return (
      <ModalTrigger
        modalBody={<JSONTree data={jsonObject} theme={JSON_TREE_THEME} />}
        modalFooter={
          <Button>
            <CopyToClipboard shouldShowText={false} text={jsonString} />
          </Button>
        }
        modalTitle={t('Cell content')}
        triggerNode={node}
      />
    );
  }

  sortResults(sortBy: string, descending: boolean) {
    return (a: Datum, b: Datum) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      if (aValue === bValue) {
        // equal items sort equally
        return 0;
      }
      if (aValue === null) {
        // nulls sort after anything else
        return 1;
      }
      if (bValue === null) {
        return -1;
      }
      if (descending) {
        return aValue < bValue ? 1 : -1;
      }
      return aValue < bValue ? -1 : 1;
    };
  }

  renderTableHeader({
    dataKey,
    label,
    sortBy,
    sortDirection,
  }: {
    dataKey: string;
    label: string;
    sortBy: string;
    sortDirection: SortDirectionType;
  }) {
    const className =
      this.props.expandedColumns.indexOf(label) > -1
        ? 'header-style-disabled'
        : 'header-style';
    return (
      <Tooltip id="header-tooltip" title={label}>
        <div className={className}>
          {label}
          {sortBy === dataKey && (
            <SortIndicator sortDirection={sortDirection} />
          )}
        </div>
      </Tooltip>
    );
  }

  renderGridCellHeader({
    columnIndex,
    key,
    style,
  }: {
    columnIndex: number;
    key: string;
    style: React.CSSProperties;
  }) {
    const label = this.props.orderedColumnKeys[columnIndex];
    const className =
      this.props.expandedColumns.indexOf(label) > -1
        ? 'header-style-disabled'
        : 'header-style';
    return (
      <Tooltip key={key} id="header-tooltip" title={label}>
        <div
          style={{
            ...style,
            top:
              typeof style.top === 'number'
                ? style.top - GRID_POSITION_ADJUSTMENT
                : style.top,
          }}
          className={`${className} grid-cell grid-header-cell`}
        >
          <div>{label}</div>
        </div>
      </Tooltip>
    );
  }

  renderGridCell({
    columnIndex,
    key,
    rowIndex,
    style,
  }: {
    columnIndex: number;
    key: string;
    rowIndex: number;
    style: React.CSSProperties;
  }) {
    const columnKey = this.props.orderedColumnKeys[columnIndex];
    const cellData = this.list[rowIndex][columnKey];
    const content =
      cellData === null ? (
        <i className="text-muted">
          {this.getCellContent({ cellData, columnKey })}
        </i>
      ) : (
        this.getCellContent({ cellData, columnKey })
      );
    const cellNode = (
      <div
        key={key}
        style={{
          ...style,
          top:
            typeof style.top === 'number'
              ? style.top - GRID_POSITION_ADJUSTMENT
              : style.top,
        }}
        className={`grid-cell ${this.rowClassName({ index: rowIndex })}`}
      >
        <div css={{ width: 'inherit' }}>{content}</div>
      </div>
    );

    const jsonObject = safeJsonObjectParse(cellData);
    if (jsonObject) {
      return this.addJsonModal(cellNode, jsonObject, cellData);
    }
    return cellNode;
  }

  renderGrid() {
    const {
      orderedColumnKeys,
      overscanColumnCount,
      overscanRowCount,
      rowHeight,
    } = this.props;

    let { height } = this.props;
    let totalTableHeight = height;
    if (
      this.container.current &&
      this.totalTableWidth > this.container.current.clientWidth
    ) {
      // exclude the height of the horizontal scroll bar from the height of the table
      // and the height of the table container if the content overflows
      height -= SCROLL_BAR_HEIGHT;
      totalTableHeight -= SCROLL_BAR_HEIGHT;
    }

    const getColumnWidth = ({ index }: { index: number }) =>
      this.widthsForColumnsByKey[orderedColumnKeys[index]];

    // fix height of filterable table
    return (
      <StyledFilterableTable>
        <ScrollSync>
          {({ onScroll, scrollTop }) => (
            <div
              className="filterable-table-container Table"
              data-test="filterable-table-container"
              ref={this.container}
            >
              <div className="LeftColumn">
                <Grid
                  cellRenderer={this.renderGridCellHeader}
                  columnCount={orderedColumnKeys.length}
                  columnWidth={getColumnWidth}
                  height={rowHeight}
                  rowCount={1}
                  rowHeight={rowHeight}
                  scrollTop={scrollTop}
                  width={this.totalTableWidth}
                />
              </div>
              <div className="RightColumn">
                <Grid
                  cellRenderer={this.renderGridCell}
                  columnCount={orderedColumnKeys.length}
                  columnWidth={getColumnWidth}
                  height={totalTableHeight - rowHeight}
                  onScroll={onScroll}
                  overscanColumnCount={overscanColumnCount}
                  overscanRowCount={overscanRowCount}
                  rowCount={this.list.length}
                  rowHeight={rowHeight}
                  width={this.totalTableWidth}
                />
              </div>
            </div>
          )}
        </ScrollSync>
      </StyledFilterableTable>
    );
  }

  renderTableCell({
    cellData,
    columnKey,
  }: {
    cellData: CellDataType;
    columnKey: string;
  }) {
    const cellNode = this.getCellContent({ cellData, columnKey });
    const jsonObject = safeJsonObjectParse(cellData);
    if (jsonObject) {
      return this.addJsonModal(cellNode, jsonObject, cellData);
    }
    return cellNode;
  }

  renderTable() {
    const { sortBy, sortDirection } = this.state;
    const {
      filterText,
      headerHeight,
      orderedColumnKeys,
      overscanRowCount,
      rowHeight,
    } = this.props;

    let sortedAndFilteredList = this.list;
    // filter list
    if (filterText) {
      sortedAndFilteredList = this.list.filter((row: Datum) =>
        this.hasMatch(filterText, row),
      );
    }
    // sort list
    if (sortBy) {
      sortedAndFilteredList = sortedAndFilteredList.sort(
        this.sortResults(sortBy, sortDirection === SortDirection.DESC),
      );
    }

    let { height } = this.props;
    let totalTableHeight = height;
    if (
      this.container.current &&
      this.totalTableWidth > this.container.current.clientWidth
    ) {
      // exclude the height of the horizontal scroll bar from the height of the table
      // and the height of the table container if the content overflows
      height -= SCROLL_BAR_HEIGHT;
      totalTableHeight -= SCROLL_BAR_HEIGHT;
    }

    const rowGetter = ({ index }: { index: number }) =>
      this.getDatum(sortedAndFilteredList, index);
    return (
      <StyledFilterableTable
        className="filterable-table-container"
        ref={this.container}
      >
        {this.state.fitted && (
          <Table
            ref="Table"
            headerHeight={headerHeight}
            height={totalTableHeight}
            overscanRowCount={overscanRowCount}
            rowClassName={this.rowClassName}
            rowHeight={rowHeight}
            rowGetter={rowGetter}
            rowCount={sortedAndFilteredList.length}
            sort={this.sort}
            sortBy={sortBy}
            sortDirection={sortDirection}
            width={this.totalTableWidth}
          >
            {orderedColumnKeys.map(columnKey => (
              <Column
                cellRenderer={({ cellData }) =>
                  this.renderTableCell({ cellData, columnKey })
                }
                dataKey={columnKey}
                disableSort={false}
                headerRenderer={this.renderTableHeader}
                width={this.widthsForColumnsByKey[columnKey]}
                label={columnKey}
                key={columnKey}
              />
            ))}
          </Table>
        )}
      </StyledFilterableTable>
    );
  }

  render() {
    if (this.props.orderedColumnKeys.length > MAX_COLUMNS_FOR_TABLE) {
      return this.renderGrid();
    }
    return this.renderTable();
  }
}
