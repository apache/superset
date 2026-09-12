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

/**
 * This file contains utility functions for mapping columns and rows.
 * These functions act as a compatibility layer between Ant Design Table and react-table.
 */

import { ReactNode } from 'react';
import { CellValue, HeaderGroup, Row } from 'react-table';

import { SortOrder } from '../Table';

type TableSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

type RowWithId<T extends object> = Row<T> & { rowId: string };

const COLUMN_SIZE_MAP: Record<TableSize, number> = {
  xs: 25,
  sm: 50,
  md: 75,
  lg: 100,
  xl: 150,
  xxl: 200,
};

// The `columns` prop is the raw column config a caller authors, not a
// react-table `ColumnInstance<T>` (those only exist once react-table has
// built its column tree from this config). This is intentionally its own
// interface rather than react-table's `Column<T>`: that type requires each
// column's `accessor` to be either a specific `keyof T` literal or an
// accessor function, but every column config in this codebase writes
// `accessor` as a plain (TypeScript-widened) string, which satisfies
// neither — matching react-table's stricter modeling here would mean
// annotating every column array across ~20 call sites, not a change this
// shim should make unilaterally.
export interface ListViewColumn<T extends object = any> {
  id?: string;
  Header?: ReactNode | ((props: any) => ReactNode);
  accessor?: keyof T | string | ((row: T) => unknown);
  Cell?: (props: any) => ReactNode;
  disableSortBy?: boolean;
  hidden?: boolean;
  size?: string;
  className?: string;
}

function getSortingInfo<T extends object>(
  headerGroups: HeaderGroup<T>[],
  headerId: string,
): {
  isSorted: boolean;
  isSortedDesc: boolean;
} {
  for (const headerGroup of headerGroups) {
    const header = headerGroup.headers.find(h => h.id === headerId);
    if (header) {
      return {
        isSorted: header.isSorted ?? false,
        isSortedDesc: header.isSortedDesc ?? false,
      };
    }
  }
  return { isSorted: false, isSortedDesc: false };
}

export function mapColumns<T extends object>(
  columns: ListViewColumn<T>[],
  headerGroups: HeaderGroup<T>[],
  columnsForWrapText?: string[],
) {
  return columns.map(column => {
    const id = column.id ?? '';
    const { isSorted, isSortedDesc } = getSortingInfo(headerGroups, id);
    return {
      title: column.Header as ReactNode,
      dataIndex: id.includes('.') ? id.split('.') : id,
      hidden: column.hidden,
      key: id,
      width: column.size
        ? COLUMN_SIZE_MAP[column.size as TableSize]
        : undefined,
      ellipsis: !columnsForWrapText?.includes(id),
      defaultSortOrder: (isSorted
        ? isSortedDesc
          ? 'descend'
          : 'ascend'
        : undefined) as SortOrder | undefined,
      sorter: !column.disableSortBy,
      render: (val: CellValue<T>, record: RowWithId<T>): ReactNode => {
        if (column.Cell) {
          const cellRenderer = column.Cell as ({
            value,
            row,
            column,
          }: {
            value: CellValue<T>;
            row: { original: Row<T>; id: string };
            column: ListViewColumn<T>;
          }) => ReactNode;

          return cellRenderer({
            value: val,
            row: { original: record, id: record.rowId },
            column,
          });
        }
        return val as ReactNode;
      },
      className: column.className,
    };
  });
}

export function mapRows<T extends object>(
  rows: Row<T>[],
  prepareRow: (row: Row<T>) => void,
) {
  return rows.map(row => {
    prepareRow(row);
    return { rowId: row.id, ...row.original, ...row.getRowProps() };
  });
}
