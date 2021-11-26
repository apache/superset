/*
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

import React from 'react';
import DataTable from '@airbnb/lunar/lib/components/DataTable';
import Text from '@airbnb/lunar/lib/components/Text';
import Input from '@airbnb/lunar/lib/components/Input';
import withStyles, {
  WithStylesProps,
} from '@airbnb/lunar/lib/composers/withStyles';
import {
  Renderers,
  ParentRow,
  ColumnMetadata,
  GenericRow,
} from '@airbnb/lunar/lib/components/DataTable/types';
import { createSelector } from 'reselect';
import { NumberFormatter, TimeFormatter } from '@superset-ui/core';
import getRenderer, { ColumnType, Cell } from './getRenderer';

type Props = {
  data: ParentRow[];
  height: number;
  width: number;
  alignPositiveNegative?: boolean;
  colorPositiveNegative?: boolean;
  columns: ColumnType[];
  filters?: {
    [key: string]: any[];
  };
  includeSearch?: boolean;
  onAddFilter?: (key: string, value: number[]) => void;
  onRemoveFilter?: (key: string, value: number[]) => void;
  tableFilter: boolean;
};

const NOOP = () => {};

const defaultProps = {
  alignPositiveNegative: false,
  colorPositiveNegative: false,
  filters: {},
  includeSearch: false,
  onAddFilter: NOOP,
  onRemoveFilter: NOOP,
};

const SEARCH_BAR_HEIGHT = 40;

const CHAR_WIDTH = 10;

const CELL_PADDING = 32;

const MAX_COLUMN_WIDTH = 300;

const htmlTagRegex = /(<([^>]+)>)/gi;

export type TableProps = Props & Readonly<typeof defaultProps>;

type InternalTableProps = TableProps & WithStylesProps;

type TableState = {
  selectedCells: Set<string>;
  searchKeyword: string;
  filteredRows: ParentRow[];
  filters: {
    [key: string]: (string | number)[];
  };
};

function getCellHash(cell: Cell) {
  return `${cell.key}#${cell.value}`;
}

function getText(
  value: unknown,
  format: TimeFormatter | NumberFormatter | undefined,
) {
  if (format) {
    return format.format(value as any);
  }
  if (typeof value === 'string') {
    return value.replace(htmlTagRegex, '');
  }

  return String(value);
}

type columnWidthMetaDataType = {
  [key: string]: {
    maxWidth: number;
    width: number;
  };
};

class TableVis extends React.PureComponent<InternalTableProps, TableState> {
  columnWidthSelector = createSelector(
    (data: { rows: ParentRow[]; columns: ColumnType[] }) => data,
    data => {
      const { rows, columns } = data;
      const keys = rows && rows.length > 0 ? Object.keys(rows[0].data) : [];
      let totalWidth = 0;
      const columnWidthMetaData: columnWidthMetaDataType = {};
      const columnsMap: {
        [key: string]: ColumnType;
      } = {};

      columns.forEach(column => {
        columnsMap[column.key] = column;
      });

      keys.forEach(key => {
        const column = columnsMap[key];
        const format = column?.format;
        const maxLength = Math.max(
          ...rows.map(d => getText(d.data[key], format).length),
          key.length,
        );
        const stringWidth = maxLength * CHAR_WIDTH + CELL_PADDING;
        columnWidthMetaData[key] = {
          maxWidth: MAX_COLUMN_WIDTH,
          width: stringWidth,
        };
        totalWidth += Math.min(stringWidth, MAX_COLUMN_WIDTH);
      });

      return {
        columnWidthMetaData,
        totalWidth,
      };
    },
  );

  static defaultProps = defaultProps;

  constructor(props: InternalTableProps) {
    super(props);
    this.state = {
      filteredRows: [],
      // eslint-disable-next-line react/no-unused-state
      filters: props.filters,
      searchKeyword: '',
      selectedCells: new Set(),
    };
  }

  static getDerivedStateFromProps: React.GetDerivedStateFromProps<
    InternalTableProps,
    TableState
  > = (props: InternalTableProps, state: TableState) => {
    const { filters } = props;
    const { selectedCells, filters: prevFilters } = state;
    if (prevFilters !== filters) {
      const newSelectedCells = new Set(Array.from(selectedCells));
      Object.keys(filters).forEach(key => {
        filters[key].forEach(value => {
          newSelectedCells.add(
            getCellHash({
              key,
              value,
            }),
          );
        });
      });

      return {
        ...state,
        filters,
        selectedCells: newSelectedCells,
      };
    }

    return state;
  };

  handleCellSelected = (cell: Cell) => () => {
    const { selectedCells } = this.state;
    const { tableFilter, onRemoveFilter, onAddFilter } = this.props;

    if (!tableFilter) {
      return;
    }
    const newSelectedCells = new Set(Array.from(selectedCells));
    const cellHash = getCellHash(cell);
    if (newSelectedCells.has(cellHash)) {
      newSelectedCells.delete(cellHash);
      onRemoveFilter(cell.key, [cell.value as number]);
    } else {
      newSelectedCells.add(cellHash);
      onAddFilter(cell.key, [cell.value as number]);
    }
    this.setState({
      selectedCells: newSelectedCells,
    });
  };

  isSelected = (cell: Cell) => {
    const { selectedCells } = this.state;

    return selectedCells.has(getCellHash(cell));
  };

  handleSearch = (value: string) => {
    const { searchKeyword } = this.state;
    const { data } = this.props;
    if (searchKeyword !== value) {
      const filteredRows = data.filter(row => {
        const content = Object.keys(row.data)
          .map(key => row.data[key])
          .join('|')
          .toLowerCase();

        return content.includes(value.toLowerCase());
      });
      this.setState({
        filteredRows,
        searchKeyword: value,
      });
    }
  };

  render() {
    const {
      cx,
      data,
      columns,
      alignPositiveNegative,
      colorPositiveNegative,
      height,
      width,
      tableFilter,
      styles,
      includeSearch,
    } = this.props;

    const { filteredRows, searchKeyword } = this.state;

    const dataToRender = searchKeyword === '' ? data : filteredRows;
    const renderers: Renderers = {};
    const columnMetadata: ColumnMetadata = {};
    const convertToLowerCase = ({ data: d }: GenericRow, key: string) =>
      typeof d[key] === 'string' ? (d[key] as string).toLowerCase() : d[key];

    columns.forEach(column => {
      renderers[column.key] = getRenderer({
        alignPositiveNegative,
        colorPositiveNegative,
        column,
        enableFilter: tableFilter,
        handleCellSelected: this.handleCellSelected,
        isSelected: this.isSelected,
      });
      if (column.type === 'metric') {
        columnMetadata[column.key] = {
          rightAlign: 1,
        };
      }
    });

    const keys =
      dataToRender && dataToRender.length > 0
        ? Object.keys(dataToRender[0].data)
        : [];
    const columnWidthInfo = this.columnWidthSelector({ columns, rows: data });

    keys.forEach(key => {
      columnMetadata[key] = {
        ...columnWidthInfo.columnWidthMetaData[key],
        ...columnMetadata[key],
      };

      if (!renderers[key]) {
        renderers[key] = getRenderer({
          alignPositiveNegative,
          colorPositiveNegative,
          column: {
            key,
            label: key,
            type: 'string',
          },
          enableFilter: tableFilter,
          handleCellSelected: this.handleCellSelected,
          isSelected: this.isSelected,
        });
      }
    });

    const tableHeight = includeSearch ? height - SEARCH_BAR_HEIGHT : height;

    return (
      <>
        {includeSearch && (
          <div className={cx(styles.searchBar)}>
            <div className={cx(styles.searchBox)}>
              <Input
                compact
                name="search"
                label=""
                placeholder="Search"
                value={searchKeyword}
                onChange={this.handleSearch}
              />
            </div>
            <Text small>
              Showing {dataToRender.length}/{data.length} rows
            </Text>
          </div>
        )}
        <div className={cx(styles.container)}>
          <DataTable
            zebra
            dynamicRowHeight
            data={dataToRender}
            keys={keys}
            columnMetadata={columnMetadata}
            rowHeight="micro"
            renderers={renderers}
            height={tableHeight}
            width={Math.max(columnWidthInfo.totalWidth, width)}
            sortByValue={convertToLowerCase}
          />
        </div>
      </>
    );
  }
}

export default withStyles(({ unit }) => ({
  container: {
    display: 'grid',
    overflowX: 'scroll',
  },
  searchBar: {
    alignItems: 'baseline',
    display: 'flex',
    flexDirection: 'row-reverse',
    flexGrow: 0,
    marginBottom: unit,
  },
  searchBox: {
    marginLeft: unit,
    width: 25 * unit,
  },
}))(TableVis);
