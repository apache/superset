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
  DataMaskStateWithId,
  DataMaskWithId,
  JsonObject,
  PartialFilters,
} from '@superset-ui/core';
import { ActiveFilters, ChartConfiguration } from '../types';

export const getRelevantDataMask = (
  dataMask: DataMaskStateWithId,
  prop: keyof DataMaskWithId,
): JsonObject =>
  Object.fromEntries(
    Object.values(dataMask)
      .filter(item => item[prop])
      .map(item => [item.id, item[prop]]),
  );

interface LayerInfo {
  layerMap: { [chartId: number]: number[] };
  chartIds: Set<number>;
}

const extractLayerIndicesFromKeys = (selectedLayers: string[]): LayerInfo => {
  const layerMap: { [chartId: number]: number[] } = {};
  const chartIds = new Set<number>();
  selectedLayers.forEach(layerKey => {
    const match = layerKey.match(/^chart-(\d+)-layer-(\d+)$/);
    if (match) {
      const chartId = parseInt(match[1], 10);
      const layerIndex = parseInt(match[2], 10);
      if (!Number.isNaN(chartId)) {
        if (!layerMap[chartId]) {
          layerMap[chartId] = [];
        }
        layerMap[chartId].push(layerIndex);
        chartIds.add(chartId);
      }
    }
  });
  return { layerMap, chartIds };
};

export const getAllActiveFilters = ({
  chartConfiguration,
  nativeFilters,
  dataMask,
  allSliceIds,
}: {
  chartConfiguration: ChartConfiguration;
  dataMask: DataMaskStateWithId;
  nativeFilters: PartialFilters;
  allSliceIds: number[];
}): ActiveFilters => {
  const activeFilters: ActiveFilters = {};

  const hasLayerSelectionsInAnyFilter = Object.values(dataMask).some(
    ({ id: filterId }) => {
      const selectedLayers = (nativeFilters?.[filterId]?.scope as any)
        ?.selectedLayers;
      return selectedLayers && selectedLayers.length > 0;
    },
  );

  let masterSelectedLayers: string[] = [];
  let masterExcluded: number[] = [];
  if (hasLayerSelectionsInAnyFilter) {
    Object.values(dataMask).forEach(({ id: filterId }) => {
      const selectedLayers = (nativeFilters?.[filterId]?.scope as any)
        ?.selectedLayers;
      const excluded =
        (nativeFilters?.[filterId]?.scope as any)?.excluded || [];
      if (selectedLayers && selectedLayers.length > 0) {
        masterSelectedLayers = selectedLayers;
        masterExcluded = excluded;
      }
    });
  }

  Object.values(dataMask).forEach(({ id: filterId, extraFormData = {} }) => {
    let scope =
      nativeFilters?.[filterId]?.chartsInScope ??
      chartConfiguration?.[parseInt(filterId, 10)]?.crossFilters
        ?.chartsInScope ??
      allSliceIds ??
      [];
    const filterType = nativeFilters?.[filterId]?.filterType;
    const targets = nativeFilters?.[filterId]?.targets;

    let selectedLayers = (nativeFilters?.[filterId]?.scope as any)
      ?.selectedLayers;
    let excludedCharts =
      (nativeFilters?.[filterId]?.scope as any)?.excluded || [];

    if (
      hasLayerSelectionsInAnyFilter &&
      (!selectedLayers || selectedLayers.length === 0)
    ) {
      selectedLayers = masterSelectedLayers;
      excludedCharts = masterExcluded;
    }

    let layerScope;
    if (selectedLayers && selectedLayers.length > 0) {
      const layerInfo = extractLayerIndicesFromKeys(selectedLayers);
      layerScope = layerInfo.layerMap;

      const explicitlyTargetedCharts = new Set<number>(layerInfo.chartIds);

      const originalScope = scope;
      originalScope.forEach((chartId: number) => {
        if (!excludedCharts.includes(chartId)) {
          const hasLayerSelections = selectedLayers.some((key: string) =>
            key.startsWith(`chart-${chartId}-layer-`),
          );

          if (!hasLayerSelections) {
            explicitlyTargetedCharts.add(chartId);
          }
        }
      });

      scope = Array.from(explicitlyTargetedCharts);
    } else {
      scope = scope.filter(
        (chartId: number) => !excludedCharts.includes(chartId),
      );
    }

    activeFilters[filterId] = {
      scope,
      targets: targets || [],
      values: extraFormData,
      filterType,
      ...(layerScope && { layerScope }),
    };
  });

  return activeFilters;
};
