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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { uniqWith } from 'lodash';
import cx from 'classnames';
import Icons from 'src/components/Icons';
import { usePrevious } from 'src/common/hooks/usePrevious';
import { DataMaskStateWithId } from 'src/dataMask/types';
import DetailsPanelPopover from './DetailsPanel';
import { Pill } from './Styles';
import {
  Indicator,
  IndicatorStatus,
  selectIndicatorsForChart,
  selectNativeIndicatorsForChart,
} from './selectors';
import { setDirectPathToChild } from '../../actions/dashboardState';
import {
  ChartsState,
  DashboardInfo,
  DashboardLayout,
  RootState,
} from '../../types';
import { Filters } from '../../reducers/types';

export interface FiltersBadgeProps {
  chartId: number;
}

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

export const FiltersBadge = ({ chartId }: FiltersBadgeProps) => {
  const dispatch = useDispatch();
  const datasources = useSelector<RootState, any>(state => state.datasources);
  const dashboardFilters = useSelector<RootState, any>(
    state => state.dashboardFilters,
  );
  const nativeFilters = useSelector<RootState, Filters>(
    state => state.nativeFilters?.filters,
  );
  const dashboardInfo = useSelector<RootState, DashboardInfo>(
    state => state.dashboardInfo,
  );
  const charts = useSelector<RootState, ChartsState>(state => state.charts);
  const present = useSelector<RootState, DashboardLayout>(
    state => state.dashboardLayout.present,
  );
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );

  const [nativeIndicators, setNativeIndicators] = useState<Indicator[]>(
    indicatorsInitialState,
  );
  const [dashboardIndicators, setDashboardIndicators] = useState<Indicator[]>(
    indicatorsInitialState,
  );

  const onHighlightFilterSource = useCallback(
    (path: string[]) => {
      dispatch(setDirectPathToChild(path));
    },
    [dispatch],
  );

  const chart = charts[chartId];
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
  const prevDashboardLayout = usePrevious(present);
  const prevDataMask = usePrevious(dataMask);
  const prevChartConfig = usePrevious(
    dashboardInfo.metadata?.chart_configuration,
  );
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
        present !== prevDashboardLayout ||
        dataMask !== prevDataMask ||
        prevChartConfig !== dashboardInfo.metadata?.chart_configuration
      ) {
        setNativeIndicators(
          selectNativeIndicatorsForChart(
            nativeFilters,
            dataMask,
            chartId,
            chart,
            present,
            dashboardInfo.metadata?.chart_configuration,
          ),
        );
      }
    }
  }, [
    chart,
    chartId,
    dashboardInfo.metadata?.chart_configuration,
    dataMask,
    nativeFilters,
    nativeIndicators.length,
    present,
    prevChart?.queriesResponse,
    prevChartConfig,
    prevChartStatus,
    prevDashboardLayout,
    prevDataMask,
    prevNativeFilters,
    showIndicators,
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
  const unsetIndicators = useMemo(
    () =>
      indicators.filter(
        indicator => indicator.status === IndicatorStatus.Unset,
      ),
    [indicators],
  );
  const incompatibleIndicators = useMemo(
    () =>
      indicators.filter(
        indicator => indicator.status === IndicatorStatus.Incompatible,
      ),
    [indicators],
  );

  if (
    !appliedCrossFilterIndicators.length &&
    !appliedIndicators.length &&
    !incompatibleIndicators.length &&
    !unsetIndicators.length
  ) {
    return null;
  }

  const isInactive =
    !appliedCrossFilterIndicators.length &&
    !appliedIndicators.length &&
    !incompatibleIndicators.length;

  return (
    <DetailsPanelPopover
      appliedCrossFilterIndicators={appliedCrossFilterIndicators}
      appliedIndicators={appliedIndicators}
      unsetIndicators={unsetIndicators}
      incompatibleIndicators={incompatibleIndicators}
      onHighlightFilterSource={onHighlightFilterSource}
    >
      <Pill
        className={cx(
          'filter-counts',
          !!incompatibleIndicators.length && 'has-incompatible-filters',
          !!appliedCrossFilterIndicators.length && 'has-cross-filters',
          isInactive && 'filters-inactive',
        )}
      >
        <Icons.Filter iconSize="m" />
        {!isInactive && (
          <span data-test="applied-filter-count">
            {appliedIndicators.length + appliedCrossFilterIndicators.length}
          </span>
        )}
        {incompatibleIndicators.length ? (
          <>
            {' '}
            <Icons.AlertSolid />
            <span data-test="incompatible-filter-count">
              {incompatibleIndicators.length}
            </span>
          </>
        ) : null}
      </Pill>
    </DetailsPanelPopover>
  );
};

export default React.memo(FiltersBadge);
