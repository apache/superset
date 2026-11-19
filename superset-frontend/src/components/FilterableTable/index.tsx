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
import { useMemo, useCallback, memo } from 'react';
import { GridSize } from 'src/components/GridTable/constants';
import { GridTable } from 'src/components/GridTable';
import { type ColDef } from 'src/components/GridTable/types';
import { useCellContentParser } from './useCellContentParser';
import { renderResultCell } from './utils';

import type { FilterableTableProps, Datum, CellDataType } from './types';

import { sortResults } from './sortResults';

export const FilterableTable = ({
  orderedColumnKeys,
  data,
  height,
  filterText = '',
  expandedColumns = [],
  allowHTML = false,
  striped,
  themeOverrides,
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

  const comparator = useCallback(
    (a: CellDataType, b: CellDataType) => sortResults(a, b, data),
    [data],
  );

  const columns = useMemo(
    () =>
      orderedColumnKeys.map(key => ({
        key,
        label: key,
        fieldName: key,
        headerName: key,
        comparator,
        render: ({ value, colDef }: { value: CellDataType; colDef: ColDef }) =>
          renderResultCell({
            cellData: value,
            columnKey: colDef.field,
            allowHTML,
            getCellContent,
          }),
      })),
    [orderedColumnKeys, allowHTML, getCellContent, comparator],
  );

  const keywordFilter = useCallback(
    (node: { data: Datum }) => {
      if (filterText && node.data) {
        return hasMatch(filterText, node.data);
      }
      return true;
    },
    [filterText],
  );

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
        themeOverrides={themeOverrides}
      />
    </div>
  );
};

export type { FilterableTableProps };
export default memo(FilterableTable);
