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

import { updateDataMask } from 'src/dataMask/actions';
import DashboardHeader from 'src/dashboard/components/Header';
import isDashboardLoading from 'src/dashboard/util/isDashboardLoading';

import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';

import {
  setEditMode,
  showBuilderPane,
  fetchFaveStar,
  saveFaveStar,
  savePublished,
  setColorSchemeAndUnsavedChanges,
  fetchCharts,
  updateCss,
  onChange,
  saveDashboardRequest,
  setMaxUndoHistoryExceeded,
  maxUndoHistoryToast,
  setRefreshFrequency,
  onRefresh,
} from 'src/dashboard/actions/dashboardState';

import {
  undoLayoutAction,
  redoLayoutAction,
  updateDashboardTitle,
  dashboardTitleChanged,
} from 'src/dashboard/actions/dashboardLayout';
import {
  addSuccessToast,
  addDangerToast,
  addWarningToast,
} from 'src/components/MessageToasts/actions';

import { logEvent } from 'src/logger/actions';
import { DASHBOARD_HEADER_ID } from 'src/dashboard/util/constants';
import {
  fetchUISpecificReport,
  toggleActive,
  deleteActiveReport,
} from 'src/reports/actions/reports';

function mapStateToProps({
  dashboardLayout: undoableLayout,
  dashboardState,
  reports,
  dashboardInfo,
  charts,
  dataMask,
  user,
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
    shouldPersistRefreshFrequency: !!dashboardState.shouldPersistRefreshFrequency,
    customCss: dashboardState.css,
    colorNamespace: dashboardState.colorNamespace,
    colorScheme: dashboardState.colorScheme,
    charts,
    dataMask,
    user,
    isStarred: !!dashboardState.isStarred,
    isPublished: !!dashboardState.isPublished,
    isLoading: isDashboardLoading(charts),
    hasUnsavedChanges: !!dashboardState.hasUnsavedChanges,
    maxUndoHistoryExceeded: !!dashboardState.maxUndoHistoryExceeded,
    lastModifiedTime: Math.max(
      dashboardState.lastModifiedTime,
      dashboardInfo.last_modified_time,
    ),
    editMode: !!dashboardState.editMode,
    slug: dashboardInfo.slug,
    metadata: dashboardInfo.metadata,
    reports,
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
      setColorSchemeAndUnsavedChanges,
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
      onRefresh,
      dashboardInfoChanged,
      dashboardTitleChanged,
      updateDataMask,
      fetchUISpecificReport,
      toggleActive,
      deleteActiveReport,
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(DashboardHeader);
