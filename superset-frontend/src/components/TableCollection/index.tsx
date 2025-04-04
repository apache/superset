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
import { memo } from 'react';
import { SortingRule, TableInstance } from 'react-table';
import { styled } from '@superset-ui/core';
import { Table, TableSize } from 'src/components/Table';
import { mapColumns, mapRows } from './utils';

interface TableCollectionProps {
  getTableProps: (userProps?: any) => any;
  getTableBodyProps: (userProps?: any) => any;
  prepareRow: TableInstance['prepareRow'];
  headerGroups: TableInstance['headerGroups'];
  rows: TableInstance['rows'];
  columns: TableInstance['column'][];
  loading: boolean;
  highlightRowId?: number;
  columnsForWrapText?: string[];
  setSortBy?: (updater: SortingRule<any>[]) => void;
}

const StyledTable = styled(Table)`
  ${({ theme }) => `
    th.antd5-column-cell {
      min-width: fit-content;
    }
    .actions {
      opacity: 0;
      font-size: ${theme.fontSizeXL}px;
      display: flex;
      white-space: nowrap;
      min-width: 100px;
      svg,
      i {
        margin-right: 8px;
        &:hover {
          path {
            fill: ${theme.colorPrimary};
          }
        }
      }
    }
    .antd5-table-row:hover {
      .actions {
        opacity: 1;
        transition: opacity ease-in ${theme.motionDurationMid};
      }
    }
    .antd5-table-cell {
      font-feature-settings: 'tnum' 1;
      text-overflow: ellipsis;
      overflow: hidden;
      max-width: 320px;
      line-height: 1;
      vertical-align: middle;
      padding-left: ${theme.sizeUnit * 4}px;
      white-space: nowrap;
    }
  `}
`;
export default memo(
  ({
    columns,
    rows,
    loading,
    setSortBy,
    headerGroups,
  }: TableCollectionProps) => {
    const mappedColumns = mapColumns(columns, headerGroups);
    const mappedRows = mapRows(rows);
    return (
      <StyledTable
        loading={loading}
        columns={mappedColumns}
        data={mappedRows}
        size={TableSize.Middle}
        pagination={false}
        tableLayout="auto"
        sortDirections={['ascend', 'descend', 'ascend']} // HACK: To disable default sorting
        onChange={(pagination, filters, sorter: any) => {
          setSortBy?.([
            {
              id: sorter.field,
              desc: sorter.order === 'descend',
            },
          ] as SortingRule<any>[]);
        }}
      />
    );
  },
);
