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
import React, { useEffect } from 'react';
//import isEqual from 'lodash/isEqual';
import { styled } from '@superset-ui/core';
import GlobalFilter from "./GlobalFilter";
import {
  useFilters,
  useGlobalFilter,
  usePagination,
  useSortBy,
  useTable,
  useResizeColumns,
  useBlockLayout,
} from 'react-table';
import { Empty } from 'src/common/components';
//import { TableCollection, Pagination } from 'src/components/dataViewCommon';
import TableChild from './TableChild';
import { SortByType } from './types';

const DEFAULT_PAGE_SIZE = 10;

export enum EmptyWrapperType {
  Default = 'Default',
  Small = 'Small',
}

export interface FilterableTableProps {
  columns: any[];
  data: any[];
  filterText?: string;
  pageSize?: number;
  totalCount?: number;
  initialSortBy?: SortByType;
  loading?: boolean;
  emptyWrapperType?: EmptyWrapperType;
  noDataText?: string;
  className?: string;
  showRowCount?: boolean;
  scrollTable?: boolean;
  small?: boolean;
}

const EmptyWrapper = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 40}px 0;
`;

const FilterableTableStyles = styled.div<{
  isPaginationSticky?: boolean;
  scrollTable?: boolean;
  small?: boolean;
}>`
  ${({ scrollTable, theme }) =>
    scrollTable &&
    `
    flex: 1 1 auto;
    margin-bottom: ${theme.gridUnit * 4}px;
    overflow: auto;
  `}
  .table {
    border: 1px solid black;
  width: 100%;
  }
  .table-row {
    }

    .table-cell {
      ${({ small }) =>
        small &&
        `
      `}
    }
  }

  th[role='columnheader'] {
    z-index: 1;
 border-bottom: 1px solid black;
 {/*border-bottom: ${({ theme }) =>
   `${theme.gridUnit - 2}px solid ${theme.colors.grayscale.light2}`};
    ${({ small }) => small && `padding-bottom: 0;`}*/}
    border-right: 1px solid black;
    text-overflow: elipsis; 
    overflow: hidden;
  }

  tr.table-row:nth-child(odd) {
    background-color: ${({ theme }) => `${theme.colors.grayscale.light2}`};
  }
  tr,
  td {
    margin: 0;
    border-bottom: 1px solid black;
    border-right: 1px solid black;

    .resizer {
      display: inline-block;
      width: 10px;
      height: 100%;
      position: absolute;
      right: 0;
      top: 0;
      transform: translateX(50%);
      z-index: 1;
      ${'' /* prevents from scrolling while dragging on touch devices */}
      touch-action:none;

      &.isResizing {
        background: red;
      }
    }
  }
`;

const FilterableTable = ({
  columns,
  data,
  filterText = '',
  pageSize: initialPageSize,
  totalCount = data.length,
  initialSortBy = [],
  loading = false,
  scrollTable = true,
  emptyWrapperType = EmptyWrapperType.Default,
  noDataText,
  showRowCount = true,
  ...props
}: FilterableTableProps) => {
  const initialState = {
    pageSize: initialPageSize ?? DEFAULT_PAGE_SIZE,
    sortBy: initialSortBy,
  };

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    rows,
    prepareRow,
    pageCount,
    gotoPage,
    setGlobalFilter,
    ...state
  } = useTable(
    {
      columns,
      data,
      initialState,
    },
    useFilters,
    useGlobalFilter,
    useSortBy,
    usePagination,
    useResizeColumns,
    useBlockLayout,
  );

  //const [filterText, setFilterText] = useState('');

  useEffect(() => {
    setGlobalFilter(filterText);
  }, [filterText, setGlobalFilter]);

  let EmptyWrapperComponent;
  switch (emptyWrapperType) {
    case EmptyWrapperType.Small:
      EmptyWrapperComponent = ({ children }: any) => <>{children}</>;
      break;
    case EmptyWrapperType.Default:
    default:
      EmptyWrapperComponent = ({ children }: any) => (
        <EmptyWrapper>{children}</EmptyWrapper>
      );
  }

  const isEmpty = !loading && rows.length === 0;

  return (
    <>
      {/*<GlobalFilter
        globalFilter={state.globalFilter}
        setGlobalFilter={setGlobalFilter}
      />*/}
      <FilterableTableStyles {...props}>
        <TableChild
          getTableProps={getTableProps}
          getTableBodyProps={getTableBodyProps}
          prepareRow={prepareRow}
          headerGroups={headerGroups}
          rows={rows}
          columns={columns}
          loading={loading}
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
      </FilterableTableStyles>
    </>
  );
};

export default React.memo(FilterableTable);
