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

import { DataMaskStateWithId, JsonObject, logging } from '@superset-ui/core';
import { isEmpty, isEqual } from 'lodash';
import { NATIVE_FILTER_PREFIX } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/utils';
import {
  hasChartStateConverter,
  convertChartStateToOwnState,
} from 'src/dashboard/util/chartStateConverter';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { getAppliedFilterValues } from 'src/dashboard/util/activeDashboardFilters';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import { RootState } from 'src/views/store';

export const getDataMaskChangeTrigger = (
  dataMask: DataMaskStateWithId,
  previousDataMask: DataMaskStateWithId,
) => {
  let crossFiltersChanged = false;
  let nativeFiltersChanged = false;

  if (!isEmpty(dataMask) && !isEmpty(previousDataMask)) {
    for (const key in dataMask) {
      if (
        key.startsWith(NATIVE_FILTER_PREFIX) &&
        !isEqual(dataMask[key], previousDataMask[key])
      ) {
        nativeFiltersChanged = true;
        break;
      } else if (!isEqual(dataMask[key], previousDataMask[key])) {
        crossFiltersChanged = true;
        break;
      }
    }
  }
  return { crossFiltersChanged, nativeFiltersChanged };
};

/**
 * Get query context payloads for stateful charts only (e.g., AG Grid tables).
 * Returns payloads only for charts that have registered state converters.
 * Non-stateful charts will not be included in the result.
 *
 * These payloads include dashboard filters and chart state (sorting, column order, etc.)
 * and can be POSTed directly to /api/v1/chart/data for CSV export.
 *
 * If payload generation fails for a chart, an error object will be returned for that chart
 * containing `{ error: true, message: string }`, allowing other charts to process successfully.
 *
 * @param state - Redux store state
 * @param chartId - Optional chart ID to get payload for a specific chart only
 * @returns Record of chart IDs to their query context payloads (only for stateful charts).
 *          Failed charts will have an error object instead of a valid payload.
 */
export const getChartDataPayloads = async (
  state: RootState,
  params?: {
    chartId?: number;
  },
): Promise<Record<string, JsonObject>> => {
  const { chartId } = params || {};

  const charts = state.charts || {};
  const sliceEntities = state.sliceEntities?.slices || {};
  const dataMask = state.dataMask || {};
  const chartStates = state.dashboardState?.chartStates || {};
  const chartConfiguration =
    state.dashboardInfo?.metadata?.chart_configuration || {};
  const nativeFilters = state.nativeFilters?.filters || {};
  const allSliceIds = state.dashboardState?.sliceIds || [];
  const colorScheme = state.dashboardState?.colorScheme;
  const colorNamespace = state.dashboardState?.colorNamespace;

  const chartEntries = Object.entries(charts).filter(([id]) => {
    const numericId = Number(id);
    const slice = sliceEntities[id];

    if (!slice || !hasChartStateConverter(slice.viz_type)) {
      return false;
    }

    if (chartId !== undefined && numericId !== chartId) {
      return false;
    }

    return true;
  });

  const payloadPromises = chartEntries.map(async ([id, chart]) => {
    const numericId = Number(id);
    const slice = sliceEntities[id];

    try {
      if (!chart || typeof chart !== 'object' || !('form_data' in chart)) {
        throw new Error(`Chart ${id} is missing form_data`);
      }

      const formData = getFormDataWithExtraFilters({
        chart: { id: numericId, form_data: (chart as JsonObject).form_data },
        chartConfiguration,
        filters: getAppliedFilterValues(numericId),
        colorScheme,
        colorNamespace,
        sliceId: numericId,
        nativeFilters,
        allSliceIds,
        dataMask,
        extraControls: {},
      });

      const chartState = chartStates[id]?.state;
      const baseOwnState = dataMask[id]?.ownState || {};
      const convertedState = chartState
        ? convertChartStateToOwnState(slice.viz_type, chartState)
        : {};

      const ownState = {
        ...baseOwnState,
        ...convertedState,
      };

      const payload = await buildV1ChartDataPayload({
        formData,
        resultFormat: 'json',
        resultType: 'results',
        ownState,
        setDataMask: null,
        force: false,
      });

      return [id, payload] as const;
    } catch (error) {
      logging.error(`Failed to build payload for chart ${id}:`, error);
      return [
        id,
        {
          error: true,
          message: error instanceof Error ? error.message : String(error),
        },
      ] as const;
    }
  });

  const results = await Promise.all(payloadPromises);
  const payloads = Object.fromEntries(results);

  if (chartId !== undefined && Object.keys(payloads).length === 0) {
    logging.warn(
      `Chart ${chartId} not found or is not a stateful chart with a registered state converter`,
    );
    return {
      [chartId]: {
        error: true,
        message: `Chart ${chartId} not found or is not a stateful chart`,
      },
    };
  }

  return payloads;
};
