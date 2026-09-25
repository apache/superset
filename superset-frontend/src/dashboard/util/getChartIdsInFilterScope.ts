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
import { NativeFilterScope } from '@superset-ui/core';
import { CHART_TYPE } from './componentTypes';
import { LayoutItem } from '../types';

interface ExtendedNativeFilterScope extends NativeFilterScope {
  selectedLayers?: string[];
}

export type ChartLayoutItemMap = ReadonlyMap<number, readonly LayoutItem[]>;
export type ChartLayoutItems = readonly LayoutItem[] | ChartLayoutItemMap;

const isChartLayoutItemArray = (
  chartLayoutItems: ChartLayoutItems,
): chartLayoutItems is readonly LayoutItem[] => Array.isArray(chartLayoutItems);

export function createChartLayoutItemMap(
  layoutItems: readonly (LayoutItem | null | undefined)[],
): ChartLayoutItemMap {
  const chartLayoutItemMap = new Map<number, LayoutItem[]>();

  layoutItems.forEach(layoutItem => {
    const chartId = layoutItem?.meta?.chartId;
    if (layoutItem?.type === CHART_TYPE && typeof chartId === 'number') {
      const chartLayoutItems = chartLayoutItemMap.get(chartId);
      if (chartLayoutItems) {
        chartLayoutItems.push(layoutItem);
      } else {
        chartLayoutItemMap.set(chartId, [layoutItem]);
      }
    }
  });

  return chartLayoutItemMap;
}

export function getChartLayoutItemMap(
  chartLayoutItems: ChartLayoutItems,
): ChartLayoutItemMap {
  if (isChartLayoutItemArray(chartLayoutItems)) {
    return createChartLayoutItemMap(chartLayoutItems);
  }
  return chartLayoutItems;
}

export function getChartIdsInFilterScope(
  filterScope: ExtendedNativeFilterScope,
  chartIds: number[],
  chartLayoutItems: ChartLayoutItems,
): number[] {
  const chartLayoutItemMap = getChartLayoutItemMap(chartLayoutItems);
  const excludedChartIds = new Set(filterScope.excluded);
  const rootPath = new Set(filterScope.rootPath);
  const isChartInScope = (chartId: number) =>
    !excludedChartIds.has(chartId) &&
    chartLayoutItemMap
      .get(chartId)
      ?.some(layoutItem =>
        layoutItem.parents?.some(elementId => rootPath.has(elementId)),
      );

  if (filterScope.selectedLayers && filterScope.selectedLayers.length > 0) {
    const targetChartIds: number[] = [];
    const targetChartIdSet = new Set<number>();
    const chartIdSet = new Set(chartIds);
    const chartsWithLayerSelections = new Set<number>();

    filterScope.selectedLayers.forEach(selectionKey => {
      const layerMatch = selectionKey.match(/^chart-(\d+)-layer-(\d+)$/);
      if (layerMatch) {
        const chartId = parseInt(layerMatch[1], 10);
        chartsWithLayerSelections.add(chartId);
        if (chartIdSet.has(chartId) && !targetChartIdSet.has(chartId)) {
          targetChartIds.push(chartId);
          targetChartIdSet.add(chartId);
        }
      }
    });

    const regularChartIds = chartIds.filter(
      chartId =>
        !chartsWithLayerSelections.has(chartId) && isChartInScope(chartId),
    );

    regularChartIds.forEach(chartId => {
      if (!targetChartIdSet.has(chartId)) {
        targetChartIds.push(chartId);
        targetChartIdSet.add(chartId);
      }
    });
    return targetChartIds;
  }

  return chartIds.filter(isChartInScope);
}
