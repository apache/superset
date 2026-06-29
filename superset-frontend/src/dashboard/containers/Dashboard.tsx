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
import { useMemo, type ReactNode } from 'react';
import { bindActionCreators } from 'redux';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import type { JsonObject } from '@superset-ui/core';
import Dashboard from 'src/dashboard/components/Dashboard';
import {
  addSliceToDashboard,
  removeSliceFromDashboard,
} from 'src/dashboard/actions/dashboardState';
import { setDatasources } from 'src/dashboard/actions/datasources';
import { triggerQuery } from 'src/components/Chart/chartAction';
import { logEvent } from 'src/logger/actions';
import { clearDataMaskState } from '../../dataMask/actions';
import type { ActiveFilters, RootState } from 'src/dashboard/types';
import {
  useDashboardStateStore,
  useDashboardLayoutStore,
  useDashboardSlicesStore,
  useDashboardInfoStore,
} from 'src/dashboard/stores';
import { useUnloadPrompt } from 'src/dashboard/hooks/useUnloadPrompt';

interface DashboardContainerProps {
  activeFilters: ActiveFilters;
  ownDataCharts: JsonObject;
  children?: ReactNode;
}

export default function DashboardContainer({
  activeFilters,
  ownDataCharts,
  children,
}: DashboardContainerProps) {
  const dispatch = useDispatch();
  const editMode = useDashboardStateStore(s => s.editMode);
  const isPublished = useDashboardStateStore(s => s.isPublished);
  const hasUnsavedChanges = useDashboardStateStore(s => s.hasUnsavedChanges);
  useUnloadPrompt(hasUnsavedChanges);

  const layout = useDashboardLayoutStore(s => s.layout);
  const slices = useDashboardSlicesStore(s => s.slices);
  const timeout = useDashboardInfoStore(
    s => s.dashboardInfo.common?.conf?.SUPERSET_WEBSERVER_TIMEOUT,
  );
  const userId = useDashboardInfoStore(s => s.dashboardInfo.userId);
  const dashboardId = useDashboardInfoStore(s => s.dashboardInfo.id);
  const chartConfiguration = useDashboardInfoStore(
    s => s.dashboardInfo.metadata?.chart_configuration,
  );
  const { datasources, impressionId } = useSelector(
    (state: RootState) => ({
      datasources: state.datasources,
      impressionId: state.impressionId,
    }),
    shallowEqual,
  );

  const actions = useMemo(
    () =>
      bindActionCreators(
        {
          setDatasources,
          clearDataMaskState,
          addSliceToDashboard,
          removeSliceFromDashboard,
          triggerQuery,
          logEvent,
        },
        dispatch,
      ),
    [dispatch],
  );

  return (
    <Dashboard
      timeout={timeout}
      userId={userId}
      dashboardId={dashboardId}
      editMode={editMode}
      isPublished={isPublished ?? undefined}
      hasUnsavedChanges={hasUnsavedChanges}
      datasources={datasources}
      chartConfiguration={chartConfiguration}
      slices={slices}
      layout={layout}
      impressionId={impressionId}
      activeFilters={activeFilters}
      ownDataCharts={ownDataCharts}
      actions={actions}
    >
      {children}
    </Dashboard>
  );
}
