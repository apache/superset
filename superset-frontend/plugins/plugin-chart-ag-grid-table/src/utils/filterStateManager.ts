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
import type { FilterInputPosition, AGGridFilterInstance } from '../types';
import { FILTER_INPUT_POSITIONS, FILTER_CONDITION_BODY_INDEX } from '../consts';

export interface FilterState {
  originalFilterModel: AgGridFilterModel;
  simpleFilters: SQLAlchemyFilter[];
  complexWhere?: string;
  havingClause?: string;
  lastFilteredColumn?: string;
  inputPosition?: FilterInputPosition;
}

/**
 * Detects which input position (first or second) was last modified in a filter.
 * Note: activeElement is captured before async operations and passed here to ensure
 * we check against the element that was focused when the detection was initiated,
 * not what might be focused after async operations complete.
 */
async function detectLastFilteredInput(
  gridApi: GridApi,
  filterModel: AgGridFilterModel,
  activeElement: HTMLElement,
): Promise<{
  lastFilteredColumn?: string;
  inputPosition: FilterInputPosition;
}> {
  let inputPosition: FilterInputPosition = FILTER_INPUT_POSITIONS.UNKNOWN;
  let lastFilteredColumn: string | undefined;

  // Loop through filtered columns to find which one contains the active element
  for (const [colId] of Object.entries(filterModel)) {
    const filterInstance = (await gridApi.getColumnFilterInstance(
      colId,
    )) as AGGridFilterInstance | null;

    if (!filterInstance) {
      continue;
    }

    if (filterInstance.eConditionBodies) {
      const conditionBodies = filterInstance.eConditionBodies;

      // Check first condition body
      if (
        conditionBodies[FILTER_CONDITION_BODY_INDEX.FIRST]?.contains(
          activeElement,
        )
      ) {
        inputPosition = FILTER_INPUT_POSITIONS.FIRST;
        lastFilteredColumn = colId;
        break;
      }

      // Check second condition body
      if (
        conditionBodies[FILTER_CONDITION_BODY_INDEX.SECOND]?.contains(
          activeElement,
        )
      ) {
        inputPosition = FILTER_INPUT_POSITIONS.SECOND;
        lastFilteredColumn = colId;
        break;
      }
    }

    if (filterInstance.eJoinAnds) {
      for (const joinAnd of filterInstance.eJoinAnds) {
        if (joinAnd.eGui?.contains(activeElement)) {
          inputPosition = FILTER_INPUT_POSITIONS.FIRST;
          lastFilteredColumn = colId;
          break;
        }
      }
      if (lastFilteredColumn) break;
    }

    if (filterInstance.eJoinOrs) {
      for (const joinOr of filterInstance.eJoinOrs) {
        if (joinOr.eGui?.contains(activeElement)) {
          inputPosition = FILTER_INPUT_POSITIONS.FIRST;
          lastFilteredColumn = colId;
          break;
        }
      }
      if (lastFilteredColumn) break;
    }
  }

  return { lastFilteredColumn, inputPosition };
}

/**
 * Gets complete filter state including SQL conversion and input position detection.
 */
export async function getCompleteFilterState(
  gridRef: RefObject<AgGridReact>,
  metricColumns: string[],
): Promise<FilterState> {
  // Capture activeElement before any async operations to detect which input
  // was focused when the user triggered the filter change
  const activeElement = document.activeElement as HTMLElement;

  if (!gridRef.current?.api) {
    return {
      originalFilterModel: {},
      simpleFilters: [],
      complexWhere: undefined,
      havingClause: undefined,
      lastFilteredColumn: undefined,
      inputPosition: FILTER_INPUT_POSITIONS.UNKNOWN,
    };
  }

  const filterModel = gridRef.current.api.getFilterModel();

  // Convert filters to SQL
  const convertedFilters = convertAgGridFiltersToSQL(
    filterModel,
    metricColumns,
  );

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
