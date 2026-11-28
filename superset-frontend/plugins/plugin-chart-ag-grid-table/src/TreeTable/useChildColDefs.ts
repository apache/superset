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
import { createElement, useContext, useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import ExpandButton from './ExpandButton';
import { expandColumn } from './expandColumn';
import { keyOf } from './childrenState';
import { isMarker, TreeTableContext } from './TreeTableContext';
import { ChildSort, TreeTableColumn } from './types';
import { getColumnSortingOrder } from './useColumnSort';

type ChildExpandCellProps = ICellRendererParams<Record<string, unknown>> & {
  parentPath: string[];
  levelIndex: number;
};

function ChildExpandCell({
  data,
  eGridCell,
  parentPath,
  levelIndex,
}: ChildExpandCellProps) {
  const context = useContext(TreeTableContext);
  const level = context?.levels[levelIndex];
  if (!context || !level || isMarker(data)) return null;
  const key = keyOf(data?.[level.id_column]);
  if (key === undefined) return null;
  const path = [...parentPath, key];
  return createElement(ExpandButton, {
    label: key,
    expanded: context.childExpanded.has(JSON.stringify(path)),
    onToggle: () => context.toggleChild(path),
    cell: eGridCell,
  });
}

/** Child table columns: a +/- column when its rows can open, then its Columns, sortable on the server. */
export default function useChildColDefs(
  columns: TreeTableColumn[],
  canOpen: boolean,
  parentPath: string[],
  levelIndex: number,
  sort: ChildSort,
  sortable: string[],
  configuredSort: ChildSort,
): ColDef<Record<string, unknown>>[] {
  return useMemo(
    () => [
      ...(canOpen
        ? [
            {
              ...expandColumn,
              cellRenderer: ChildExpandCell,
              cellRendererParams: { parentPath, levelIndex },
            },
          ]
        : []),
      ...columns.map(column => ({
        colId: column.key,
        field: column.key,
        valueGetter: ({ data }: { data?: Record<string, unknown> }) =>
          data?.[column.key],
        headerName: column.label,
        valueFormatter: ({ value }: { value: unknown }) =>
          value === null || value === undefined
            ? t('N/A')
            : (column.formatter?.(value) ?? String(value)),
        sortable: sortable.includes(column.key),
        comparator: () => 0,
        sortingOrder: getColumnSortingOrder(column.key, configuredSort),
        sort:
          sort?.[0] === column.key
            ? ((sort[1] ? 'asc' : 'desc') as 'asc' | 'desc')
            : null,
        filter: false,
        suppressHeaderMenuButton: true,
        suppressHeaderFilterButton: true,
      })),
    ],
    [columns, canOpen, parentPath, levelIndex, sort, sortable, configuredSort],
  );
}
