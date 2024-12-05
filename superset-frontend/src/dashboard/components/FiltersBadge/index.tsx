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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
  memo,
} from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { uniqWith } from 'lodash';
import cx from 'classnames';
import {
  DataMaskStateWithId,
  Filters,
  JsonObject,
  styled,
  t,
  usePrevious,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import { useChartLayoutItems } from 'src/dashboard/util/useChartLayoutItems';
import Badge from 'src/components/Badge';
import DetailsPanelPopover from './DetailsPanel';
import {
  Indicator,
  IndicatorStatus,
  selectIndicatorsForChart,
  selectNativeIndicatorsForChart,
} from '../nativeFilters/selectors';
import { Chart, RootState } from '../../types';

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
    &:focus-visible {
      outline: 2px solid ${theme.colors.primary.dark2};
    }
  `}
`;

const StyledBadge = styled(Badge)`
  ${({ theme }) => `
    margin-left: ${theme.gridUnit * 2}px;
    &>sup.antd5-badge-count {
      padding: 0 ${theme.gridUnit}px;
      min-width: ${theme.gridUnit * 4}px;
      height: ${theme.gridUnit * 4}px;
      line-height: 1.5;
      font-weight: ${theme.typography.weights.medium};
      font-size: ${theme.typography.sizes.s - 1}px;
      box-shadow: none;
      padding: 0 ${theme.gridUnit}px;
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
  const [popoverVisible, setPopoverVisible] = useState(false);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  const popoverTriggerRef = useRef<HTMLDivElement>(null);

  const onHighlightFilterSource = useCallback(
    (path: string[]) => {
      dispatch(setDirectPathToChild(path));
    },
    [dispatch],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      setPopoverVisible(true);
    }
  };

  const prevChart = usePrevious(chart);
  const prevChartStatus = prevChart?.chartStatus;
  const prevDashboardFilters = usePrevious(dashboardFilters);
  const prevDatasources = usePrevious(datasources);
  const showIndicators =
    chart?.chartStatus && ['rendered', 'success'].includes(chart.chartStatus);

  useEffect(() => {
    if (popoverVisible) {
      setTimeout(() => {
        popoverContentRef?.current?.focus({ preventScroll: true });
      });
    }
  }, [popoverVisible]);

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

  if (!appliedCrossFilterIndicators.length && !appliedIndicators.length) {
    return null;
  }

  return (
    <DetailsPanelPopover
      appliedCrossFilterIndicators={appliedCrossFilterIndicators}
      appliedIndicators={appliedIndicators}
      onHighlightFilterSource={onHighlightFilterSource}
      setPopoverVisible={setPopoverVisible}
      popoverVisible={popoverVisible}
      popoverContentRef={popoverContentRef}
      popoverTriggerRef={popoverTriggerRef}
    >
      <StyledFilterCount
        aria-label={t('Applied filters (%s)', filterCount)}
        aria-haspopup="true"
        role="button"
        ref={popoverTriggerRef}
        className={cx(
          'filter-counts',
          !!appliedCrossFilterIndicators.length && 'has-cross-filters',
        )}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <Icons.Filter iconSize="m" />
        <StyledBadge
          data-test="applied-filter-count"
          className="applied-count"
          count={filterCount}
          showZero
        />
      </StyledFilterCount>
    </DetailsPanelPopover>
  );
};

export default memo(FiltersBadge);
