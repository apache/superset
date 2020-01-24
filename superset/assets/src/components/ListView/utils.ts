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
import { useEffect, useState } from 'react';
import {
  useFilters,
  usePagination,
  useRowState,
  useSortBy,
  useTable,
} from 'react-table';

import {
  JsonParam,
  NumberParam,
  StringParam,
  useQueryParams,
} from 'use-query-params';

import { FetchDataConfig, FilterToggle, SortColumn } from './types';

// removes element from a list, returns new list
export function removeFromList(list: any[], index: number): any[] {
  return list.filter((_, i) => index !== i);
}

// apply update to elements of object list, returns new list
function updateInList(list: any[], index: number, update: any): any[] {
  const element = list.find((_, i) => index === i);

  return [
    ...list.slice(0, index),
    { ...element, ...update },
    ...list.slice(index + 1),
  ];
}

// convert filters from UI objects to data objects
export function convertFilters(fts: FilterToggle[]) {
  return fts
    .filter((ft: FilterToggle) => ft.filterValue)
    .reduce((acc, ft) => {
      acc[ft.id] = {
        filterId: ft.filterId || 'sw',
        filterValue: ft.filterValue,
      };
      return acc;
    }, {});
}

interface UseListViewConfig {
  fetchData: (conf: FetchDataConfig) => any;
  columns: any[];
  data: any[];
  count: number;
  initialPageSize: number;
  initialSort?: SortColumn[];
}

export function useListViewState({
  fetchData,
  columns,
  data,
  count,
  initialPageSize,
  initialSort = [],
}: UseListViewConfig) {
  const [query, setQuery] = useQueryParams({
    filters: JsonParam,
    pageIndex: NumberParam,
    sortColumn: StringParam,
    sortOrder: StringParam,
  });

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    canPreviousPage,
    canNextPage,
    pageCount,
    gotoPage,
    setAllFilters,
    state: { pageIndex, pageSize, sortBy, filters },
  } = useTable(
    {
      columns,
      count,
      data,
      disableSortRemove: true,
      initialState: {
        filters: convertFilters(query.filters || []),
        pageIndex: query.pageIndex || 0,
        pageSize: initialPageSize,
        sortBy:
          query.sortColumn && query.sortOrder
            ? [{ id: query.sortColumn, desc: query.sortOrder === 'desc' }]
            : initialSort,
      },
      manualFilters: true,
      manualPagination: true,
      manualSorting: true,
      pageCount: Math.ceil(count / initialPageSize),
    },
    useFilters,
    useSortBy,
    usePagination,
    useRowState,
  );

  const [filterToggles, setFilterToggles] = useState<FilterToggle[]>(
    query.filters || [],
  );

  useEffect(() => {
    const queryParams: any = {
      filters: filterToggles,
      pageIndex,
    };
    if (sortBy[0]) {
      queryParams.sortColumn = sortBy[0].id;
      queryParams.sortOrder = sortBy[0].desc ? 'desc' : 'asc';
    }
    setQuery(queryParams);

    fetchData({ pageIndex, pageSize, sortBy, filters });
  }, [fetchData, pageIndex, pageSize, sortBy, filters]);

  const filtersApplied = filterToggles.every(
    ({ id, filterValue, filterId = 'sw' }) =>
      id &&
      filters[id] &&
      filters[id].filterValue === filterValue &&
      filters[id].filterId === filterId,
  );

  return {
    applyFilters: () => setAllFilters(convertFilters(filterToggles)),
    canNextPage,
    canPreviousPage,
    filtersApplied,
    getTableBodyProps,
    getTableProps,
    gotoPage,
    headerGroups,
    pageCount,
    prepareRow,
    rows,
    setAllFilters,
    setFilterToggles,
    state: { pageIndex, pageSize, sortBy, filters, filterToggles },
    updateFilterToggle: (index: number, update: object) =>
      setFilterToggles(updateInList(filterToggles, index, update)),
  };
}
