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
import { RootState } from 'src/dashboard/types';
import Dashboard from 'src/dashboard/components/Dashboard';
import {
  addSliceToDashboard,
  removeSliceFromDashboard,
} from 'src/dashboard/actions/dashboardState';
import { setDatasources } from 'src/dashboard/actions/datasources';

import { triggerQuery } from 'src/chart/chartAction';
import { logEvent } from 'src/logger/actions';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import {
  getAllActiveFilters,
  getRelevantDataMask,
} from 'src/dashboard/util/activeAllDashboardFilters';
import { clearDataMaskState } from '../../dataMask/actions';

function mapStateToProps(state: RootState) {
  const {
    datasources,
    sliceEntities,
    charts,
    dataMask,
    dashboardInfo,
    dashboardState,
    dashboardLayout,
    impressionId,
    nativeFilters,
  } = state;

  return {
    initMessages: dashboardInfo.common?.flash_messages,
    timeout: dashboardInfo.common?.conf?.SUPERSET_WEBSERVER_TIMEOUT,
    userId: dashboardInfo.userId,
    dashboardInfo,
    dashboardState,
    charts,
    datasources,
    // filters prop: a map structure for all the active filter_box's values and scope in this dashboard,
    // for each filter field. map key is [chartId_column]
    // When dashboard is first loaded into browser,
    // its value is from preselect_filters that dashboard owner saved in dashboard's meta data
    // When user start interacting with dashboard, it will be user picked values from all filter_box
    activeFilters: {
      ...getActiveFilters(),
      ...getAllActiveFilters({
        // eslint-disable-next-line camelcase
        chartConfiguration: dashboardInfo.metadata?.chart_configuration,
        nativeFilters: nativeFilters.filters,
        dataMask,
        layout: dashboardLayout.present,
      }),
    },
    chartConfiguration: dashboardInfo.metadata?.chart_configuration,
    ownDataCharts: getRelevantDataMask(dataMask, 'ownState'),
    slices: sliceEntities.slices,
    layout: dashboardLayout.present,
    impressionId,
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
