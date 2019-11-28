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
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import {
  toggleExpandSlice,
  setFocusedFilterField,
  unsetFocusedFilterField,
} from '../actions/dashboardState';
import { updateComponents } from '../actions/dashboardLayout';
import { changeFilter } from '../actions/dashboardFilters';
import { addDangerToast } from '../../messageToasts/actions';
import { refreshChart } from '../../chart/chartAction';
import { logEvent } from '../../logger/actions';
import {
  getActiveFilters,
  getAppliedFilterValues,
} from '../util/activeDashboardFilters';
import getFormDataWithExtraFilters from '../util/charts/getFormDataWithExtraFilters';
import Chart from '../components/gridComponents/Chart';

const EMPTY_FILTERS = {};

function mapStateToProps(
  {
    charts: chartQueries,
    dashboardInfo,
    dashboardState,
    datasources,
    sliceEntities,
  },
  ownProps,
) {
  const { id } = ownProps;
  const chart = chartQueries[id] || {};
  const { colorScheme, colorNamespace } = dashboardState;

  return {
    chart,
    datasource:
      (chart && chart.form_data && datasources[chart.form_data.datasource]) ||
      {},
    slice: sliceEntities.slices[id],
    timeout: dashboardInfo.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    filters: getActiveFilters() || EMPTY_FILTERS,
    // note: this method caches filters if possible to prevent render cascades
    formData: getFormDataWithExtraFilters({
      chart,
      filters: getAppliedFilterValues(id),
      colorScheme,
      colorNamespace,
      sliceId: id,
    }),
    editMode: dashboardState.editMode,
    isExpanded: !!dashboardState.expandedSlices[id],
    supersetCanExplore: !!dashboardInfo.superset_can_explore,
    supersetCanCSV: !!dashboardInfo.superset_can_csv,
    sliceCanEdit: !!dashboardInfo.slice_can_edit,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      updateComponents,
      addDangerToast,
      toggleExpandSlice,
      changeFilter,
      setFocusedFilterField,
      unsetFocusedFilterField,
      refreshChart,
      logEvent,
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(Chart);
