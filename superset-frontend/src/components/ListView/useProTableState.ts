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

/**
 * A simplified state management hook for ProTable that replaces the heavy
 * react-table based useListViewState. This hook manages pagination, sorting,
 * filtering, and view mode state while syncing with URL query params.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  NumberParam,
  StringParam,
  useQueryParams,
  QueryParamConfig,
} from 'use-query-params';
import rison from 'rison';
import { isEqual } from 'lodash';
import {
  ListViewFetchDataConfig as FetchDataConfig,
  ListViewFilter as Filter,
  ListViewFilterValue as FilterValue,
  InnerFilterValue,
  InternalFilter,
  SortColumn,
  ViewModeType,
} from './types';

// Custom RisonParam for proper encoding/decoding
const RisonParam: QueryParamConfig<string, Record<string, InnerFilterValue>> = {
  encode: (data?: Record<string, InnerFilterValue> | null) => {
    if (data === undefined || data === null) return undefined;

    const cleanData = JSON.parse(
      JSON.stringify(data, (_, value) => (value === undefined ? null : value)),
    );

    return rison
      .encode(cleanData)
      .replace(/%/g, '%25')
      .replace(/&/g, '%26')
      .replace(/\+/g, '%2B')
      .replace(/#/g, '%23');
  },
  decode: (dataStr?: string | string[]) =>
    dataStr === undefined || Array.isArray(dataStr)
      ? undefined
      : rison.decode(dataStr),
};

export interface UseProTableStateConfig<T extends object> {
  fetchData: (conf: FetchDataConfig) => void;
  data: T[];
  count: number;
  initialPageSize: number;
  initialSort?: SortColumn[];
  initialFilters?: Filter[];
  bulkSelectMode?: boolean;
  renderCard?: boolean;
  defaultViewMode?: ViewModeType;
}

export interface ProTableState<T extends object> {
  // Pagination
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  gotoPage: (page: number) => void;

  // Sorting
  sortBy: SortColumn[];
  setSortBy: (sortBy: SortColumn[]) => void;

  // Filtering
  internalFilters: InternalFilter[];
  applyFilterValue: (index: number, value: InnerFilterValue) => void;

  // View mode
  viewMode: ViewModeType;
  setViewMode: (mode: ViewModeType) => void;

  // Selection
  selectedRowKeys: string[];
  setSelectedRowKeys: (keys: string[]) => void;
  selectedRows: T[];
  toggleAllRowsSelected: (selected: boolean) => void;

  // Query state for empty state detection
  query: {
    filters?: Record<string, InnerFilterValue>;
    pageIndex?: number | null;
    sortColumn?: string | null;
    sortOrder?: string | null;
    viewMode?: string | null;
  };
}

function mergeCreateFilterValues(
  list: Filter[],
  updateObj: Record<string, InnerFilterValue>,
): InternalFilter[] {
  return list.map(({ id, urlDisplay, operator }) => {
    const currentFilterId = urlDisplay || id;
    const update = updateObj[currentFilterId];
    return { id, urlDisplay, operator, value: update };
  });
}

function convertFilters(fts: InternalFilter[]): FilterValue[] {
  return fts
    .filter(
      f =>
        !(
          typeof f.value === 'undefined' ||
          (Array.isArray(f.value) && !f.value.length)
        ),
    )
    .map(({ value, operator, id }) => {
      if (operator === 'between' && Array.isArray(value)) {
        return [
          { value: value[0], operator: 'gt', id },
          { value: value[1], operator: 'lt', id },
        ];
      }
      return { value, operator, id };
    })
    .flat();
}

export function useProTableState<T extends object>({
  fetchData,
  data,
  count,
  initialPageSize,
  initialFilters = [],
  initialSort = [],
  renderCard = false,
  defaultViewMode = 'card',
}: UseProTableStateConfig<T>): ProTableState<T> {
  // URL query params
  const [query, setQuery] = useQueryParams({
    filters: RisonParam,
    pageIndex: NumberParam,
    sortColumn: StringParam,
    sortOrder: StringParam,
    viewMode: StringParam,
  });

  // Pagination state
  const [pageIndex, setPageIndex] = useState<number>(query.pageIndex || 0);
  const [pageSize] = useState<number>(initialPageSize);
  const pageCount = useMemo(
    () => Math.ceil(count / initialPageSize),
    [count, initialPageSize],
  );

  // Sorting state
  const [sortBy, setSortByState] = useState<SortColumn[]>(() => {
    if (query.sortColumn && query.sortOrder) {
      return [{ id: query.sortColumn, desc: query.sortOrder === 'desc' }];
    }
    return initialSort;
  });

  // Filter state
  const [internalFilters, setInternalFilters] = useState<InternalFilter[]>(
    () =>
      query.filters && initialFilters.length
        ? mergeCreateFilterValues(initialFilters, query.filters)
        : [],
  );

  // View mode state
  const [viewMode, setViewMode] = useState<ViewModeType>(
    (query.viewMode as ViewModeType) ||
      (renderCard ? defaultViewMode : 'table'),
  );

  // Selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // Computed selected rows
  const selectedRows = useMemo(
    () => data.filter((_, index) => selectedRowKeys.includes(String(index))),
    [data, selectedRowKeys],
  );

  // Initialize filters when initialFilters changes
  useEffect(() => {
    if (initialFilters.length) {
      setInternalFilters(
        mergeCreateFilterValues(
          initialFilters,
          query.filters ? query.filters : {},
        ),
      );
    }
  }, [initialFilters, query.filters]);

  // Sync state to URL and trigger fetch
  useEffect(() => {
    const filterObj: Record<string, InnerFilterValue> = {};

    internalFilters.forEach(filter => {
      if (
        filter.value !== undefined &&
        (typeof filter.value !== 'string' || filter.value.length > 0)
      ) {
        const currentFilterId = filter.urlDisplay || filter.id;
        filterObj[currentFilterId] = filter.value;
      }
    });

    const queryParams: {
      filters?: Record<string, InnerFilterValue>;
      pageIndex: number;
      sortColumn?: string;
      sortOrder?: string;
      viewMode?: string;
    } = {
      filters: Object.keys(filterObj).length ? filterObj : undefined,
      pageIndex,
    };

    if (sortBy?.[0]?.id !== undefined && sortBy[0].id !== null) {
      queryParams.sortColumn = sortBy[0].id;
      queryParams.sortOrder = sortBy[0].desc ? 'desc' : 'asc';
    }

    if (renderCard) {
      queryParams.viewMode = viewMode;
    }

    const method =
      typeof query.pageIndex !== 'undefined' &&
      queryParams.pageIndex !== query.pageIndex
        ? 'push'
        : 'replace';

    setQuery(queryParams, method);

    // Trigger data fetch
    fetchData({
      pageIndex,
      pageSize,
      sortBy,
      filters: convertFilters(internalFilters),
    });
  }, [pageIndex, pageSize, sortBy, internalFilters, viewMode, renderCard]);

  // Reset to first page if current page is invalid
  useEffect(() => {
    if (pageIndex > pageCount - 1 && pageCount > 0) {
      setPageIndex(0);
    }
  }, [pageCount, pageIndex]);

  // Sync from URL on initial load
  useEffect(() => {
    if (query.pageIndex !== undefined && query.pageIndex !== pageIndex) {
      setPageIndex(query.pageIndex);
    }
  }, []);

  // Actions
  const gotoPage = useCallback((page: number) => {
    setPageIndex(page);
  }, []);

  const setSortBy = useCallback((newSortBy: SortColumn[]) => {
    setSortByState(newSortBy);
  }, []);

  const applyFilterValue = useCallback(
    (index: number, value: InnerFilterValue) => {
      setInternalFilters(currentFilters => {
        if (currentFilters[index]?.value === value) {
          return currentFilters;
        }

        const updatedFilters = [...currentFilters];
        updatedFilters[index] = { ...updatedFilters[index], value };

        // Reset to first page on filter change
        setPageIndex(0);

        return updatedFilters;
      });
    },
    [],
  );

  const toggleAllRowsSelected = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedRowKeys(data.map((_, index) => String(index)));
      } else {
        setSelectedRowKeys([]);
      }
    },
    [data],
  );

  return {
    pageIndex,
    pageSize,
    pageCount,
    gotoPage,
    sortBy,
    setSortBy,
    internalFilters,
    applyFilterValue,
    viewMode,
    setViewMode,
    selectedRowKeys,
    setSelectedRowKeys,
    selectedRows,
    toggleAllRowsSelected,
    query,
  };
}
