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
import {
  ColumnInstance,
  HeaderGroup,
  Row,
  SortingRule,
  TableBodyPropGetter,
  TablePropGetter,
} from 'react-table';
import { styled } from '@superset-ui/core';
import { Table, TableSize } from '@superset-ui/core/components/Table';
import { TableRowSelection, SorterResult } from 'antd/es/table/interface';
import { mapColumns, mapRows } from './utils';

interface TableCollectionProps<T extends object> {
  getTableProps: TablePropGetter<T>;
  getTableBodyProps: TableBodyPropGetter<T>;
  prepareRow: (row: Row<T>) => void;
  headerGroups: HeaderGroup<T>[];
  rows: Row<T>[];
  columns: ColumnInstance<T>[];
  loading: boolean;
  highlightRowId?: number;
  columnsForWrapText?: string[];
  setSortBy?: (updater: SortingRule<T>[]) => void;
  bulkSelectEnabled?: boolean;
  selectedFlatRows?: Row<T>[];
  toggleRowSelected?: (rowId: string, value: boolean) => void;
  toggleAllRowsSelected?: (value?: boolean) => void;
  sticky?: boolean;
  size?: TableSize;
}

const StyledTable = styled(Table)`
  ${({ theme }) => `
    th.ant-column-cell {
      min-width: fit-content;
    }
    .actions {
      opacity: 0;
      font-size: ${theme.fontSizeXL}px;
      display: flex;
      white-space: nowrap;
      min-width: 100px;
      .action-button {
        margin-right: ${theme.sizeUnit * 2}px;
        cursor: pointer;
        &:hover {
          path {
            fill: ${theme.colorPrimary};
          }
        }
      }
    }
    .ant-table-column-title{
      line-height: normal;
    }
    .ant-table-row:hover {
      .actions {
        opacity: 1;
        transition: opacity ease-in ${theme.motionDurationMid};
      }
    }
    .ant-table-cell {
      font-feature-settings: 'tnum' 1;
      text-overflow: ellipsis;
      overflow: hidden;
      max-width: 320px;
      line-height: 1;
      vertical-align: middle;
      padding-left: ${theme.sizeUnit * 4}px;
      white-space: nowrap;
    }
    .ant-table-placeholder .ant-table-cell {
      border-bottom: 0;
    }
  `}
`;

function TableCollection<T extends object>({
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
  prepareRow,
  sticky,
  size = TableSize.Middle,
}: TableCollectionProps<T>) {
  const mappedColumns = mapColumns<T>(
    columns,
    headerGroups,
    columnsForWrapText,
  );
  const mappedRows = mapRows(rows, prepareRow);

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
      sticky={sticky ?? false}
      columns={mappedColumns}
      data={mappedRows}
      size={size}
      data-test="listview-table"
      pagination={false}
      tableLayout="auto"
      rowKey="rowId"
      rowSelection={rowSelection}
      locale={{ emptyText: null }}
      sortDirections={['ascend', 'descend', 'ascend']}
      components={{
        header: {
          cell: (props: HTMLAttributes<HTMLTableCellElement>) => (
            <th {...props} data-test="sort-header" role="columnheader" />
          ),
        },
        body: {
          row: (props: HTMLAttributes<HTMLTableRowElement>) => (
            <tr {...props} data-test="table-row" />
          ),
          cell: (props: HTMLAttributes<HTMLTableCellElement>) => (
            <td {...props} data-test="table-row-cell" />
          ),
        },
      }}
      onChange={(_pagination, _filters, sorter: SorterResult) => {
        setSortBy?.([
          {
            id: sorter.field,
            desc: sorter.order === 'descend',
          },
        ] as SortingRule<T>[]);
      }}
    />
  );
}

export default memo(TableCollection);
