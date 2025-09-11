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
import _JSONbig from 'json-bigint';
import { useEffect, useRef, useState, useMemo } from 'react';
import { getMultipleTextDimensions, styled } from '@superset-ui/core';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import { useCellContentParser } from './useCellContentParser';
import { renderResultCell } from './utils';
import { Table, TableSize } from '../Table';

const JSONbig = _JSONbig({
  storeAsString: true,
  constructorAction: 'preserve',
});

const SCROLL_BAR_HEIGHT = 15;
// This regex handles all possible number formats in javascript, including ints, floats,
// exponential notation, NaN, and Infinity.
// See https://stackoverflow.com/a/30987109 for more details
const ONLY_NUMBER_REGEX = /^(NaN|-?((\d*\.\d+|\d+)([Ee][+-]?\d+)?|Infinity))$/;

const StyledFilterableTable = styled.div`
  ${({ theme }) => `
    height: 100%;
    overflow: hidden;

    .ant-table-cell {
      font-weight: ${theme.typography.weights.bold};
      background-color: ${theme.colors.grayscale.light5};
    }

    .ant-table-cell,
    .virtual-table-cell {
      min-width: 0px;
      align-self: center;
      font-size: ${theme.typography.sizes.s}px;
    }

    .even-row {
      background: ${theme.colors.grayscale.light4};
    }

    .odd-row {
      background: ${theme.colors.grayscale.light5};
    }

    .cell-text-for-measuring {
      font-family: ${theme.typography.families.sansSerif};
      font-size: ${theme.typography.sizes.s}px;
    }
  `}
`;

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
  // need antd 5.0 to support striped color pattern
  striped?: boolean;
  expandedColumns?: string[];
  allowHTML?: boolean;
}

const FilterableTable = ({
  orderedColumnKeys,
  data,
  height,
  filterText = '',
  expandedColumns = [],
  allowHTML = true,
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

  const [fitted, setFitted] = useState(false);
  const [list] = useState<Datum[]>(() => formatTableData(data));

  const getCellContent = useCellContentParser({
    columnKeys: orderedColumnKeys,
    expandedColumns,
  });

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

  const [widthsForColumnsByKey] = useState<Record<string, number>>(() =>
    getWidthsForColumns(),
  );

  const totalTableWidth = useRef(
    orderedColumnKeys
      .map(key => widthsForColumnsByKey[key])
      .reduce((curr, next) => curr + next),
  );
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

  // Parse any numbers from strings so they'll sort correctly
  const parseNumberFromString = (value: string | number | null) => {
    if (typeof value === 'string') {
      if (ONLY_NUMBER_REGEX.test(value)) {
        return parseFloat(value);
      }
    }

    return value;
  };

  const sortResults = (key: string, a: Datum, b: Datum) => {
    const aValue = parseNumberFromString(a[key]);
    const bValue = parseNumberFromString(b[key]);

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

    return aValue < bValue ? -1 : 1;
  };

  const keyword = useDebounceValue(filterText);

  const filteredList = useMemo(
    () =>
      keyword ? list.filter((row: Datum) => hasMatch(keyword, row)) : list,
    [list, keyword],
  );

  // exclude the height of the horizontal scroll bar from the height of the table
  // and the height of the table container if the content overflows
  const totalTableHeight =
    container.current && totalTableWidth.current > container.current.clientWidth
      ? height - SCROLL_BAR_HEIGHT
      : height;

  const columns = orderedColumnKeys.map(key => ({
    key,
    title: key,
    dataIndex: key,
    width: widthsForColumnsByKey[key],
    sorter: (a: Datum, b: Datum) => sortResults(key, a, b),
    render: (text: CellDataType) =>
      renderResultCell({
        cellData: text,
        columnKey: key,
        allowHTML,
        getCellContent,
      }),
  }));

  return (
    <StyledFilterableTable
      className="filterable-table-container"
      data-test="table-container"
      ref={container}
    >
      {fitted && (
        <Table
          loading={filterText !== keyword}
          size={TableSize.Small}
          height={totalTableHeight + 42}
          usePagination={false}
          columns={columns}
          data={filteredList}
          childrenColumnName=""
          virtualize
          bordered
        />
      )}
    </StyledFilterableTable>
  );
};

export default FilterableTable;
