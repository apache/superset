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
 * These functions act  as a compatibility layer between Ant Design Table and react-table.
 */

import { ReactNode } from 'react';
import { ColumnInstance, HeaderGroup } from 'react-table';
import { ColumnsType } from 'src/components/Table';

const COLUMN_SIZE_MAP: Record<string, number> = {
  xs: 25,
  sm: 50,
  md: 75,
  lg: 100,
  xl: 150,
  xxl: 200,
};

function getSortingInfo(
  headerGroups: HeaderGroup[],
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

export const mapColumns = (
  columns: ColumnInstance[],
  headerGroups: any[],
): ColumnsType =>
  columns.map(column => {
    const { isSorted, isSortedDesc } = getSortingInfo(
      headerGroups,
      // @ts-ignore
      column.accessor,
    );
    return {
      title: column.Header,
      dataIndex: column.id,
      key: column.id,
      hidden: column.hidden,
      minWidth: column.size ? COLUMN_SIZE_MAP[column.size] : undefined,
      defaultSortOrder: isSorted
        ? isSortedDesc
          ? 'descend'
          : 'ascend'
        : undefined,
      sorter: !column.disableSortBy,
      render: (val: any, record: any): ReactNode => {
        if (column.Cell) {
          const cellRenderer = column.Cell as ({
            value,
            row,
            column,
          }: {
            value: any;
            row: { original: any };
            column: ColumnInstance;
          }) => ReactNode;

          return cellRenderer({
            value: val,
            row: { original: record },
            column,
          });
        }
        return val;
      },
    };
  });

export const mapRows = (rows: any[]): any[] => rows.map(row => row.original);
