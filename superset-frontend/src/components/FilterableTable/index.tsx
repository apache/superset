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
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { JSONTree } from 'react-json-tree';
import {
  getMultipleTextDimensions,
  t,
  safeHtmlSpan,
  styled,
  useTheme,
} from '@superset-ui/core';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import Button from '../Button';
import CopyToClipboard from '../CopyToClipboard';
import ModalTrigger from '../ModalTrigger';
import { Table, TableSize } from '../Table';

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
    const jsonData = JSONbig({ storeAsString: true }).parse(data);
    if (jsonData && typeof jsonData === 'object') {
      return jsonData;
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function convertBigIntStrToNumber(value: string | number) {
  if (typeof value === 'string' && /^"-?\d+"$/.test(value)) {
    return value.substring(1, value.length - 1);
  }
  return value;
}

function renderBigIntStrToNumber(value: string | number) {
  return <>{convertBigIntStrToNumber(value)}</>;
}

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

  // columns that have complex type and were expanded into sub columns
  const complexColumns = useMemo<Record<string, boolean>>(
    () =>
      orderedColumnKeys.reduce(
        (obj, key) => ({
          ...obj,
          [key]: expandedColumns.some(name => name.startsWith(`${key}.`)),
        }),
        {},
      ),
    [expandedColumns, orderedColumnKeys],
  );

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

  const renderJsonModal = (
    node: React.ReactNode,
    jsonObject: Record<string, unknown> | unknown[],
    jsonString: CellDataType,
  ) => (
    <ModalTrigger
      modalBody={
        <JSONTree
          data={jsonObject}
          theme={getJsonTreeTheme()}
          valueRenderer={renderBigIntStrToNumber}
        />
      }
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

  const renderTableCell = (cellData: CellDataType, columnKey: string) => {
    const cellNode = getCellContent({ cellData, columnKey });
    if (cellData === null) {
      return <i className="text-muted">{cellNode}</i>;
    }
    const jsonObject = safeJsonObjectParse(cellData);
    if (jsonObject) {
      return renderJsonModal(cellNode, jsonObject, cellData);
    }
    if (allowHTML && typeof cellData === 'string') {
      return safeHtmlSpan(cellNode);
    }
    return cellNode;
  };

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
    render: (text: CellDataType) => renderTableCell(text, key),
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
          size={TableSize.SMALL}
          height={totalTableHeight + 42}
          usePagination={false}
          columns={columns}
          data={filteredList}
          virtualize
          bordered
        />
      )}
    </StyledFilterableTable>
  );
};

export default FilterableTable;
