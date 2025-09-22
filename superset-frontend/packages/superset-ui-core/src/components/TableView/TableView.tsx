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
import { memo, useEffect, useRef, useMemo, useCallback } from 'react';
import { isEqual } from 'lodash';
import { styled } from '@superset-ui/core';
import { useFilters, usePagination, useSortBy, useTable } from 'react-table';
import { Empty } from '@superset-ui/core/components';
import TableCollection from '@superset-ui/core/components/TableCollection';
import { TableSize } from '@superset-ui/core/components/Table';
import { SortByType, ServerPagination } from './types';

const NOOP_SERVER_PAGINATION = () => {};

const DEFAULT_PAGE_SIZE = 10;

export enum EmptyWrapperType {
  Default = 'Default',
  Small = 'Small',
}

export interface TableViewProps {
  columns: any[];
  data: any[];
  pageSize?: number;
  totalCount?: number;
  serverPagination?: boolean;
  onServerPagination?: (args: ServerPagination) => void;
  initialPageIndex?: number;
  initialSortBy?: SortByType;
  loading?: boolean;
  withPagination?: boolean;
  emptyWrapperType?: EmptyWrapperType;
  noDataText?: string;
  className?: string;
  isPaginationSticky?: boolean;
  showRowCount?: boolean;
  scrollTable?: boolean;
  scrollTopOnPagination?: boolean;
  small?: boolean;
  columnsForWrapText?: string[];
  size?: TableSize;
}

const EmptyWrapper = styled.div`
  margin: ${({ theme }) => theme.sizeUnit * 40}px 0;
`;

const TableViewStyles = styled.div<{
  isPaginationSticky?: boolean;
  scrollTable?: boolean;
  small?: boolean;
}>`
  ${({ scrollTable, theme }) =>
    scrollTable &&
    `
    flex: 1 1 auto;
    margin-bottom: ${theme.sizeUnit * 4}px;
    overflow: auto;
  `}
  color: ${({ theme }) => theme.colorText};

  .table-row {
    ${({ theme, small }) => !small && `height: ${theme.sizeUnit * 11 - 1}px;`}

    .table-cell {
      ${({ theme, small }) =>
        small &&
        `
        padding-top: ${theme.sizeUnit + 1}px;
        padding-bottom: ${theme.sizeUnit + 1}px;
        line-height: 1.45;
      `}
    }
  }

  th[role='columnheader'] {
    z-index: 1;
    border-bottom: ${({ theme }) =>
      `${theme.sizeUnit - 2}px solid ${theme.colorSplit}`};
    ${({ small }) => small && `padding-bottom: 0;`}
  }
`;

const RawTableView = ({
  columns,
  data,
  pageSize: initialPageSize,
  totalCount = data.length,
  initialPageIndex,
  initialSortBy = [],
  loading = false,
  withPagination = true,
  emptyWrapperType = EmptyWrapperType.Default,
  noDataText,
  showRowCount = true,
  serverPagination = false,
  columnsForWrapText,
  onServerPagination = NOOP_SERVER_PAGINATION,
  scrollTopOnPagination = true,
  size = TableSize.Middle,
  ...props
}: TableViewProps) => {
  const tableRef = useRef<HTMLTableElement>(null);

  const initialState = useMemo(
    () => ({
      pageSize: initialPageSize ?? DEFAULT_PAGE_SIZE,
      pageIndex: initialPageIndex ?? 0,
      sortBy: initialSortBy,
    }),
    [initialPageSize, initialPageIndex, initialSortBy],
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    rows,
    prepareRow,
    gotoPage,
    setSortBy,
    state: { pageIndex, sortBy },
  } = useTable(
    {
      columns,
      data,
      initialState,
      manualPagination: serverPagination,
      manualSortBy: serverPagination,
      pageCount: serverPagination
        ? Math.ceil(totalCount / initialState.pageSize)
        : undefined,
      autoResetSortBy: false,
    },
    useFilters,
    useSortBy,
    ...(withPagination ? [usePagination] : []),
  );

  const EmptyWrapperComponent = useMemo(() => {
    switch (emptyWrapperType) {
      case EmptyWrapperType.Small:
        return ({ children }: any) => <>{children}</>;
      case EmptyWrapperType.Default:
      default:
        return ({ children }: any) => <EmptyWrapper>{children}</EmptyWrapper>;
    }
  }, [emptyWrapperType]);

  const content = useMemo(
    () => (withPagination ? page : rows),
    [withPagination, page, rows],
  );

  const isEmpty = useMemo(
    () => !loading && content.length === 0,
    [loading, content.length],
  );

  const handleScrollToTop = useCallback(() => {
    if (scrollTopOnPagination) {
      if (tableRef?.current) {
        if (typeof tableRef.current.scrollTo === 'function') {
          tableRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (typeof tableRef.current.scroll === 'function') {
          tableRef.current.scroll(0, 0);
        }
      }

      if (typeof window !== 'undefined' && window.scrollTo)
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollTopOnPagination]);

  const handlePageChange = useCallback(
    (p: number) => {
      if (scrollTopOnPagination) handleScrollToTop();

      gotoPage(p);
    },
    [scrollTopOnPagination, handleScrollToTop, gotoPage],
  );

  const paginationProps = useMemo(() => {
    if (!withPagination) {
      return {
        pageIndex: 0,
        pageSize: data.length,
        totalCount: 0,
        onPageChange: undefined,
      };
    }

    if (serverPagination) {
      return {
        pageIndex,
        pageSize: initialPageSize ?? DEFAULT_PAGE_SIZE,
        totalCount,
        onPageChange: handlePageChange,
      };
    }

    return {
      pageIndex,
      pageSize: initialPageSize ?? DEFAULT_PAGE_SIZE,
      totalCount: data.length,
      onPageChange: handlePageChange,
    };
  }, [
    withPagination,
    serverPagination,
    pageIndex,
    initialPageSize,
    totalCount,
    data.length,
    handlePageChange,
  ]);

  useEffect(() => {
    if (serverPagination && pageIndex !== initialState.pageIndex) {
      onServerPagination({
        pageIndex,
      });
    }
  }, [initialState.pageIndex, onServerPagination, pageIndex, serverPagination]);

  useEffect(() => {
    if (serverPagination && !isEqual(sortBy, initialState.sortBy)) {
      onServerPagination({
        pageIndex: 0,
        sortBy,
      });
    }
  }, [initialState.sortBy, onServerPagination, serverPagination, sortBy]);

  return (
    <TableViewStyles {...props} ref={tableRef}>
      <TableCollection
        getTableProps={getTableProps}
        getTableBodyProps={getTableBodyProps}
        prepareRow={prepareRow}
        headerGroups={headerGroups}
        rows={content}
        columns={columns}
        loading={loading}
        setSortBy={setSortBy}
        size={size}
        columnsForWrapText={columnsForWrapText}
        isPaginationSticky={props.isPaginationSticky}
        showRowCount={showRowCount}
        {...paginationProps}
      />
      {isEmpty && (
        <EmptyWrapperComponent>
          {noDataText ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={noDataText}
            />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </EmptyWrapperComponent>
      )}
    </TableViewStyles>
  );
};

export const TableView = memo(RawTableView);
