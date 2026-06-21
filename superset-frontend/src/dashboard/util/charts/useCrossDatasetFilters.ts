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
import { useEffect, useState, useRef } from 'react';
import {
  FeatureFlag,
  isFeatureEnabled,
} from '@superset-ui/core';
import {
  filterTranslationEngine,
  FilterValue,
  TranslatedFilter,
} from 'src/features/datasets/relationships/filterTranslation';
import { getAllActiveFilters } from 'src/dashboard/util/activeAllDashboardFilters';
import { getChartIdAndColumnFromFilterKey } from 'src/dashboard/util/getDashboardFilterKey';
import type {
  ActiveFilters,
  ChartConfiguration,
  DataMaskStateWithId,
  PartialFilters,
} from 'src/dashboard/types';

/**
 * Determines which dataset a chart belongs to from its datasource key.
 * The datasource is formatted as "{datasetId}__{type}".
 */
function getDatasetIdFromDatasource(datasource: unknown): number | null {
  if (typeof datasource !== 'string') return null;
  const parts = datasource.split('__');
  const id = parseInt(parts[0], 10);
  return Number.isNaN(id) ? null : id;
}

/**
 * Hook that resolves cross-database filter translation for dashboard charts.
 *
 * When cross-dataset filters are enabled, this hook examines the active filters
 * on a chart, checks if the filter columns correspond to dataset relationships,
 * and for cross-database relationships, translates the filter values.
 *
 * Returns the translated filters that should be added as extra filters.
 */
export function useCrossDatasetFilters(
  chartId: number,
  datasource: unknown,
  chartConfiguration: ChartConfiguration | null,
  dataMask: DataMaskStateWithId,
  nativeFilters: PartialFilters,
  allSliceIds: number[],
): TranslatedFilter[] {
  const [translated, setTranslated] = useState<TranslatedFilter[]>([]);
  const lastKeyRef = useRef<string>('');
  const datasetId = getDatasetIdFromDatasource(datasource);
  const activeRelationships =
    chartConfiguration?.[chartId]?.activeRelationships;

  useEffect(() => {
    if (
      !isFeatureEnabled(FeatureFlag.DatasetRelationships) ||
      !datasetId ||
      !activeRelationships ||
      activeRelationships.length === 0
    ) {
      setTranslated([]);
      return;
    }

    const activeFilters: ActiveFilters = getAllActiveFilters({
      chartConfiguration: chartConfiguration ?? {},
      nativeFilters,
      dataMask,
      allSliceIds,
    });

    // Build the key for dedup — only re-resolve when active filters change
    const filterKey = Object.entries(activeFilters)
      .filter(([, f]) => f.scope.includes(chartId))
      .map(([id, f]) => `${id}:${JSON.stringify(f.values)}`)
      .join('|');

    if (filterKey === lastKeyRef.current) return;
    lastKeyRef.current = filterKey;

    let cancelled = false;

    (async () => {
      // Resolve active filters applied to this chart
      // ActiveFilters key format: "{sourceChartId}_{column}"
      const chartFilters = Object.entries(activeFilters)
        .filter(([key]) => {
          try {
            const { chartId: sourceChartId } = getChartIdAndColumnFromFilterKey(key);
            return sourceChartId === chartId;
          } catch {
            return false;
          }
        })
        .map(([key, f]) => {
          const { column } = getChartIdAndColumnFromFilterKey(key);
          return {
            column,
            datasetId: datasetId!,
            values: Array.isArray(f.values) ? f.values : [f.values],
          };
        });

      if (chartFilters.length === 0) {
        if (!cancelled) setTranslated([]);
        return;
      }

      const allTranslated: TranslatedFilter[] = [];

      for (const filter of chartFilters) {
        // Skip same-database: JOIN handles it
        const results = await filterTranslationEngine.translateFilter({
          column: filter.column,
          datasetId: datasetId!,
          values: filter.values,
          operator: 'IN',
        });

        // Only cross-database translations are relevant here
        allTranslated.push(
          ...results.filter(r => r.confidence !== 'exact'),
        );
      }

      if (!cancelled) {
        setTranslated(allTranslated);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [datasetId, activeRelationships, chartId, chartConfiguration, dataMask, nativeFilters, allSliceIds]);

  return translated;
}
