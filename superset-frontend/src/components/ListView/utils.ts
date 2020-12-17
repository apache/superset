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
  NumberParam,
  StringParam,
  useQueryParams,
  QueryParamConfig,
} from 'use-query-params';

import rison from 'rison';
import { isEqual } from 'lodash';
import { PartialStylesConfig } from 'src/components/Select';
import {
  FetchDataConfig,
  Filter,
  FilterValue,
  InternalFilter,
  SortColumn,
  ViewModeType,
} from './types';

// Define custom RisonParam for proper encoding/decoding
const RisonParam: QueryParamConfig<string, any> = {
  encode: (data?: any | null) =>
    data === undefined ? undefined : rison.encode(data),
  decode: (dataStr?: string | string[]) =>
    dataStr === undefined || Array.isArray(dataStr)
      ? undefined
      : rison.decode(dataStr),
};

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

type QueryFilterState = {
  [id: string]: FilterValue['value'];
};

function mergeCreateFilterValues(list: Filter[], updateObj: QueryFilterState) {
  return list.map(({ id, urlDisplay, operator }) => {
    const currentFilterId = urlDisplay || id;
    const update = updateObj[currentFilterId];

    return { id, urlDisplay, operator, value: update };
  });
}

// convert filters from UI objects to data objects
export function convertFilters(fts: InternalFilter[]): FilterValue[] {
  return fts
    .filter(
      f =>
        !(
          typeof f.value === 'undefined' ||
          (Array.isArray(f.value) && !f.value.length)
        ),
    )
    .map(({ value, operator, id }) => {
      // handle between filter using 2 api filters
      if (operator === 'between' && Array.isArray(value)) {
        return [
          {
            value: value[0],
            operator: 'gt',
            id,
          },
          {
            value: value[1],
            operator: 'lt',
            id,
          },
        ];
      }
      return {
        value,
        operator,
        id,
      };
    })
    .flat();
}

// convertFilters but to handle new decoded rison format
export function convertFiltersRison(
  filterObj: any,
  list: Filter[],
): FilterValue[] {
  const filters: FilterValue[] = [];
  const refs = {};

  Object.keys(filterObj).forEach(id => {
    const filter: FilterValue = {
      id,
      value: filterObj[id],
      // operator: filterObj[id][1], // TODO: can probably get rid of this
    };

    refs[id] = filter;
    filters.push(filter);
  });

  // Add operators from filter list
  list.forEach(value => {
    const currentFilterId = value.urlDisplay || value.id;
    const filter = refs[currentFilterId];

    if (filter) {
      filter.operator = value.operator;
      filter.id = value.id;
    }
  });

  return filters;
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
  renderCard?: boolean;
  defaultViewMode?: ViewModeType;
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
  renderCard = false,
  defaultViewMode = 'card',
}: UseListViewConfig) {
  const [query, setQuery] = useQueryParams({
    filters: RisonParam,
    pageIndex: NumberParam,
    sortColumn: StringParam,
    sortOrder: StringParam,
    viewMode: StringParam,
  });

  const initialSortBy = useMemo(
    () =>
      query.sortColumn && query.sortOrder
        ? [{ id: query.sortColumn, desc: query.sortOrder === 'desc' }]
        : initialSort,
    [query.sortColumn, query.sortOrder],
  );

  const initialState = {
    filters: query.filters
      ? convertFiltersRison(query.filters, initialFilters)
      : [],
    pageIndex: query.pageIndex || 0,
    pageSize: initialPageSize,
    sortBy: initialSortBy,
  };

  const [viewMode, setViewMode] = useState<ViewModeType>(
    (query.viewMode as ViewModeType) ||
      (renderCard ? defaultViewMode : 'table'),
  );

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
    query.filters && initialFilters.length
      ? mergeCreateFilterValues(initialFilters, query.filters)
      : [],
  );

  useEffect(() => {
    if (initialFilters.length) {
      setInternalFilters(
        mergeCreateFilterValues(
          initialFilters,
          query.filters ? query.filters : {},
        ),
      );
    }
  }, [initialFilters]);

  useEffect(() => {
    // From internalFilters, produce a simplified obj
    const filterObj = {};

    internalFilters.forEach(filter => {
      if (
        filter.value !== undefined &&
        (typeof filter.value !== 'string' || filter.value.length > 0)
      ) {
        const currentFilterId = filter.urlDisplay || filter.id;
        filterObj[currentFilterId] = filter.value;
      }
    });

    const queryParams: any = {
      filters: Object.keys(filterObj).length ? filterObj : undefined,
      pageIndex,
    };
    if (sortBy[0]) {
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

    fetchData({ pageIndex, pageSize, sortBy, filters });
  }, [fetchData, pageIndex, pageSize, sortBy, filters, viewMode]);

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
    state: { pageIndex, pageSize, sortBy, filters, internalFilters, viewMode },
    toggleAllRowsSelected,
    applyFilterValue,
    setViewMode,
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
