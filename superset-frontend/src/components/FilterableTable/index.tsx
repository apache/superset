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
import React, { useEffect, useRef, useState } from 'react';
import JSONTree from 'react-json-tree';
import {
  AutoSizer,
  Column,
  Grid,
  ScrollSync,
  SortDirection,
  SortDirectionType,
  SortIndicator,
  Table,
} from 'react-virtualized';
import {
  getMultipleTextDimensions,
  t,
  styled,
  useTheme,
} from '@superset-ui/core';
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

const GRID_POSITION_ADJUSTMENT = 4;
const SCROLL_BAR_HEIGHT = 15;
// This regex handles all possible number formats in javascript, including ints, floats,
// exponential notation, NaN, and Infinity.
// See https://stackoverflow.com/a/30987109 for more details
const ONLY_NUMBER_REGEX = /^(NaN|-?((\d*\.\d+|\d+)([Ee][+-]?\d+)?|Infinity))$/;

const StyledFilterableTable = styled.div`
  ${({ theme }) => `
    height: 100%;
    overflow-x: auto;
    margin-top: ${theme.gridUnit * 2}px;
    overflow-y: hidden;

    .ReactVirtualized__Grid__innerScrollContainer {
      border: 1px solid ${theme.colors.grayscale.light2};
    }

    .ReactVirtualized__Table__headerRow {
      font-weight: ${theme.typography.weights.bold};
      display: flex;
      flex-direction: row;
      align-items: center;
      border: 1px solid ${theme.colors.grayscale.light2};
    }

    .ReactVirtualized__Table__row {
      display: flex;
      flex-direction: row;
    }

    .ReactVirtualized__Table__headerTruncatedText,
    .grid-header-cell {
      display: inline-block;
      max-width: 100%;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .ReactVirtualized__Table__headerColumn,
    .ReactVirtualized__Table__rowColumn,
    .grid-cell {
      min-width: 0px;
      border-right: 1px solid ${theme.colors.grayscale.light2};
      align-self: center;
      padding: ${theme.gridUnit * 3}px;
      font-size: ${theme.typography.sizes.s}px;
    }

    .grid-header-cell {
      font-weight: ${theme.typography.weights.bold};
      cursor: pointer;
    }

    .ReactVirtualized__Table__headerColumn:last-of-type,
    .ReactVirtualized__Table__rowColumn:last-of-type {
      border-right: 0px;
    }

    .ReactVirtualized__Table__headerColumn:focus,
    .ReactVirtualized__Table__Grid:focus {
      outline: none;
    }

    .ReactVirtualized__Table__rowColumn {
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ReactVirtualized__Table__sortableHeaderColumn {
      cursor: pointer;
    }

    .ReactVirtualized__Table__sortableHeaderIconContainer {
      display: flex;
      align-items: center;
    }

    .ReactVirtualized__Table__sortableHeaderIcon {
      flex: 0 0 ${theme.gridUnit * 6}px;
      height: 1em;
      width: 1em;
      fill: currentColor;
    }

    .even-row {
      background: ${theme.colors.grayscale.light4};
    }

    .odd-row {
      background: ${theme.colors.grayscale.light5};
    }

    .header-style {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .header-style-disabled {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: ${theme.colors.grayscale.light1};
    }

    .cell-text-for-measuring {
      font-family: ${theme.typography.families.sansSerif};
      font-size: ${theme.typography.sizes.s}px;
    }
  `}
`;

// when more than MAX_COLUMNS_FOR_TABLE are returned, switch from table to grid view
export const MAX_COLUMNS_FOR_TABLE = 50;

type CellDataType = string | number | null;
type Datum = Record<string, CellDataType>;

export interface FilterableTableProps {
  orderedColumnKeys: string[];
  data: Record<string, unknown>[];
  height: number;
  filterText?: string;
  headerHeight?: number;
  overscanColumnCount?: number;
  overscanRowCount?: number;
  rowHeight?: number;
  striped?: boolean;
  expandedColumns?: string[];
}

const FilterableTable = ({
  orderedColumnKeys,
  data,
  height,
  filterText = '',
  headerHeight = 32,
  overscanColumnCount = 10,
  overscanRowCount = 10,
  rowHeight = 32,
  striped = true,
  expandedColumns = [],
}: FilterableTableProps) => {
  const formatTableData = (data: Record<string, unknown>[]): Datum[] =>
    data.map(row => {
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

  const [sortByState, setSortByState] = useState<string | undefined>(undefined);
  const [sortDirectionState, setSortDirectionState] = useState<
    SortDirectionType | undefined
  >(undefined);
  const [fitted, setFitted] = useState(false);
  const [list] = useState<Datum[]>(() => formatTableData(data));
  const [displayedList, setDisplayedList] = useState<Datum[]>(list);

  // columns that have complex type and were expanded into sub columns
  const [complexColumns] = useState<Record<string, boolean>>(
    orderedColumnKeys.reduce(
      (obj, key) => ({
        ...obj,
        [key]: expandedColumns.some(name => name.startsWith(`${key}.`)),
      }),
      {},
    ),
  );

  const theme = useTheme();
  const [jsonTreeTheme, setJsonTreeTheme] = useState<Record<string, string>>();

  const getJsonTreeTheme = () => {
    if (!jsonTreeTheme) {
      setJsonTreeTheme({
        base00: theme.colors.grayscale.dark2,
        base01: theme.colors.grayscale.dark1,
        base02: theme.colors.grayscale.base,
        base03: theme.colors.grayscale.light1,
        base04: theme.colors.grayscale.light2,
        base05: theme.colors.grayscale.light3,
        base06: theme.colors.grayscale.light4,
        base07: theme.colors.grayscale.light5,
        base08: theme.colors.error.base,
        base09: theme.colors.error.light1,
        base0A: theme.colors.error.light2,
        base0B: theme.colors.success.base,
        base0C: theme.colors.primary.light1,
        base0D: theme.colors.primary.base,
        base0E: theme.colors.primary.dark1,
        base0F: theme.colors.error.dark1,
      });
    }
    return jsonTreeTheme;
  };

  const getDatum = (list: Datum[], index: number) => list[index % list.length];

  const getWidthsForColumns = () => {
    const PADDING = 50; // accounts for cell padding and width of sorting icon
    const widthsByColumnKey = {};
    const cellContent = ([] as string[]).concat(
      ...orderedColumnKeys.map(key => {
        const cellContentList = list.map((data: Datum) =>
          getCellContent({ cellData: data[key], columnKey: key }),
        );
        cellContentList.push(key);
        return cellContentList;
      }),
    );

    const colWidths = getMultipleTextDimensions({
      className: 'cell-text-for-measuring',
      texts: cellContent,
    }).map(dimension => dimension.width);

    orderedColumnKeys.forEach((key, index) => {
      // we can't use Math.max(...colWidths.slice(...)) here since the number
      // of elements might be bigger than the number of allowed arguments in a
      // JavaScript function
      widthsByColumnKey[key] =
        colWidths
          .slice(index * (list.length + 1), (index + 1) * (list.length + 1))
          .reduce((a, b) => Math.max(a, b)) + PADDING;
    });

    return widthsByColumnKey;
  };

  const getCellContent = ({
    cellData,
    columnKey,
  }: {
    cellData: CellDataType;
    columnKey: string;
  }) => {
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
    return complexColumns[columnKey] ? truncated : content;
  };

  const [widthsForColumnsByKey] = useState<Record<string, number>>(() =>
    getWidthsForColumns(),
  );

  const totalTableWidth = useRef(
    orderedColumnKeys
      .map(key => widthsForColumnsByKey[key])
      .reduce((curr, next) => curr + next),
  );
  const totalTableHeight = useRef(height);
  const container = useRef<HTMLDivElement>(null);

  const fitTableToWidthIfNeeded = () => {
    const containerWidth = container.current?.clientWidth ?? 0;
    if (totalTableWidth.current < containerWidth) {
      // fit table width if content doesn't fill the width of the container
      totalTableWidth.current = containerWidth;
    }
    setFitted(true);
  };

  useEffect(() => {
    fitTableToWidthIfNeeded();
  }, []);

  const hasMatch = (text: string, row: Datum) => {
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
  };

  const rowClassName = ({ index }: { index: number }) => {
    let className = '';
    if (striped) {
      className = index % 2 === 0 ? 'even-row' : 'odd-row';
    }
    return className;
  };

  const sort = ({
    sortBy,
    sortDirection,
  }: {
    sortBy: string;
    sortDirection: SortDirectionType;
  }) => {
    const shouldClearSort =
      sortDirectionState === SortDirection.DESC && sortByState === sortBy;

    if (shouldClearSort) {
      setSortByState(undefined);
      setSortDirectionState(undefined);
      setDisplayedList([...list]);
    } else {
      setSortByState(sortBy);
      setSortDirectionState(sortDirection);
      setDisplayedList(
        [...list].sort(
          sortResults(sortBy, sortDirection === SortDirection.DESC),
        ),
      );
    }
  };

  const addJsonModal = (
    node: React.ReactNode,
    jsonObject: Record<string, unknown> | unknown[],
    jsonString: CellDataType,
  ) => (
    <ModalTrigger
      modalBody={<JSONTree data={jsonObject} theme={getJsonTreeTheme()} />}
      modalFooter={
        <Button>
          <CopyToClipboard shouldShowText={false} text={jsonString} />
        </Button>
      }
      modalTitle={t('Cell content')}
      triggerNode={node}
    />
  );

  // Parse any numbers from strings so they'll sort correctly
  const parseNumberFromString = (value: string | number | null) => {
    if (typeof value === 'string') {
      if (ONLY_NUMBER_REGEX.test(value)) {
        return parseFloat(value);
      }
    }

    return value;
  };

  const sortResults =
    (sortBy: string, descending: boolean) => (a: Datum, b: Datum) => {
      const aValue = parseNumberFromString(a[sortBy]);
      const bValue = parseNumberFromString(b[sortBy]);

      // equal items sort equally
      if (aValue === bValue) {
        return 0;
      }

      // nulls sort after anything else
      if (aValue === null) {
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

  const sortGrid = (label: string) => {
    sort({
      sortBy: label,
      sortDirection:
        sortDirectionState === SortDirection.DESC || sortByState !== label
          ? SortDirection.ASC
          : SortDirection.DESC,
    });
  };

  const renderTableHeader = ({
    dataKey,
    label,
    sortBy,
    sortDirection,
  }: {
    dataKey: string;
    label: string;
    sortBy: string;
    sortDirection: SortDirectionType;
  }) => {
    const className =
      expandedColumns.indexOf(label) > -1
        ? 'header-style-disabled'
        : 'header-style';

    return (
      <div className={className}>
        {label}
        {sortBy === dataKey && <SortIndicator sortDirection={sortDirection} />}
      </div>
    );
  };

  const renderGridCellHeader = ({
    columnIndex,
    key,
    style,
  }: {
    columnIndex: number;
    key: string;
    style: React.CSSProperties;
  }) => {
    const label = orderedColumnKeys[columnIndex];
    const className =
      expandedColumns.indexOf(label) > -1
        ? 'header-style-disabled'
        : 'header-style';
    return (
      <div
        key={key}
        style={{
          ...style,
          top:
            typeof style.top === 'number'
              ? style.top - GRID_POSITION_ADJUSTMENT
              : style.top,
        }}
        className={`${className} grid-cell grid-header-cell`}
        role="columnheader"
        tabIndex={columnIndex}
        onClick={() => sortGrid(label)}
      >
        {label}
        {sortByState === label && (
          <SortIndicator sortDirection={sortDirectionState} />
        )}
      </div>
    );
  };

  const renderGridCell = ({
    columnIndex,
    key,
    rowIndex,
    style,
  }: {
    columnIndex: number;
    key: string;
    rowIndex: number;
    style: React.CSSProperties;
  }) => {
    const columnKey = orderedColumnKeys[columnIndex];
    const cellData = displayedList[rowIndex][columnKey];
    const cellText = getCellContent({ cellData, columnKey });
    const content =
      cellData === null ? <i className="text-muted">{cellText}</i> : cellText;
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
        className={`grid-cell ${rowClassName({ index: rowIndex })}`}
      >
        <div css={{ width: 'inherit' }}>{content}</div>
      </div>
    );

    const jsonObject = safeJsonObjectParse(cellData);
    if (jsonObject) {
      return addJsonModal(cellNode, jsonObject, cellData);
    }
    return cellNode;
  };

  const renderGrid = () => {
    totalTableHeight.current = height;
    if (
      container.current &&
      totalTableWidth.current > container.current.clientWidth
    ) {
      // exclude the height of the horizontal scroll bar from the height of the table
      // and the height of the table container if the content overflows
      totalTableHeight.current -= SCROLL_BAR_HEIGHT;
    }

    const getColumnWidth = ({ index }: { index: number }) =>
      widthsForColumnsByKey[orderedColumnKeys[index]];

    // fix height of filterable table
    return (
      <StyledFilterableTable data-test="grid-container">
        <ScrollSync>
          {({ onScroll, scrollLeft }) => (
            <>
              <AutoSizer disableHeight>
                {({ width }) => (
                  <div>
                    <Grid
                      cellRenderer={renderGridCellHeader}
                      columnCount={orderedColumnKeys.length}
                      columnWidth={getColumnWidth}
                      height={rowHeight}
                      rowCount={1}
                      rowHeight={rowHeight}
                      scrollLeft={scrollLeft}
                      width={width}
                      style={{ overflow: 'hidden' }}
                    />
                    <Grid
                      cellRenderer={renderGridCell}
                      columnCount={orderedColumnKeys.length}
                      columnWidth={getColumnWidth}
                      height={totalTableHeight.current - rowHeight}
                      onScroll={onScroll}
                      overscanColumnCount={overscanColumnCount}
                      overscanRowCount={overscanRowCount}
                      rowCount={list.length}
                      rowHeight={rowHeight}
                      width={width}
                    />
                  </div>
                )}
              </AutoSizer>
            </>
          )}
        </ScrollSync>
      </StyledFilterableTable>
    );
  };

  const renderTableCell = ({
    cellData,
    columnKey,
  }: {
    cellData: CellDataType;
    columnKey: string;
  }) => {
    const cellNode = getCellContent({ cellData, columnKey });
    const content =
      cellData === null ? <i className="text-muted">{cellNode}</i> : cellNode;
    const jsonObject = safeJsonObjectParse(cellData);
    if (jsonObject) {
      return addJsonModal(cellNode, jsonObject, cellData);
    }
    return content;
  };

  const renderTable = () => {
    let sortedAndFilteredList = displayedList;
    // filter list
    if (filterText) {
      sortedAndFilteredList = sortedAndFilteredList.filter((row: Datum) =>
        hasMatch(filterText, row),
      );
    }

    totalTableHeight.current = height;
    if (
      container.current &&
      totalTableWidth.current > container.current.clientWidth
    ) {
      // exclude the height of the horizontal scroll bar from the height of the table
      // and the height of the table container if the content overflows
      totalTableHeight.current -= SCROLL_BAR_HEIGHT;
    }

    const rowGetter = ({ index }: { index: number }) =>
      getDatum(sortedAndFilteredList, index);
    return (
      <StyledFilterableTable
        className="filterable-table-container"
        data-test="table-container"
        ref={container}
      >
        {fitted && (
          <Table
            headerHeight={headerHeight}
            height={totalTableHeight.current}
            overscanRowCount={overscanRowCount}
            rowClassName={rowClassName}
            rowHeight={rowHeight}
            rowGetter={rowGetter}
            rowCount={sortedAndFilteredList.length}
            sort={sort}
            sortBy={sortByState}
            sortDirection={sortDirectionState}
            width={totalTableWidth.current}
          >
            {orderedColumnKeys.map(columnKey => (
              <Column
                cellRenderer={({ cellData }) =>
                  renderTableCell({ cellData, columnKey })
                }
                dataKey={columnKey}
                disableSort={false}
                headerRenderer={renderTableHeader}
                width={widthsForColumnsByKey[columnKey]}
                label={columnKey}
                key={columnKey}
              />
            ))}
          </Table>
        )}
      </StyledFilterableTable>
    );
  };

  if (orderedColumnKeys.length > MAX_COLUMNS_FOR_TABLE) {
    return renderGrid();
  }
  return renderTable();
};

export default FilterableTable;
