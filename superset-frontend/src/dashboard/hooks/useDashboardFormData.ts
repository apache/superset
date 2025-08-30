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

import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState, DashboardContextFormData } from '../types';
import { getExtraFormData } from '../components/nativeFilters/utils';
import { getAllActiveFilters } from '../util/activeAllDashboardFilters';

/**
 * Hook that provides dashboard context as formatted formData for charts.
 * This encapsulates all the complex logic for determining which dashboard
 * filters, colors, and other context should be applied to a specific chart.
 *
 * @param chartId - The ID of the chart to get dashboard context for
 * @returns Dashboard context formatted as QueryFormData fields
 */
export const useDashboardFormData = (
  chartId: number | null | undefined,
): DashboardContextFormData => {
  // Dashboard state selectors
  const dashboardId = useSelector<RootState, number>(
    ({ dashboardInfo }) => dashboardInfo.id,
  );

  const nativeFilters = useSelector(
    (state: RootState) => state.nativeFilters?.filters,
  );

  const dataMask = useSelector((state: RootState) => state.dataMask);

  const chartConfiguration = useSelector(
    (state: RootState) =>
      state.dashboardInfo.metadata?.chart_configuration || {},
  );

  const allSliceIds = useSelector(
    (state: RootState) => state.dashboardState.sliceIds,
  );

  // Compute dashboard context for the chart
  return useMemo((): DashboardContextFormData => {
    const baseContext: DashboardContextFormData = { dashboardId };

    // Early return if we don't have required data or chartId
    if (
      !chartId ||
      !nativeFilters ||
      !dataMask ||
      !chartConfiguration ||
      !allSliceIds
    ) {
      return baseContext;
    }

    // Get active filters using the same logic as normal dashboard charts
    const activeFilters = getAllActiveFilters({
      chartConfiguration,
      nativeFilters,
      dataMask,
      allSliceIds,
    });

    // Find which filters apply to this specific chart
    const filterIdsAppliedOnChart = Object.entries(activeFilters)
      .filter(([, activeFilter]) => activeFilter.scope.includes(chartId))
      .map(([filterId]) => filterId);

    // If no filters apply, return just the base context
    if (filterIdsAppliedOnChart.length === 0) {
      return baseContext;
    }

    // Get the extra form data from dashboard filters
    const extraFormData = getExtraFormData(dataMask, filterIdsAppliedOnChart);

    return {
      ...baseContext,
      extra_form_data: extraFormData,
      // TODO: Add other dashboard context like color schemes when needed
    };
  }, [
    chartId,
    dashboardId,
    nativeFilters,
    dataMask,
    chartConfiguration,
    allSliceIds,
  ]);
};
