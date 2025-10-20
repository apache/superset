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
import { useCallback, useEffect, useMemo, type RefObject } from 'react';
import { isEqual } from 'lodash';
import type { FilterChangedEvent, GridApi } from 'ag-grid-community';
import {
  type AgGridFilterModel,
  type AgGridSimpleFilter,
  type AgGridCompoundFilter,
} from './agGridFilterConverter';

interface FilterInputPosition {
  lastFilteredColumn?: string;
  lastFilteredInputPosition?: 'first' | 'second';
}

/**
 * Detects which column was last modified and the input position
 */
const detectLastFilteredColumn = (
  filterModel: AgGridFilterModel,
  previousModel: AgGridFilterModel,
): FilterInputPosition => {
  const allColumns = new Set([
    ...Object.keys(filterModel),
    ...Object.keys(previousModel),
  ]);

  for (const colId of allColumns) {
    if (!isEqual(filterModel[colId], previousModel[colId])) {
      const activeElement = document.activeElement as HTMLElement;
      const isInputOrTextarea =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA';

      let lastFilteredInputPosition: 'first' | 'second' | undefined;

      if (isInputOrTextarea) {
        const filterBody = activeElement.closest('.ag-filter-body');

        if (filterBody) {
          const prevSibling =
            filterBody?.previousElementSibling?.previousElementSibling;

          if (
            prevSibling &&
            prevSibling.classList.contains('ag-filter-condition')
          ) {
            lastFilteredInputPosition = 'second';
          } else {
            const nextSibling = filterBody.nextElementSibling;
            if (
              !nextSibling ||
              nextSibling.classList.contains('ag-filter-condition')
            ) {
              lastFilteredInputPosition = 'first';
            }
          }
        }
      }

      return {
        lastFilteredColumn: colId,
        lastFilteredInputPosition,
      };
    }
  }

  return {};
};

/**
 * Preserves compound filter structure when one condition is cleared
 */
const preserveCompoundFilterStructure = (
  filterModel: AgGridFilterModel,
  previousModel: AgGridFilterModel,
): AgGridFilterModel => {
  const preservedFilterModel = { ...filterModel };

  Object.keys(filterModel).forEach(colId => {
    const currentFilter = filterModel[colId];
    const previousFilter = previousModel[colId];

    // Check if previous was compound and current is simple
    const wasCompound =
      previousFilter &&
      'operator' in previousFilter &&
      previousFilter.operator &&
      previousFilter.conditions;
    const isNowSimple =
      currentFilter &&
      'type' in currentFilter &&
      !('operator' in currentFilter);

    if (wasCompound && isNowSimple) {
      const previousCompound = previousFilter as AgGridCompoundFilter;
      const currentSimple = currentFilter as AgGridSimpleFilter;
      const [condition1, condition2] = previousCompound.conditions || [];

      const matchesCondition1 = condition1?.filter === currentSimple.filter;
      const matchesCondition2 = condition2?.filter === currentSimple.filter;

      if (matchesCondition2) {
        preservedFilterModel[colId] = {
          filterType: currentSimple.filterType,
          operator: previousCompound.operator,
          condition1: {
            filterType: currentSimple.filterType,
            type: condition1?.type || 'contains',
            filter: null,
          },
          condition2: currentSimple,
          conditions: [
            {
              filterType: currentSimple.filterType,
              type: condition1?.type || 'contains',
              filter: null,
            },
            currentSimple,
          ],
        };
      } else if (matchesCondition1) {
        preservedFilterModel[colId] = {
          filterType: currentSimple.filterType,
          operator: previousCompound.operator,
          condition1: currentSimple,
          condition2: {
            filterType: currentSimple.filterType,
            type: condition2?.type || 'contains',
            filter: null,
          },
          conditions: [
            currentSimple,
            {
              filterType: currentSimple.filterType,
              type: condition2?.type || 'contains',
              filter: null,
            },
          ],
        };
      }
    }
  });

  return preservedFilterModel;
};

interface UseAgGridFiltersProps {
  gridRef: RefObject<{ api: GridApi }>;
  serverPagination?: boolean;
  serverPaginationData?: {
    agGridFilterModel?: AgGridFilterModel;
  };
  columnFilters: AgGridFilterModel;
  setColumnFilters: (filters: AgGridFilterModel) => void;
  onAgGridColumnFiltersChange?: (
    filterModel: AgGridFilterModel,
    lastFilteredColumn?: string,
    lastFilteredInputPosition?: 'first' | 'second',
  ) => void;
}

/**
 * Custom hook to handle AG Grid filter management including:
 * - Filter change detection and state updates
 * - Filter state restoration from server pagination data
 * - Active filter column tracking
 * - Grid initialization with filters
 */
export const useAgGridFilters = ({
  gridRef,
  serverPagination,
  serverPaginationData,
  columnFilters,
  setColumnFilters,
  onAgGridColumnFiltersChange,
}: UseAgGridFiltersProps) => {
  // Calculate active filter columns from ownState filter model
  const activeFilterColumns = useMemo(() => {
    const filterModel = serverPaginationData?.agGridFilterModel || {};
    return new Set(Object.keys(filterModel));
  }, [serverPaginationData?.agGridFilterModel]);

  // Restore AG Grid filter state from ownState (similar to search box pattern)
  useEffect(() => {
    if (gridRef.current?.api && serverPagination) {
      const storedFilterModel = serverPaginationData?.agGridFilterModel;

      if (storedFilterModel && Object.keys(storedFilterModel).length > 0) {
        const currentFilterModel = gridRef.current.api.getFilterModel();

        if (!isEqual(currentFilterModel, storedFilterModel)) {
          gridRef.current.api.setFilterModel(storedFilterModel);
        }
      } else if (Object.keys(columnFilters).length > 0) {
        gridRef.current.api.setFilterModel(null);
        setColumnFilters({});
      }
    }
  }, [
    serverPaginationData?.agGridFilterModel,
    serverPagination,
    gridRef,
    columnFilters,
    setColumnFilters,
  ]);

  // Handler for filter changes
  const onFilterChanged = useCallback(
    (event: FilterChangedEvent) => {
      const filterModel = event.api.getFilterModel() as AgGridFilterModel;
      const previousModel =
        serverPaginationData?.agGridFilterModel || ({} as AgGridFilterModel);

      // Skip if no changes
      if (isEqual(filterModel, previousModel)) {
        return;
      }

      // Detect which column was modified and input position
      const { lastFilteredColumn, lastFilteredInputPosition } =
        detectLastFilteredColumn(filterModel, previousModel);

      // Preserve compound filter structure ONLY if user is typing in an input (not changing operators)
      // If lastFilteredInputPosition is undefined, the change came from dropdown/operator change,
      // so we should NOT preserve the compound structure
      const shouldPreserveCompound = lastFilteredInputPosition !== undefined;

      const preservedFilterModel = shouldPreserveCompound
        ? preserveCompoundFilterStructure(filterModel, previousModel)
        : filterModel;

      // Update local state
      setColumnFilters(preservedFilterModel);

      // Notify parent component
      if (onAgGridColumnFiltersChange && serverPagination) {
        onAgGridColumnFiltersChange(
          preservedFilterModel,
          lastFilteredColumn,
          lastFilteredInputPosition,
        );
      }
    },
    [
      onAgGridColumnFiltersChange,
      serverPagination,
      serverPaginationData?.agGridFilterModel,
      setColumnFilters,
    ],
  );

  // Initialize filters on grid ready
  const initializeFiltersOnGridReady = useCallback(
    (api: GridApi) => {
      if (serverPagination && serverPaginationData?.agGridFilterModel) {
        const storedFilterModel = serverPaginationData.agGridFilterModel;
        if (Object.keys(storedFilterModel).length > 0) {
          api.setFilterModel(storedFilterModel);
        }
      }
    },
    [serverPagination, serverPaginationData?.agGridFilterModel],
  );

  return {
    onFilterChanged,
    activeFilterColumns,
    initializeFiltersOnGridReady,
  };
};
