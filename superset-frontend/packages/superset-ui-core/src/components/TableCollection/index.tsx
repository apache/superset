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
import { HTMLAttributes, memo, useMemo, useCallback } from 'react';
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
  pageIndex?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  isPaginationSticky?: boolean;
  showRowCount?: boolean;
}

const StyledTable = styled(Table)<{
  isPaginationSticky?: boolean;
  showRowCount?: boolean;
}>`
  ${({ theme, isPaginationSticky, showRowCount }) => `
    th.ant-column-cell {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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

    .ant-table-column-title {
      line-height: initial;
    }

    .ant-table-row:hover {
      .actions {
        opacity: 1;
        transition: opacity ease-in ${theme.motionDurationMid};
      }
    }

    .ant-table-row.table-row-highlighted > td.ant-table-cell,
    .ant-table-row.table-row-highlighted > td.ant-table-cell.ant-table-cell-row-hover {
      background-color: ${theme.colorPrimaryBg};
    }

    .ant-table-cell {
      max-width: 320px;
      font-feature-settings: 'tnum' 1;
      text-overflow: ellipsis;
      overflow: hidden;
      line-height: 1;
      vertical-align: middle;
      padding-left: ${theme.sizeUnit * 4}px;
      white-space: nowrap;
    }

    .ant-table-tbody > tr > td {
      height: ${theme.sizeUnit * 12}px;
    }

    .ant-table-tbody > tr > td.ant-table-cell:has(.ant-avatar-group) {
      padding-top: ${theme.sizeUnit}px;
      padding-bottom: ${theme.sizeUnit}px;
    }

    .ant-table-placeholder .ant-table-cell {
      border-bottom: 0;
    }

    &.ant-table-wrapper .ant-table-pagination.ant-pagination {
      display: flex;
      justify-content: center;
      margin: ${showRowCount ? theme.sizeUnit * 4 : 0}px 0 ${showRowCount ? theme.sizeUnit * 14 : 0}px 0;
      position: relative;

      .ant-pagination-total-text {
        color: ${theme.colorTextBase};
        margin-inline-end: 0;
        position: absolute;
        top: ${theme.sizeUnit * 12}px;
      }

      ${
        isPaginationSticky &&
        `
        position: sticky;
        bottom: 0;
        left: 0;
        z-index: 1;
        background-color: ${theme.colorBgElevated};
        padding: ${theme.sizeUnit * 2}px 0;
      `
      }
    }

    // Hotfix - antd doesn't apply background color to overflowing cells
    & table {
      background-color: ${theme.colorBgContainer};
    }
  `}
`;

function TableCollection<T extends object>({
  columns,
  rows,
  loading,
  highlightRowId,
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
  pageIndex = 0,
  pageSize = 25,
  totalCount = 0,
  onPageChange,
  isPaginationSticky = false,
  showRowCount = true,
}: TableCollectionProps<T>) {
  const mappedColumns = useMemo(
    () => mapColumns<T>(columns, headerGroups, columnsForWrapText),
    [columns, headerGroups, columnsForWrapText],
  );

  const mappedRows = useMemo(
    () => mapRows(rows, prepareRow),
    [rows, prepareRow],
  );

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

  const handlePaginationChange = useCallback(
    (page: number, size: number) => {
      const validPage = Math.max(0, (page || 1) - 1);
      const validSize = size || pageSize;
      onPageChange?.(validPage, validSize);
    },
    [pageSize, onPageChange],
  );

  const showTotalFunc = useCallback(
    (total: number, range: [number, number]) =>
      `${range[0]}-${range[1]} of ${total}`,
    [],
  );

  const handleTableChange = useCallback(
    (_pagination: any, _filters: any, sorter: SorterResult) => {
      if (sorter && sorter.field) {
        // Convert array field back to dot notation for nested fields
        const fieldId = Array.isArray(sorter.field)
          ? sorter.field.join('.')
          : sorter.field;

        setSortBy?.([
          {
            id: fieldId,
            desc: sorter.order === 'descend',
          },
        ] as SortingRule<T>[]);
      }
    },
    [setSortBy],
  );

  const paginationConfig = useMemo(() => {
    if (totalCount === 0) return false;

    const config: any = {
      pageSize,
      size: 'default' as const,
      showSizeChanger: false,
      showQuickJumper: false,
      align: 'center' as const,
      showTotal: showRowCount ? showTotalFunc : undefined,
    };

    if (onPageChange) {
      config.current = pageIndex + 1;
      config.total = totalCount;
      config.onChange = handlePaginationChange;
    } else {
      if (pageIndex > 0) config.defaultCurrent = pageIndex + 1;
      config.total = totalCount;
    }

    return config;
  }, [
    pageSize,
    totalCount,
    showRowCount,
    showTotalFunc,
    pageIndex,
    handlePaginationChange,
    onPageChange,
  ]);

  const getRowClassName = useCallback(
    (record: Record<string, unknown>) =>
      record?.id === highlightRowId ? 'table-row-highlighted' : '',
    [highlightRowId],
  );

  return (
    <StyledTable
      loading={loading}
      sticky={sticky ?? false}
      columns={mappedColumns}
      data={mappedRows}
      size={size}
      data-test="listview-table"
      pagination={paginationConfig}
      scroll={{ x: 'max-content' }}
      tableLayout="auto"
      rowKey="rowId"
      rowSelection={rowSelection}
      locale={{ emptyText: null }}
      sortDirections={['ascend', 'descend', 'ascend']}
      isPaginationSticky={isPaginationSticky}
      showRowCount={showRowCount}
      rowClassName={getRowClassName}
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
      onChange={handleTableChange}
    />
  );
}

export default memo(TableCollection);
