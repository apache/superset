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

import { ColumnsType } from 'src/components/Table';

const COLUMN_SIZE_MAP: Record<string, number> = {
  xs: 25,
  sm: 50,
  md: 75,
  lg: 100,
  xl: 150,
  xxl: 200,
};

export const mapColumns = (columns: any[]): ColumnsType =>
  columns.map(column => ({
    title: column.Header,
    dataIndex: column.accessor,
    key: column.accessor,
    hidden: column.hidden,
    minWidth: COLUMN_SIZE_MAP[column.size] || column.size,
    sorter: !column.disableSortBy,
    render: (val, record) => {
      if (column.Cell) {
        return column.Cell({ row: { original: { ...record } } });
      }
      return val;
    },
  }));

export const mapRows = (rows: any[]): any[] => rows.map(row => row.original);
