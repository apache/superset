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
  slices: Slice[],
  datasources: DatasourcesState,
) {
  return Object.values(slices)
    .filter(({ datasource }) => {
      const chartDatasource = datasources[datasource];
      if (!chartDatasource) return false;
      const { column, datasetId } = filter.targets[0];

      return (
        chartDatasource.id === datasetId ||
        chartDatasource.columns.some(
          col =>
            col.column_name === column?.name ||
            col.column_name === column?.displayName,
        )
      );
    })
    .map(slice => slice.slice_id);
}
function getRelatedChartsForCrossFilter(
  filterKey: string,
  slices: Slice[],
  datasources: DatasourcesState,
): number[] {
  const sourceSlice = slices[filterKey];
  if (!sourceSlice) return [];

  const sourceDatasource = datasources[sourceSlice.datasource];
  if (!sourceDatasource) return [];

  return Object.values(slices)
    .filter(slice => {
      if (slice.slice_id === Number[filterKey]) return false;
      const targetDatasource = datasources[slice.datasource];
      if (!targetDatasource) return false;
      if (targetDatasource === sourceDatasource) return true;

      return sourceDatasource.columns.some(sourceColumn =>
        targetDatasource.columns.some(
          targetColumn => sourceColumn.column_name === targetColumn.column_name,
        ),
      );
    })
    .map(slice => slice.slice_id);
}

export function getRelatedCharts(
  filters: Object,
  slices: Slice[],
  datasources: DatasourcesState,
) {
  return Object.entries(filters).reduce((acc, [filterKey, filter]) => {
    if (filter.filterType === 'filter_select') {
      return {
        ...acc,
        [filterKey]: getRelatedChartsForSelectFilter(
          filter,
          slices,
          datasources,
        ),
      };
    }
    if (filter.filterType === null) {
      return {
        ...acc,
        [filterKey]: getRelatedChartsForCrossFilter(
          filterKey,
          slices,
          datasources,
        ),
      };
    }
    return {
      ...acc,
      [filterKey]: filter.scope,
    };
  }, {});
}
