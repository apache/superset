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

import {
  AppliedCrossFilterType,
  AppliedNativeFilterType,
  ensureIsArray,
  Filter,
  isAppliedCrossFilterType,
  isAppliedNativeFilterType,
  isNativeFilter,
} from '@superset-ui/core';
import { Slice } from 'src/types/Chart';
import { DatasourcesState } from '../types';

function checkForExpression(formData?: Record<string, any>) {
  const groupby = ensureIsArray(formData?.groupby) ?? [];
  const allColumns = ensureIsArray(formData?.all_columns) ?? [];
  const checkColumns = groupby.concat(allColumns);
  return checkColumns.some(
    (col: string | Record<string, any>) =>
      typeof col !== 'string' && col.expressionType !== undefined,
  );
}

function getRelatedChartsForSelectFilter(
  nativeFilter: AppliedNativeFilterType | Filter,
  slices: Record<string, Slice>,
  chartsInScope: number[],
  datasources: DatasourcesState,
) {
  return Object.values(slices)
    .filter(slice => {
      const { datasource, slice_id } = slice;
      // not in scope, ignore
      if (!chartsInScope.includes(slice_id)) return false;

      const chartDatasource = datasource
        ? datasources[datasource]
        : Object.values(datasources).find(ds => ds.id === slice.datasource_id);

      const { column, datasetId } = nativeFilter.targets?.[0] ?? {};
      const datasourceColumnNames = chartDatasource?.column_names ?? [];

      // same datasource, always apply
      if (chartDatasource?.id === datasetId) return true;

      // let backend deal with adhoc columns and jinja
      const hasSqlExpression = checkForExpression(slice.form_data);
      if (hasSqlExpression) {
        return true;
      }

      return datasourceColumnNames.some(
        col => col === column?.name || col === column?.displayName,
      );
    })
    .map(slice => slice.slice_id);
}
function getRelatedChartsForCrossFilter(
  filterKey: string,
  crossFilter: AppliedCrossFilterType,
  slices: Record<string, Slice>,
  scope: number[],
  datasources: DatasourcesState,
): number[] {
  const sourceSlice = slices[filterKey];
  const filters = crossFilter?.values?.filters ?? [];

  if (!sourceSlice) return [];

  const sourceDatasource = sourceSlice.datasource
    ? datasources[sourceSlice.datasource]
    : Object.values(datasources).find(
        ds => ds.id === sourceSlice.datasource_id,
      );

  return Object.values(slices)
    .filter(slice => {
      // cross-filter emitter
      if (slice.slice_id === Number(filterKey)) return false;
      // not in scope, ignore
      if (!scope.includes(slice.slice_id)) return false;

      const targetDatasource = slice.datasource
        ? datasources[slice.datasource]
        : Object.values(datasources).find(ds => ds.id === slice.datasource_id);

      // same datasource, always apply
      if (targetDatasource === sourceDatasource) return true;

      const targetColumnNames = targetDatasource?.column_names ?? [];

      // let backend deal with adhoc columns and jinja
      const hasSqlExpression = checkForExpression(slice.form_data);
      if (hasSqlExpression) {
        return true;
      }

      for (const filter of filters) {
        // let backend deal with adhoc columns
        if (
          typeof filter.col !== 'string' &&
          filter.col.expressionType !== undefined
        ) {
          return true;
        }
        // shared column names, different datasources, apply filter
        if (targetColumnNames.includes(filter.col)) return true;
      }

      return false;
    })
    .map(slice => slice.slice_id);
}

export function getRelatedCharts(
  filters: Record<
    string,
    AppliedNativeFilterType | AppliedCrossFilterType | Filter
  >,
  checkFilters: Record<
    string,
    AppliedNativeFilterType | AppliedCrossFilterType | Filter
  > | null,
  slices: Record<string, Slice>,
  datasources: DatasourcesState,
) {
  const related = Object.entries(filters).reduce((acc, [filterKey, filter]) => {
    const isCrossFilter =
      Object.keys(slices).includes(filterKey) &&
      isAppliedCrossFilterType(filter);

    const chartsInScope = Array.isArray(filter.scope)
      ? filter.scope
      : ((filter as Filter).chartsInScope ?? []);

    if (isCrossFilter) {
      const checkFilter = checkFilters?.[filterKey] as AppliedCrossFilterType;
      const crossFilter = filter as AppliedCrossFilterType;
      const wasRemoved = !!(
        ((filter.values && filter.values.filters === undefined) ||
          filter.values?.filters?.length === 0) &&
        checkFilter?.values?.filters?.length
      );
      const actualCrossFilter = wasRemoved ? checkFilter : crossFilter;

      return {
        ...acc,
        [filterKey]: getRelatedChartsForCrossFilter(
          filterKey,
          actualCrossFilter,
          slices,
          chartsInScope,
          datasources,
        ),
      };
    }

    const nativeFilter = filter as AppliedNativeFilterType | Filter;
    // on highlight, a standard native filter is passed
    // on apply, an applied native filter is passed
    if (
      isAppliedNativeFilterType(nativeFilter) ||
      isNativeFilter(nativeFilter)
    ) {
      return {
        ...acc,
        [filterKey]: getRelatedChartsForSelectFilter(
          nativeFilter,
          slices,
          chartsInScope,
          datasources,
        ),
      };
    }
    return {
      ...acc,
      [filterKey]: chartsInScope,
    };
  }, {});

  return related;
}
