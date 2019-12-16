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
  useTable,
  useFilters,
  useSortBy,
  usePagination,
  useRowState,
  // @ts-ignore
} from 'react-table';
import {
  useQueryParams,
  NumberParam,
  StringParam,
  JsonParam,
} from 'use-query-params';

import { TableState, FilterToggle, SortColumn, FetchDataConfig } from './types';

// removes element from a list, returns new list
export function removeFromList(list: Array<any>, index: number): Array<any> {
  return list.filter((_, i) => index !== i);
}

// apply update to elements of object list, returns new list
function updateInList(
  list: Array<any>,
  index: number,
  update: any,
): Array<any> {
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
    .filter(ft => ft.filterValue)
    .reduce((acc, elem) => {
      acc[elem.id] = {
        filterId: elem.filterId || 'sw',
        filterValue: elem.filterValue,
      };
      return acc;
    }, {});
}

type UseListViewConfig = {
  fetchData: (conf: FetchDataConfig) => any;
  columns: any[];
  data: any[];
  count: number;
  initialPageSize: number;
  initialSort?: SortColumn[];
};

export function useListViewState({
  fetchData,
  columns,
  data,
  count,
  initialPageSize,
  initialSort = [],
}: UseListViewConfig) {
  const [query, setQuery] = useQueryParams({
    pageIndex: NumberParam,
    sortColumn: StringParam,
    sortOrder: StringParam,
    filters: JsonParam,
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
  }: TableState = useTable(
    {
      columns,
      data,
      count,
      initialState: {
        pageIndex: query.pageIndex || 0,
        pageSize: initialPageSize,
        sortBy:
          query.sortColumn && query.sortOrder
            ? [{ id: query.sortColumn, desc: query.sortOrder === 'desc' }]
            : initialSort,
        filters: convertFilters(query.filters || []),
      },
      manualSorting: true,
      disableSortRemove: true,
      manualPagination: true,
      manualFilters: true,
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
    setQuery({
      pageIndex,
      sortColumn: sortBy[0].id,
      sortOrder: sortBy[0].desc ? 'desc' : 'asc',
      filters: filterToggles,
    });

    fetchData({ pageIndex, pageSize, sortBy, filters });
  }, [fetchData, pageIndex, pageSize, sortBy, filters]);

  const filtersApplied = filterToggles.every(
    ({ id, filterValue, filterId = 'sw' }) =>
      id &&
      filters[id] &&
      filters[id].filterValue === filterValue &&
      filters[id].filterId == filterId,
  );

  return {
    setFilterToggles,
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
    filtersApplied,
    state: { pageIndex, pageSize, sortBy, filters, filterToggles },
    updateFilterToggle: (index: number, update: object) =>
      setFilterToggles(updateInList(filterToggles, index, update)),
    applyFilters: () => setAllFilters(convertFilters(filterToggles)),
  };
}
