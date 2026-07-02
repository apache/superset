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

/**
 * @fileoverview The built-in dashboard renderer.
 *
 * This component conforms to the `DashboardRendererProps` contract from
 * `@apache-superset/core/dashboards` but intentionally ignores those props:
 * it reads everything from the Redux store the host hydrates. The contract
 * props exist so custom renderers contributed by extensions can be
 * Redux-free; migrating this built-in renderer to consume the props instead
 * of the store is incremental follow-up work behind the stable contract.
 */

import { FC, lazy, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import type { dashboards } from '@apache-superset/core';
import DashboardContainer from 'src/dashboard/containers/Dashboard';
import {
  getAllActiveFilters,
  getRelevantDataMask,
} from 'src/dashboard/util/activeAllDashboardFilters';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { AutoRefreshProvider } from 'src/dashboard/contexts/AutoRefreshContext';
import type { ActiveFilters, RootState } from 'src/dashboard/types';

const DashboardBuilder = lazy(
  () =>
    import(
      /* webpackChunkName: "DashboardContainer" */
      /* webpackPreload: true */
      'src/dashboard/components/DashboardBuilder/DashboardBuilder'
    ),
);

const selectRelevantDatamask = createSelector(
  (state: RootState) => state.dataMask, // the first argument accesses relevant data from global state
  dataMask => getRelevantDataMask(dataMask, 'ownState'), // the second parameter conducts the transformation
);

const selectChartConfiguration = (state: RootState) =>
  state.dashboardInfo.metadata?.chart_configuration;
const selectNativeFilters = (state: RootState) => state.nativeFilters.filters;
const selectDataMask = (state: RootState) => state.dataMask;
const selectAllSliceIds = (state: RootState) => state.dashboardState.sliceIds;
const selectActiveFilters = createSelector(
  [
    selectChartConfiguration,
    selectNativeFilters,
    selectDataMask,
    selectAllSliceIds,
  ],
  (chartConfiguration, nativeFilters, dataMask, allSliceIds) => ({
    ...getActiveFilters(),
    ...getAllActiveFilters({
      // eslint-disable-next-line camelcase
      chartConfiguration,
      nativeFilters,
      dataMask,
      allSliceIds,
    }),
  }),
);

const DefaultDashboardRenderer: FC<dashboards.DashboardRendererProps> = () => {
  const relevantDataMask = useSelector(selectRelevantDatamask);
  const activeFilters = useSelector(selectActiveFilters);
  const dashboardBuilderComponent = useMemo(() => <DashboardBuilder />, []);

  return (
    <AutoRefreshProvider>
      <DashboardContainer
        activeFilters={activeFilters as ActiveFilters}
        ownDataCharts={relevantDataMask}
      >
        {dashboardBuilderComponent}
      </DashboardContainer>
    </AutoRefreshProvider>
  );
};

export default DefaultDashboardRenderer;
