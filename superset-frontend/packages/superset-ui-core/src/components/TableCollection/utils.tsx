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
import {
  CellValue,
  Row,
  ColumnInstance as RTColumnInstance,
  HeaderGroup as RTHeaderGroup,
  UseSortByColumnOptions,
  UseSortByColumnProps,
  UseResizeColumnsColumnOptions,
  UseResizeColumnsColumnProps,
} from 'react-table';

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

type EnhancedColumnInstance<T extends object = any> = RTColumnInstance<T> &
  Partial<UseSortByColumnOptions<T>> &
  Partial<UseSortByColumnProps<T>> &
  Partial<UseResizeColumnsColumnOptions<T>> &
  Partial<UseResizeColumnsColumnProps<T>> & {
    hidden?: boolean;
    size?: keyof typeof COLUMN_SIZE_MAP;
    className?: string;
  };

type EnhancedHeaderGroup<T extends object = any> = RTHeaderGroup<T> & {
  isSorted?: boolean;
  isSortedDesc?: boolean;
};

function getSortingInfo<T extends object>(
  headerGroups: EnhancedHeaderGroup<T>[],
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
  columns: EnhancedColumnInstance<T>[],
  headerGroups: EnhancedHeaderGroup<T>[],
  columnsForWrapText?: string[],
) {
  return columns.map(column => {
    const { isSorted, isSortedDesc } = getSortingInfo(headerGroups, column.id);
    return {
      title: column.Header,
      dataIndex: column.id?.includes('.') ? column.id.split('.') : column.id,
      hidden: column.hidden,
      key: column.id,
      width: column.size ? COLUMN_SIZE_MAP[column.size] : undefined,
      ellipsis: !columnsForWrapText?.includes(column.id),
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
            column: RTColumnInstance<T>;
          }) => ReactNode;

          return cellRenderer({
            value: val,
            row: { original: record, id: record.rowId },
            column,
          });
        }
        return val;
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
