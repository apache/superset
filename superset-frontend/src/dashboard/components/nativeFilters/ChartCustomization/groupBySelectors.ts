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
import { createSelector } from '@reduxjs/toolkit';
import { RootState } from 'src/dashboard/types';
import { GroupByState } from 'src/dashboard/reducers/groupByCustomizations';
import { ChartCustomizationItem } from './types';

export const selectGroupByState = (state: RootState): GroupByState =>
  state.groupByCustomizations?.groupByState || {};

export const selectGroupByValues = createSelector(
  [selectGroupByState, (state: RootState, groupById: string) => groupById],
  (groupByState, groupById) => groupByState[groupById]?.selectedValues || [],
);

export const selectGroupByLoading = createSelector(
  [selectGroupByState, (state: RootState, groupById: string) => groupById],
  (groupByState, groupById) => groupByState[groupById]?.isLoading || false,
);

export const selectGroupByOptions = createSelector(
  [selectGroupByState, (state: RootState, groupById: string) => groupById],
  (groupByState, groupById) => groupByState[groupById]?.availableOptions || [],
);

export const selectGroupByFormData = createSelector(
  [
    selectGroupByState,
    (state: RootState) =>
      state.dashboardInfo.metadata?.chart_customization_config || [],
    (state: RootState, chartId: number) => chartId,
  ],
  (
    groupByState,
    chartCustomizationItems: ChartCustomizationItem[],
    chartId,
  ) => {
    const groupByFormData: { groupby?: string[]; filters?: any[] } = {};

    const matchingCustomizations = chartCustomizationItems.filter(item => {
      if (item.removed) return false;
      return !item.chartId || item.chartId === chartId;
    });

    const groupByColumns = new Set<string>();
    const allFilters: any[] = [];

    matchingCustomizations.forEach(item => {
      const groupById = `chart_customization_${item.id}`;
      const groupByValues = groupByState[groupById]?.selectedValues || [];

      if (item.customization?.column) {
        let columnName: string;
        if (typeof item.customization.column === 'string') {
          columnName = item.customization.column;
        } else if (
          typeof item.customization.column === 'object' &&
          item.customization.column !== null
        ) {
          const columnObj = item.customization.column as any;
          columnName =
            columnObj.column_name || columnObj.name || String(columnObj);
        } else {
          console.warn('Invalid column format:', item.customization.column);
          return;
        }

        if (!columnName || columnName.trim() === '') {
          console.warn('Empty column name in customization:', item.id);
          return;
        }

        groupByColumns.add(columnName);

        if (groupByValues.length > 0) {
          allFilters.push({
            col: columnName,
            op: 'IN',
            val: groupByValues,
          });
        }
      }
    });

    if (groupByColumns.size > 0) {
      groupByFormData.groupby = Array.from(groupByColumns);
    }

    if (allFilters.length > 0) {
      groupByFormData.filters = allFilters;
    }

    return groupByFormData;
  },
);

export const selectGroupByExtraFormData = createSelector(
  [
    selectGroupByState,
    (state: RootState) =>
      state.dashboardInfo.metadata?.chart_customization_config || [],
    (state: RootState, chartId: number, datasetId: string) => ({
      chartId,
      datasetId,
    }),
  ],
  (
    groupByState,
    chartCustomizationItems: ChartCustomizationItem[],
    { chartId, datasetId },
  ) => {
    const extraFormData: {
      groupby?: string[];
      order_by_cols?: string[];
      filters?: any[];
    } = {};

    const matchingCustomizations = chartCustomizationItems.filter(item => {
      if (item.removed) return false;

      const targetDatasetId = String(item.customization?.dataset || '');
      const datasetMatches = targetDatasetId === datasetId;
      const chartMatches = !item.chartId || item.chartId === chartId;

      return datasetMatches && chartMatches;
    });

    const groupByColumns = new Set<string>();
    const allFilters: any[] = [];
    let orderByConfig: string[] | undefined;

    matchingCustomizations.forEach(item => {
      const { customization } = item;
      const groupById = `chart_customization_${item.id}`;
      const groupByValues = groupByState[groupById]?.selectedValues || [];

      if (customization?.column) {
        let columnName: string;
        if (typeof customization.column === 'string') {
          columnName = customization.column;
        } else if (
          typeof customization.column === 'object' &&
          customization.column !== null
        ) {
          const columnObj = customization.column as any;
          columnName =
            columnObj.column_name || columnObj.name || String(columnObj);
        } else {
          console.warn('Invalid column format:', customization.column);
          return;
        }

        if (!columnName || columnName.trim() === '') {
          console.warn('Empty column name in customization:', item.id);
          return;
        }

        groupByColumns.add(columnName);

        if (groupByValues.length > 0) {
          allFilters.push({
            col: columnName,
            op: 'IN',
            val: groupByValues,
          });
        }

        if (customization.sortFilter && customization.sortMetric) {
          orderByConfig = [
            JSON.stringify([
              customization.sortMetric,
              !customization.sortAscending,
            ]),
          ];
        }
      }
    });

    if (groupByColumns.size > 0) {
      extraFormData.groupby = Array.from(groupByColumns);
    }

    if (allFilters.length > 0) {
      extraFormData.filters = allFilters;
    }

    if (orderByConfig) {
      extraFormData.order_by_cols = orderByConfig;
    }

    return extraFormData;
  },
);
