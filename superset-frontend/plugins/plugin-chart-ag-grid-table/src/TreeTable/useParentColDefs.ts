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
import { createElement, useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { DataRecordValue } from '@superset-ui/core';
import {
  ChildSort,
  TreeTableColumn,
  TreeLevel,
  TreeTableOwnState,
} from './types';
import ExpandButton from './ExpandButton';
import { expandColumn } from './expandColumn';
import { getColumnSortingOrder } from './useColumnSort';

export type ParentGridContext = {
  levels: TreeLevel[];
  expanded: Set<string>;
  toggle: (id: string) => void;
};

/** Render expansion without replacing the button on a toggle. */
function renderExpandButton({
  data,
  context,
  eGridCell,
}: ICellRendererParams<Record<string, unknown>, unknown, ParentGridContext>) {
  const { levels, expanded, toggle } = context;
  const [level] = levels;
  const id = level && data?.[level.id_column];
  if (
    id === null ||
    id === undefined ||
    id === '' ||
    !(levels.length > 1 || level.detail_fields.length)
  )
    return null;
  return createElement(ExpandButton, {
    label: String(id),
    expanded: expanded.has(String(id)),
    onToggle: () => toggle(String(id)),
    cell: eGridCell,
  });
}

/** Build parent columns using the built-in sortable, keyboard-accessible header. */
export default function useParentColDefs(
  columns: TreeTableColumn[],
  ownState: TreeTableOwnState,
  emitCrossFilters: boolean,
  isActiveFilterValue: (key: string, value: DataRecordValue) => boolean,
  fallback: ChildSort,
  configuredSort: ChildSort,
): ColDef<Record<string, unknown>>[] {
  return useMemo(
    () => [
      {
        ...expandColumn,
        cellRenderer: renderExpandButton,
      },
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
        sortable: true,
        comparator: () => 0,
        sortingOrder: getColumnSortingOrder(column.key, configuredSort),
        sort:
          (ownState.sortBy?.[0]?.id ?? fallback?.[0]) === column.key
            ? ((ownState.sortBy?.[0]
                ? ownState.sortBy[0].desc
                  ? 'desc'
                  : 'asc'
                : fallback?.[1]
                  ? 'asc'
                  : 'desc') as 'asc' | 'desc')
            : null,
        filter: false,
        suppressHeaderMenuButton: true,
        suppressHeaderFilterButton: true,
        cellClass: ({ value }: { value: unknown }) =>
          emitCrossFilters
            ? [
                'dt-is-filter',
                ...(isActiveFilterValue(column.key, value as DataRecordValue)
                  ? ['dt-is-active-filter']
                  : []),
              ]
            : [],
      })),
    ],
    [
      columns,
      ownState.sortBy,
      emitCrossFilters,
      isActiveFilterValue,
      fallback,
      configuredSort,
    ],
  );
}
