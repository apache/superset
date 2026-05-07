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
import { useMemo, useRef, useCallback } from 'react';
import { GridSize } from 'src/components/GridTable/constants';
import { GridTable } from 'src/components/GridTable';
import { type ColDef } from 'src/components/GridTable/types';
import { useCellContentParser } from './useCellContentParser';
import { renderResultCell } from './utils';

import type { FilterableTableProps, Datum, CellDataType } from './types';

// This regex handles all possible number formats in javascript, including ints, floats,
// exponential notation, NaN, and Infinity.
// See https://stackoverflow.com/a/30987109 for more details
const ONLY_NUMBER_REGEX = /^(NaN|-?((\d*\.\d+|\d+)([Ee][+-]?\d+)?|Infinity))$/;

const parseNumberFromString = (value: string | number | null) => {
  if (typeof value === 'string' && ONLY_NUMBER_REGEX.test(value)) {
    return parseFloat(value);
  }
  return value;
};

const sortResults = (valueA: string | number, valueB: string | number) => {
  const aValue = parseNumberFromString(valueA);
  const bValue = parseNumberFromString(valueB);

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

export const FilterableTable = ({
  orderedColumnKeys,
  data,
  height,
  filterText = '',
  expandedColumns = [],
  allowHTML = true,
  striped,
}: FilterableTableProps) => {
  const getCellContent = useCellContentParser({
    columnKeys: orderedColumnKeys,
    expandedColumns,
  });

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

  const columns = useMemo(
    () =>
      orderedColumnKeys.map(key => ({
        key,
        label: key,
        fieldName: key,
        headerName: key,
        comparator: sortResults,
        render: ({ value, colDef }: { value: CellDataType; colDef: ColDef }) =>
          renderResultCell({
            cellData: value,
            columnKey: colDef.field,
            allowHTML,
            getCellContent,
          }),
      })),
    [orderedColumnKeys, allowHTML, getCellContent],
  );

  const keyword = useRef<string | undefined>(filterText);
  keyword.current = filterText;

  const keywordFilter = useCallback(node => {
    if (keyword.current && node.data) {
      return hasMatch(keyword.current, node.data);
    }
    return true;
  }, []);

  return (
    <div className="filterable-table-container" data-test="table-container">
      <GridTable
        size={GridSize.Small}
        height={height}
        columns={columns}
        data={data}
        externalFilter={keywordFilter}
        showRowNumber
        striped={striped}
        enableActions
        columnReorderable
      />
    </div>
  );
};

export type { FilterableTableProps };
