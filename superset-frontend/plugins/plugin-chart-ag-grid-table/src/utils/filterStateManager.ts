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

import type { RefObject } from 'react';
import { GridApi } from 'ag-grid-community';
import { convertAgGridFiltersToSQL } from './agGridFilterConverter';
import type {
  AgGridFilterModel,
  SQLAlchemyFilter,
} from './agGridFilterConverter';
import type { AgGridReact } from '@superset-ui/core/components/ThemedAgGridReact';

export interface FilterState {
  originalFilterModel: AgGridFilterModel;
  simpleFilters: SQLAlchemyFilter[];
  complexWhere?: string;
  havingClause?: string;
  lastFilteredColumn?: string;
  inputPosition?: 'first' | 'second' | 'unknown';
}

/**
 * Detects which input position (first or second) was last modified in a filter
 * @param gridApi - AG Grid API reference
 * @param filterModel - Current filter model
 * @param activeElement - The currently focused DOM element
 * @returns Object containing lastFilteredColumn and inputPosition
 */
async function detectLastFilteredInput(
  gridApi: GridApi,
  filterModel: AgGridFilterModel,
  activeElement: HTMLElement,
): Promise<{
  lastFilteredColumn?: string;
  inputPosition: 'first' | 'second' | 'unknown';
}> {
  let inputPosition: 'first' | 'second' | 'unknown' = 'unknown';
  let lastFilteredColumn: string | undefined;

  // Loop through filtered columns to find which one contains the active element
  for (const [colId] of Object.entries(filterModel)) {
    const filterInstance = (await gridApi.getColumnFilterInstance(colId)) as {
      eConditionBodies?: HTMLElement[];
    } | null;

    if (filterInstance?.eConditionBodies) {
      const conditionBodies = filterInstance.eConditionBodies;

      // Check first condition body
      if (conditionBodies[0]?.contains(activeElement)) {
        inputPosition = 'first';
        lastFilteredColumn = colId;
        break;
      }

      // Check second condition body
      if (conditionBodies[1]?.contains(activeElement)) {
        inputPosition = 'second';
        lastFilteredColumn = colId;
        break;
      }
    }
  }

  return { lastFilteredColumn, inputPosition };
}

/**
 * Gets complete filter state including SQL conversion and input position detection
 * @param gridRef - React ref to AG Grid component
 * @param metricColumns - Array of metric column names for SQL conversion
 * @returns Complete filter state object
 */
export async function getCompleteFilterState(
  gridRef: RefObject<AgGridReact>,
  metricColumns: string[],
): Promise<FilterState> {
  const activeElement = document.activeElement as HTMLElement;

  if (!gridRef.current?.api) {
    return {
      originalFilterModel: {},
      simpleFilters: [],
      complexWhere: undefined,
      havingClause: undefined,
      lastFilteredColumn: undefined,
      inputPosition: 'unknown',
    };
  }

  const filterModel = gridRef.current.api.getFilterModel();

  // Convert filters to SQL
  const convertedFilters = convertAgGridFiltersToSQL(filterModel, metricColumns);

  // Detect which input was last modified
  const { lastFilteredColumn, inputPosition } = await detectLastFilteredInput(
    gridRef.current.api,
    filterModel,
    activeElement,
  );

  return {
    originalFilterModel: filterModel,
    simpleFilters: convertedFilters.simpleFilters,
    complexWhere: convertedFilters.complexWhere,
    havingClause: convertedFilters.havingClause,
    lastFilteredColumn,
    inputPosition,
  };
}
