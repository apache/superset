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
import {
  useFilters,
  useGlobalFilter,
  usePagination,
  useSortBy,
  useTable,
  useResizeColumns,
  useFlexLayout,
} from 'react-table';
import { Empty } from 'src/common/components';
//import { TableCollection, Pagination } from 'src/components/dataViewCommon';
import TableDisplay from './TableDisplay';
import { SortByType } from './types';

export enum EmptyWrapperType {
  Default = 'Default',
  Small = 'Small',
}

export interface ResizableTableProps {
  columns: any[];
  data: any[];
  filterText?: string;
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

const ResizableTableStyles = styled.div<{
  isPaginationSticky?: boolean;
  scrollTable?: boolean;
  small?: boolean;
}>`
  ${({ scrollTable, theme }) =>
    scrollTable &&
    `
    flex: 1 1 auto;
    margin-bottom: ${theme.gridUnit * 4}px;
  `}
  .table {
    border: 1px solid black;
    width: 100%;
  }
  
    .table-cell {
      ${({ small }) =>
        small &&
        `
      `}
    }
  }

`;

const ResizableTable = ({
  columns,
  data,
  filterText = '',
  totalCount = data.length,
  initialSortBy = [],
  loading = false,
  scrollTable = true,
  emptyWrapperType = EmptyWrapperType.Default,
  noDataText,
  showRowCount = true,
  ...props
}: ResizableTableProps) => {
  {
    /*const initialState = {
pageSize: initialPageSize ?? DEFAULT_PAGE_SIZE,
sortBy: initialSortBy,
};*/
  }

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    setGlobalFilter,
    ...state
  } = useTable(
    {
      columns,
      data,
    },
    useFilters,
    useGlobalFilter,
    useSortBy,
    usePagination,
    useResizeColumns,
    useFlexLayout,
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

  console.group('RESIZABLE_TABLE');

  console.log('STATE_FILLTBL', state);
  console.log('PROPS_FILLTBL', getTableProps(props));
  console.log('PROPS_FILLTBL_BDYPROPS', getTableBodyProps(props));
  console.log('HEADER_GROUP', headerGroups);
  console.log('COLUMNS', columns);
  console.log('ROWS', rows);

  console.groupEnd();

  return (
    <>
      <ResizableTableStyles {...props}>
        {/*{console.log('getTableProps:', getTableProps)}*/}
        {/*{console.log('getTableBodyProps:', getTableBodyProps)}*/}
        {/*{console.log('prepareRow:', prepareRow)}*/}
        {/*{console.log('headerGroups:', headerGroups)}*/}
        {console.log('rows:', rows)}
        {console.log('columns:', columns)}

        <TableDisplay
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
      </ResizableTableStyles>
    </>
  );
};

export default React.memo(ResizableTable);
