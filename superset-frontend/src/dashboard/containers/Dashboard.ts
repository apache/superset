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
import { bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import { RootState } from 'src/dashboard/types';
import Dashboard from 'src/dashboard/components/Dashboard';
import {
  addSliceToDashboard,
  removeSliceFromDashboard,
} from 'src/dashboard/actions/dashboardState';
import { setDatasources } from 'src/dashboard/actions/datasources';
import {
  getAllActiveFilters,
} from 'src/dashboard/util/activeAllDashboardFilters';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';

import { triggerQuery } from 'src/components/Chart/chartAction';
import { logEvent } from 'src/logger/actions';
import { clearDataMaskState } from '../../dataMask/actions';

const selectOwnDataCharts = createSelector(
  (state: RootState) => state.dataMask,
  dataMask => {
    const ownDataCharts: Record<string, any> = {};
    Object.keys(dataMask).forEach(key => {
      if (dataMask[key]?.ownState) {
        ownDataCharts[key] = dataMask[key].ownState;
      }
    });
    return ownDataCharts;
  },
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
      chartConfiguration,
      nativeFilters,
      dataMask,
      allSliceIds,
    }),
  }),
);

function mapStateToProps(state: RootState) {
  const {
    datasources,
    sliceEntities,
    dashboardInfo,
    dashboardState,
    dashboardLayout,
    impressionId,
  } = state;

  return {
    timeout: dashboardInfo.common?.conf?.SUPERSET_WEBSERVER_TIMEOUT,
    userId: dashboardInfo.userId,
    dashboardId: dashboardInfo.id,
    editMode: dashboardState.editMode,
    isPublished: dashboardState.isPublished,
    hasUnsavedChanges: dashboardState.hasUnsavedChanges,
    datasources,
    chartConfiguration: dashboardInfo.metadata?.chart_configuration,
    slices: sliceEntities.slices,
    layout: dashboardLayout.present,
    impressionId,
    activeFilters: selectActiveFilters(state),
    ownDataCharts: selectOwnDataCharts(state),
  };
}

function mapDispatchToProps(dispatch: Dispatch) {
  return {
    actions: bindActionCreators(
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
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
