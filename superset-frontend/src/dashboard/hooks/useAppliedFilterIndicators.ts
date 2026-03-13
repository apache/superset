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
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { uniqWith } from 'lodash';
import {
  DataMaskStateWithId,
  Filters,
  JsonObject,
  usePrevious,
} from '@superset-ui/core';
import { useChartLayoutItems } from 'src/dashboard/util/useChartLayoutItems';
import {
  Indicator,
  IndicatorStatus,
  selectIndicatorsForChart,
  selectNativeIndicatorsForChart,
} from 'src/dashboard/components/nativeFilters/selectors';
import { Chart, RootState } from 'src/dashboard/types';

const sortByStatus = (indicators: Indicator[]): Indicator[] => {
  const statuses = [
    IndicatorStatus.Applied,
    IndicatorStatus.Unset,
    IndicatorStatus.Incompatible,
  ];
  return indicators.sort(
    (a, b) =>
      statuses.indexOf(a.status as IndicatorStatus) -
      statuses.indexOf(b.status as IndicatorStatus),
  );
};

const indicatorsInitialState: Indicator[] = [];

export interface AppliedFilterIndicators {
  appliedIndicators: Indicator[];
  appliedCrossFilterIndicators: Indicator[];
  filterCount: number;
}

/**
 * Hook to get applied filter indicators for a specific chart.
 * Extracts the filter indicator logic from FiltersBadge for reuse.
 */
export const useAppliedFilterIndicators = (
  chartId: number,
): AppliedFilterIndicators => {
  // Using 'any' type for these selectors to match FiltersBadge implementation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const datasources = useSelector<RootState, any>(state => state.datasources);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dashboardFilters = useSelector<RootState, any>(
    state => state.dashboardFilters,
  );
  const nativeFilters = useSelector<RootState, Filters>(
    state => state.nativeFilters?.filters,
  );
  const chartConfiguration = useSelector<RootState, JsonObject>(
    state => state.dashboardInfo.metadata?.chart_configuration,
  );
  const chart = useSelector<RootState, Chart>(state => state.charts[chartId]);
  const chartLayoutItems = useChartLayoutItems();
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );

  const [nativeIndicators, setNativeIndicators] = useState<Indicator[]>(
    indicatorsInitialState,
  );
  const [dashboardIndicators, setDashboardIndicators] = useState<Indicator[]>(
    indicatorsInitialState,
  );

  const prevChart = usePrevious(chart);
  const prevChartStatus = prevChart?.chartStatus;
  const prevDashboardFilters = usePrevious(dashboardFilters);
  const prevDatasources = usePrevious(datasources);
  const showIndicators =
    chart?.chartStatus && ['rendered', 'success'].includes(chart.chartStatus);

  useEffect(() => {
    if (!showIndicators && dashboardIndicators.length > 0) {
      setDashboardIndicators(indicatorsInitialState);
    } else if (prevChartStatus !== 'success') {
      if (
        chart?.queriesResponse?.[0]?.rejected_filters !==
          prevChart?.queriesResponse?.[0]?.rejected_filters ||
        chart?.queriesResponse?.[0]?.applied_filters !==
          prevChart?.queriesResponse?.[0]?.applied_filters ||
        dashboardFilters !== prevDashboardFilters ||
        datasources !== prevDatasources
      ) {
        setDashboardIndicators(
          selectIndicatorsForChart(
            chartId,
            dashboardFilters,
            datasources,
            chart,
          ),
        );
      }
    }
  }, [
    chart,
    chartId,
    dashboardFilters,
    dashboardIndicators.length,
    datasources,
    prevChart?.queriesResponse,
    prevChartStatus,
    prevDashboardFilters,
    prevDatasources,
    showIndicators,
  ]);

  const prevNativeFilters = usePrevious(nativeFilters);
  const prevChartLayoutItems = usePrevious(chartLayoutItems);
  const prevDataMask = usePrevious(dataMask);
  const prevChartConfig = usePrevious(chartConfiguration);

  useEffect(() => {
    if (!showIndicators && nativeIndicators.length > 0) {
      setNativeIndicators(indicatorsInitialState);
    } else if (prevChartStatus !== 'success') {
      if (
        chart?.queriesResponse?.[0]?.rejected_filters !==
          prevChart?.queriesResponse?.[0]?.rejected_filters ||
        chart?.queriesResponse?.[0]?.applied_filters !==
          prevChart?.queriesResponse?.[0]?.applied_filters ||
        nativeFilters !== prevNativeFilters ||
        chartLayoutItems !== prevChartLayoutItems ||
        dataMask !== prevDataMask ||
        prevChartConfig !== chartConfiguration
      ) {
        setNativeIndicators(
          selectNativeIndicatorsForChart(
            nativeFilters,
            dataMask,
            chartId,
            chart,
            chartLayoutItems,
            chartConfiguration,
          ),
        );
      }
    }
  }, [
    chart,
    chartId,
    chartConfiguration,
    dataMask,
    nativeFilters,
    nativeIndicators.length,
    prevChart?.queriesResponse,
    prevChartConfig,
    prevChartStatus,
    prevDataMask,
    prevNativeFilters,
    showIndicators,
    chartLayoutItems,
    prevChartLayoutItems,
  ]);

  const indicators = useMemo(
    () =>
      uniqWith(
        sortByStatus([...dashboardIndicators, ...nativeIndicators]),
        (ind1, ind2) =>
          ind1.column === ind2.column &&
          ind1.name === ind2.name &&
          (ind1.status !== IndicatorStatus.Applied ||
            ind2.status !== IndicatorStatus.Applied),
      ),
    [dashboardIndicators, nativeIndicators],
  );

  const appliedCrossFilterIndicators = useMemo(
    () =>
      indicators.filter(
        indicator => indicator.status === IndicatorStatus.CrossFilterApplied,
      ),
    [indicators],
  );

  const appliedIndicators = useMemo(
    () =>
      indicators.filter(
        indicator => indicator.status === IndicatorStatus.Applied,
      ),
    [indicators],
  );

  const filterCount =
    appliedIndicators.length + appliedCrossFilterIndicators.length;

  return {
    appliedIndicators,
    appliedCrossFilterIndicators,
    filterCount,
  };
};

export default useAppliedFilterIndicators;
