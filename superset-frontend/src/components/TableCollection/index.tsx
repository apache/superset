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
import { HTMLAttributes, memo, useMemo } from 'react';
import { SortingRule, TableInstance } from 'react-table';
import { styled } from '@superset-ui/core';
import { Table, TableSize } from 'src/components/Table';
import { TableRowSelection } from 'antd-v5/es/table/interface';
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
  bulkSelectEnabled?: boolean;
  selectedFlatRows?: any[];
  toggleRowSelected?: (rowId: string, value: boolean) => void;
  toggleAllRowsSelected?: (value?: boolean) => void;
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
    .antd5-table-placeholder .antd5-table-cell {
      border-bottom: 0;
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
    columnsForWrapText,
    bulkSelectEnabled = false,
    selectedFlatRows = [],
    toggleRowSelected,
    toggleAllRowsSelected,
  }: TableCollectionProps) => {
    const mappedColumns = mapColumns(columns, headerGroups, columnsForWrapText);
    const mappedRows = mapRows(rows);

    const selectedRowKeys = useMemo(
      () => selectedFlatRows?.map(row => row.id) || [],
      [selectedFlatRows],
    );

    const rowSelection: TableRowSelection | undefined = useMemo(() => {
      if (!bulkSelectEnabled) return undefined;

      return {
        selectedRowKeys,
        onSelect: (record, selected) => {
          toggleRowSelected?.(record.rowId, selected);
        },
        onSelectAll: (selected: boolean) => {
          toggleAllRowsSelected?.(selected);
        },
      };
    }, [
      bulkSelectEnabled,
      selectedRowKeys,
      toggleRowSelected,
      toggleAllRowsSelected,
    ]);
    return (
      <StyledTable
        loading={loading}
        columns={mappedColumns}
        data={mappedRows}
        size={TableSize.Middle}
        data-test="listview-table"
        pagination={false}
        tableLayout="auto"
        rowKey="rowId"
        rowSelection={rowSelection}
        locale={{ emptyText: null }}
        sortDirections={['ascend', 'descend', 'ascend']} // HACK: To disable default sorting
        components={{
          header: {
            cell: (props: any) => <th {...props} data-test="sort-header" />,
          },
          body: {
            row: (props: any) => <tr {...props} data-test="table-row" />,
            cell: (props: any) => <td {...props} data-test="table-row-cell" />,
          },
        }}
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
