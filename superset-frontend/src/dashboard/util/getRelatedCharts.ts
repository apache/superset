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

import { Filter } from '@superset-ui/core';
import { DatasourcesState } from '../types';

type Slice = {
  datasource: string;
  slice_id: number;
};

function getRelatedChartsForSelectFilter(
  filter: Filter,
  slices: Record<string, Slice>,
  chartsInScope: number[],
  datasources: DatasourcesState,
) {
  return Object.values(slices)
    .filter(({ slice_id, datasource }) => {
      if (!chartsInScope.includes(slice_id)) return false;
      const chartDatasource = datasources[datasource];
      if (!chartDatasource) return false;
      const { column, datasetId } = filter.targets[0];
      const datasourceColumnNames =
        chartDatasource?.column_names ||
        chartDatasource.columns.map(col => col.column_name);

      return (
        chartDatasource.id === datasetId ||
        datasourceColumnNames.some(
          col => col === column?.name || col === column?.displayName,
        )
      );
    })
    .map(slice => slice.slice_id);
}
function getRelatedChartsForCrossFilter(
  filterKey: string,
  slices: Record<string, Slice>,
  chartsInScope: number[],
  datasources: DatasourcesState,
): number[] {
  const sourceSlice = slices[filterKey];
  if (!sourceSlice) return [];

  const sourceDatasource = datasources[sourceSlice.datasource];
  if (!sourceDatasource) return [];

  return Object.values(slices)
    .filter(slice => {
      if (!chartsInScope.includes(slice.slice_id)) return false;
      if (slice.slice_id === Number(filterKey)) return false;
      const targetDatasource = datasources[slice.datasource];
      if (!targetDatasource) return false;
      if (targetDatasource === sourceDatasource) return true;

      const sourceColumnNames =
        sourceDatasource?.column_names ||
        sourceDatasource.columns.map(col => col.column_name);
      const targetColumnNames =
        targetDatasource?.column_names ||
        targetDatasource.columns.map(col => col.column_name);

      return sourceColumnNames.some(sourceColumn =>
        targetColumnNames.some(targetColumn => sourceColumn === targetColumn),
      );
    })
    .map(slice => slice.slice_id);
}

export function getRelatedCharts(
  filters: Object,
  slices: Record<string, Slice>,
  datasources: DatasourcesState,
) {
  return Object.entries(filters).reduce((acc, [filterKey, filter]) => {
    const isCrossFilter = Object.keys(slices).includes(filterKey);
    const chartsInScope = Array.isArray(filter.scope)
      ? filter.scope
      : filter.chartsInScope;

    if (isCrossFilter) {
      return {
        ...acc,
        [filterKey]: getRelatedChartsForCrossFilter(
          filterKey,
          slices,
          chartsInScope,
          datasources,
        ),
      };
    }
    if (filter.filterType === 'filter_select') {
      return {
        ...acc,
        [filterKey]: getRelatedChartsForSelectFilter(
          filter,
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
}
