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
import { useEffect, useMemo, useState } from 'react';
import {
  useFilters,
  usePagination,
  useRowSelect,
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

import { isEqual } from 'lodash';
import { PartialStylesConfig } from 'src/components/Select';
import {
  FetchDataConfig,
  Filter,
  FilterValue,
  InternalFilter,
  SortColumn,
} from './types';

export class ListViewError extends Error {
  name = 'ListViewError';
}

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

function mergeCreateFilterValues(list: Filter[], updateList: FilterValue[]) {
  return list.map(({ id, operator }) => {
    const update = updateList.find(obj => obj.id === id);

    return { id, operator, value: update?.value };
  });
}

// convert filters from UI objects to data objects
export function convertFilters(fts: InternalFilter[]): FilterValue[] {
  return fts
    .filter(f => typeof f.value !== 'undefined')
    .map(({ value, operator, id }) => ({ value, operator, id }));
}

export function extractInputValue(inputType: Filter['input'], event: any) {
  if (!inputType || inputType === 'text') {
    return event.currentTarget.value;
  }
  if (inputType === 'checkbox') {
    return event.currentTarget.checked;
  }

  return null;
}

export function getDefaultFilterOperator(filter: Filter): string {
  if (filter?.operator) return filter.operator;
  if (filter?.operators?.length) {
    return filter.operators[0].value;
  }
  return '';
}
interface UseListViewConfig {
  fetchData: (conf: FetchDataConfig) => any;
  columns: any[];
  data: any[];
  count: number;
  initialPageSize: number;
  initialSort?: SortColumn[];
  bulkSelectMode?: boolean;
  initialFilters?: Filter[];
  bulkSelectColumnConfig?: {
    id: string;
    Header: (conf: any) => React.ReactNode;
    Cell: (conf: any) => React.ReactNode;
  };
}

export function useListViewState({
  fetchData,
  columns,
  data,
  count,
  initialPageSize,
  initialFilters = [],
  initialSort = [],
  bulkSelectMode = false,
  bulkSelectColumnConfig,
}: UseListViewConfig) {
  const [query, setQuery] = useQueryParams({
    filters: JsonParam,
    pageIndex: NumberParam,
    sortColumn: StringParam,
    sortOrder: StringParam,
  });

  const initialSortBy = useMemo(
    () =>
      query.sortColumn && query.sortOrder
        ? [{ id: query.sortColumn, desc: query.sortOrder === 'desc' }]
        : initialSort,
    [query.sortColumn, query.sortOrder],
  );

  const initialState = {
    filters: convertFilters(query.filters || []),
    pageIndex: query.pageIndex || 0,
    pageSize: initialPageSize,
    sortBy: initialSortBy,
  };

  const columnsWithSelect = useMemo(() => {
    // add exact filter type so filters with falsey values are not filtered out
    const columnsWithFilter = columns.map(f => ({ ...f, filter: 'exact' }));
    return bulkSelectMode
      ? [bulkSelectColumnConfig, ...columnsWithFilter]
      : columnsWithFilter;
  }, [bulkSelectMode, columns]);

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
    selectedFlatRows,
    toggleAllRowsSelected,
    state: { pageIndex, pageSize, sortBy, filters },
  } = useTable(
    {
      columns: columnsWithSelect,
      count,
      data,
      disableFilters: true,
      disableSortRemove: true,
      initialState,
      manualFilters: true,
      manualPagination: true,
      manualSortBy: true,
      autoResetFilters: false,
      pageCount: Math.ceil(count / initialPageSize),
    },
    useFilters,
    useSortBy,
    usePagination,
    useRowState,
    useRowSelect,
  );

  const [internalFilters, setInternalFilters] = useState<InternalFilter[]>(
    query.filters || [],
  );

  useEffect(() => {
    if (initialFilters.length) {
      setInternalFilters(
        mergeCreateFilterValues(initialFilters, query.filters || []),
      );
    }
  }, [initialFilters]);

  useEffect(() => {
    const queryParams: any = {
      filters: internalFilters,
      pageIndex,
    };
    if (sortBy[0]) {
      queryParams.sortColumn = sortBy[0].id;
      queryParams.sortOrder = sortBy[0].desc ? 'desc' : 'asc';
    }

    const method =
      typeof query.pageIndex !== 'undefined' &&
      queryParams.pageIndex !== query.pageIndex
        ? 'push'
        : 'replace';

    setQuery(queryParams, method);
    fetchData({ pageIndex, pageSize, sortBy, filters });
  }, [fetchData, pageIndex, pageSize, sortBy, filters]);

  useEffect(() => {
    if (!isEqual(initialState.pageIndex, pageIndex)) {
      gotoPage(initialState.pageIndex);
    }
  }, [query]);

  const applyFilterValue = (index: number, value: any) => {
    setInternalFilters(currentInternalFilters => {
      // skip redunundant updates
      if (currentInternalFilters[index].value === value) {
        return currentInternalFilters;
      }
      const update = { ...currentInternalFilters[index], value };
      const updatedFilters = updateInList(
        currentInternalFilters,
        index,
        update,
      );
      setAllFilters(convertFilters(updatedFilters));
      gotoPage(0); // clear pagination on filter
      return updatedFilters;
    });
  };

  return {
    canNextPage,
    canPreviousPage,
    getTableBodyProps,
    getTableProps,
    gotoPage,
    headerGroups,
    pageCount,
    prepareRow,
    rows,
    selectedFlatRows,
    setAllFilters,
    state: { pageIndex, pageSize, sortBy, filters, internalFilters },
    toggleAllRowsSelected,
    applyFilterValue,
  };
}

export const filterSelectStyles: PartialStylesConfig = {
  container: (provider, { getValue }) => ({
    ...provider,
    // dynamic width based on label string length
    minWidth: `${Math.min(
      12,
      Math.max(5, 3 + getValue()[0].label.length / 2),
    )}em`,
  }),
  control: provider => ({
    ...provider,
    borderWidth: 0,
    boxShadow: 'none',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  }),
};
