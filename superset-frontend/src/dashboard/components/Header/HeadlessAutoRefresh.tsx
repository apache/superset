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
import { bindActionCreators } from 'redux';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import {
  useDashboardInfo,
  useRefreshFrequency,
  setRefreshFrequency,
} from 'src/dashboard/stores';
import { onRefresh } from '../../actions/dashboardState';
import { logEvent } from '../../../logger/actions';
import { useHeaderAutoRefresh } from './useHeaderAutoRefresh';

/**
 * Headless component that drives the dashboard auto-refresh timer when the
 * dashboard header is not rendered (e.g. standalone mode or `hideTitle: true`
 * in embedded dashboards). The auto-refresh logic lives in the header, so
 * hiding the header would otherwise stop the refresh interval from ever
 * starting. Rendering this component keeps the timer running independently of
 * header visibility. It renders nothing.
 */
const HeadlessAutoRefresh = (): null => {
  const dispatch = useDispatch();
  const chartIds = useChartIds();
  // Auto-refresh config moved to the Zustand dashboard-info store; read it
  // through the domain hooks like the header does.
  const dashboardInfo = useDashboardInfo();
  const dashboardId = dashboardInfo.id;
  const refreshFrequency = useRefreshFrequency();
  const immuneSlices = dashboardInfo.metadata?.timed_refresh_immune_slices;
  const timedRefreshImmuneSlices = useMemo(
    () => immuneSlices || [],
    [immuneSlices],
  );
  const autoRefreshMode =
    dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_MODE;
  const isLoading = useSelector((state: RootState) =>
    Object.values(state.charts).some(chart => {
      const start = chart.chartUpdateStartTime ?? 0;
      const end = chart.chartUpdateEndTime ?? 0;
      return start > end;
    }),
  );

  const boundActionCreators = useMemo(
    () =>
      bindActionCreators(
        {
          onRefresh,
          logEvent,
        },
        dispatch,
      ),
    [dispatch],
  );

  useHeaderAutoRefresh({
    chartIds,
    dashboardId,
    refreshFrequency,
    timedRefreshImmuneSlices,
    autoRefreshMode,
    isLoading,
    onRefresh: boundActionCreators.onRefresh,
    setRefreshFrequency,
    logEvent: boundActionCreators.logEvent,
  });

  return null;
};

export default HeadlessAutoRefresh;
