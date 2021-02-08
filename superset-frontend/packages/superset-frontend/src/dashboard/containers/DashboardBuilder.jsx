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
import DashboardBuilder from '../components/DashboardBuilder';

import {
  setColorSchemeAndUnsavedChanges,
  showBuilderPane,
  setDirectPathToChild,
} from '../actions/dashboardState';
import {
  deleteTopLevelTabs,
  handleComponentDrop,
} from '../actions/dashboardLayout';

function mapStateToProps({ dashboardLayout: undoableLayout, dashboardState }) {
  return {
    dashboardLayout: undoableLayout.present,
    editMode: dashboardState.editMode,
    showBuilderPane: dashboardState.showBuilderPane,
    directPathToChild: dashboardState.directPathToChild,
    colorScheme: dashboardState.colorScheme,
    focusedFilterField: dashboardState.focusedFilterField,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      deleteTopLevelTabs,
      handleComponentDrop,
      showBuilderPane,
      setColorSchemeAndUnsavedChanges,
      setDirectPathToChild,
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(DashboardBuilder);
