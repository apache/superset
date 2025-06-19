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
  PartialFilters,
  JsonObject,
  DataMaskWithId,
} from '@superset-ui/core';
import { ActiveFilters, ChartConfiguration } from '../types';

export const getRelevantDataMask = (
  dataMask: DataMaskStateWithId,
  filterId: string,
): DataMaskStateWithId =>
  dataMask[filterId] ? { [filterId]: dataMask[filterId] } : {};

const extractLayerIndicesFromKeys = (
  selectedLayers: string[],
): { [chartId: number]: number[] } => {
  const layerMap: { [chartId: number]: number[] } = {};
  selectedLayers.forEach(layerKey => {
    const match = layerKey.match(/^chart-(\d+)-layer-(\d+)$/);
    if (match) {
      const chartId = parseInt(match[1], 10);
      const layerIndex = parseInt(match[2], 10);
      if (!layerMap[chartId]) {
        layerMap[chartId] = [];
      }
      layerMap[chartId].push(layerIndex);
    }
  });
  return layerMap;
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

  Object.values(dataMask).forEach(({ id: filterId, extraFormData = {} }) => {
    const scope =
      nativeFilters?.[filterId]?.chartsInScope ??
      chartConfiguration?.[parseInt(filterId, 10)]?.crossFilters
        ?.chartsInScope ??
      allSliceIds ??
      [];
    const filterType = nativeFilters?.[filterId]?.filterType;
    const targets = nativeFilters?.[filterId]?.targets;

    const selectedLayers = (nativeFilters?.[filterId]?.scope as any)
      ?.selectedLayers;

    let layerScope;
    if (selectedLayers && selectedLayers.length > 0) {
      layerScope = extractLayerIndicesFromKeys(selectedLayers);
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
