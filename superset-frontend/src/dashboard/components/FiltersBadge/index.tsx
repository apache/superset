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
import {
  DataMaskStateWithId,
  Filters,
  JsonObject,
  styled,
  usePrevious,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import Badge from 'src/components/Badge';
import DetailsPanelPopover from './DetailsPanel';
import {
  Indicator,
  IndicatorStatus,
  selectIndicatorsForChart,
  selectNativeIndicatorsForChart,
} from '../nativeFilters/selectors';
import { Chart, DashboardLayout, RootState } from '../../types';

export interface FiltersBadgeProps {
  chartId: number;
}

const StyledFilterCount = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-items: center;
    align-items: center;
    cursor: pointer;
    margin-right: ${theme.gridUnit}px;
    padding-left: ${theme.gridUnit * 2}px;
    padding-right: ${theme.gridUnit * 2}px;
    background: ${theme.colors.grayscale.light4};
    border-radius: 4px;
    height: 100%;
    .anticon {
      vertical-align: middle;
      color: ${theme.colors.grayscale.base};
      &:hover {
        color: ${theme.colors.grayscale.light1};
      }
    }

    .incompatible-count {
      font-size: ${theme.typography.sizes.s}px;
    }
  `}
`;

const StyledBadge = styled(Badge)`
  ${({ theme }) => `
    vertical-align: middle;
    margin-left: ${theme.gridUnit * 2}px;
    &>sup {
      padding: 0 ${theme.gridUnit}px;
      min-width: ${theme.gridUnit * 4}px;
      height: ${theme.gridUnit * 4}px;
      line-height: 1.5;
      font-weight: ${theme.typography.weights.medium};
      font-size: ${theme.typography.sizes.s - 1}px;
      box-shadow: none;
    }
  `}
`;

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
  const chartConfiguration = useSelector<RootState, JsonObject>(
    state => state.dashboardInfo.metadata?.chart_configuration,
  );
  const chart = useSelector<RootState, Chart>(state => state.charts[chartId]);
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
        present !== prevDashboardLayout ||
        dataMask !== prevDataMask ||
        prevChartConfig !== chartConfiguration
      ) {
        setNativeIndicators(
          selectNativeIndicatorsForChart(
            nativeFilters,
            dataMask,
            chartId,
            chart,
            present,
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

  if (!appliedCrossFilterIndicators.length && !appliedIndicators.length) {
    return null;
  }

  return (
    <DetailsPanelPopover
      appliedCrossFilterIndicators={appliedCrossFilterIndicators}
      appliedIndicators={appliedIndicators}
      onHighlightFilterSource={onHighlightFilterSource}
    >
      <StyledFilterCount
        className={cx(
          'filter-counts',
          !!appliedCrossFilterIndicators.length && 'has-cross-filters',
        )}
      >
        <Icons.Filter iconSize="m" />
        <StyledBadge
          data-test="applied-filter-count"
          className="applied-count"
          count={appliedIndicators.length + appliedCrossFilterIndicators.length}
          showZero
        />
      </StyledFilterCount>
    </DetailsPanelPopover>
  );
};

export default React.memo(FiltersBadge);
