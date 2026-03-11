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

export function getChartIdsInFilterScope(
  filterScope: ExtendedNativeFilterScope,
  chartIds: number[],
  layoutItems: LayoutItem[],
): number[] {
  if (filterScope.selectedLayers && filterScope.selectedLayers.length > 0) {
    const targetChartIds: number[] = [];

    filterScope.selectedLayers.forEach(selectionKey => {
      const layerMatch = selectionKey.match(/^chart-(\d+)-layer-(\d+)$/);
      if (layerMatch) {
        const chartId = parseInt(layerMatch[1], 10);
        if (chartIds.includes(chartId) && !targetChartIds.includes(chartId)) {
          targetChartIds.push(chartId);
        }
      }
    });
    const chartsWithLayerSelections = new Set<number>();
    filterScope.selectedLayers.forEach(selectionKey => {
      const layerMatch = selectionKey.match(/^chart-(\d+)-layer-(\d+)$/);
      if (layerMatch) {
        chartsWithLayerSelections.add(parseInt(layerMatch[1], 10));
      }
    });

    const regularChartIds = chartIds.filter(
      chartId =>
        !filterScope.excluded.includes(chartId) &&
        !chartsWithLayerSelections.has(chartId) &&
        layoutItems
          .find(
            layoutItem =>
              layoutItem?.type === CHART_TYPE &&
              layoutItem.meta?.chartId === chartId,
          )
          ?.parents?.some(elementId =>
            filterScope.rootPath.includes(elementId),
          ),
    );

    regularChartIds.forEach(chartId => {
      if (!targetChartIds.includes(chartId)) {
        targetChartIds.push(chartId);
      }
    });
    return targetChartIds;
  }

  const traditionalResult = chartIds.filter(
    chartId =>
      !filterScope.excluded.includes(chartId) &&
      layoutItems
        .find(
          layoutItem =>
            layoutItem?.type === CHART_TYPE &&
            layoutItem.meta?.chartId === chartId,
        )
        ?.parents?.some(elementId => filterScope.rootPath.includes(elementId)),
  );

  return traditionalResult;
}
