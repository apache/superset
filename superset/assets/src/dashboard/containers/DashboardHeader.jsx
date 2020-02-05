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

import DashboardHeader from '../components/Header';
import isDashboardLoading from '../util/isDashboardLoading';

import { dashboardInfoChanged } from '../actions/dashboardInfo';

import {
  setEditMode,
  showBuilderPane,
  fetchFaveStar,
  saveFaveStar,
  savePublished,
  fetchCharts,
  updateCss,
  onChange,
  saveDashboardRequest,
  setMaxUndoHistoryExceeded,
  maxUndoHistoryToast,
  setRefreshFrequency,
} from '../actions/dashboardState';

import {
  undoLayoutAction,
  redoLayoutAction,
  updateDashboardTitle,
  dashboardTitleChanged,
} from '../actions/dashboardLayout';

import {
  addSuccessToast,
  addDangerToast,
  addWarningToast,
} from '../../messageToasts/actions';

import { logEvent } from '../../logger/actions';
import { DASHBOARD_HEADER_ID } from '../util/constants';

function mapStateToProps({
  dashboardLayout: undoableLayout,
  dashboardState,
  dashboardInfo,
  charts,
}) {
  return {
    dashboardInfo,
    undoLength: undoableLayout.past.length,
    redoLength: undoableLayout.future.length,
    layout: undoableLayout.present,
    dashboardTitle: (
      (undoableLayout.present[DASHBOARD_HEADER_ID] || {}).meta || {}
    ).text,
    expandedSlices: dashboardState.expandedSlices,
    refreshFrequency: dashboardState.refreshFrequency,
    css: dashboardState.css,
    colorNamespace: dashboardState.colorNamespace,
    colorScheme: dashboardState.colorScheme,
    charts,
    userId: dashboardInfo.userId,
    isStarred: !!dashboardState.isStarred,
    isPublished: !!dashboardState.isPublished,
    isLoading: isDashboardLoading(charts),
    hasUnsavedChanges: !!dashboardState.hasUnsavedChanges,
    maxUndoHistoryExceeded: !!dashboardState.maxUndoHistoryExceeded,
    editMode: !!dashboardState.editMode,
    builderPaneType: dashboardState.builderPaneType,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      addSuccessToast,
      addDangerToast,
      addWarningToast,
      onUndo: undoLayoutAction,
      onRedo: redoLayoutAction,
      setEditMode,
      showBuilderPane,
      fetchFaveStar,
      saveFaveStar,
      savePublished,
      fetchCharts,
      updateDashboardTitle,
      updateCss,
      onChange,
      onSave: saveDashboardRequest,
      setMaxUndoHistoryExceeded,
      maxUndoHistoryToast,
      logEvent,
      setRefreshFrequency,
      dashboardInfoChanged,
      dashboardTitleChanged,
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(DashboardHeader);
