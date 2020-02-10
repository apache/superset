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
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import FilterIndicatorsContainer from '../components/FilterIndicatorsContainer';
import { setDirectPathToChild } from '../actions/dashboardState';

function mapStateToProps(
  { datasources, dashboardState, dashboardFilters, dashboardLayout, charts },
  ownProps,
) {
  const chartId = ownProps.chartId;
  const chartStatus = (charts[chartId] || {}).chartStatus;

  return {
    datasources,
    dashboardFilters,
    chartId,
    chartStatus,
    layout: dashboardLayout.present,
    filterFieldOnFocus:
      dashboardState.focusedFilterField.length === 0
        ? {}
        : dashboardState.focusedFilterField.slice(-1).pop(),
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      setDirectPathToChild,
    },
    dispatch,
  );
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(FilterIndicatorsContainer);
