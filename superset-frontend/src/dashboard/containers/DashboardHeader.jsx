// DODO was here
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
  setColorScheme,
  setUnsavedChanges,
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
import { fetchUISpecificReport } from 'src/reports/actions/reports';

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
    shouldPersistRefreshFrequency:
      !!dashboardState.shouldPersistRefreshFrequency,
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
    // DODO added
    dashboardTitleRU: (
      (undoableLayout.present[DASHBOARD_HEADER_ID] || {}).meta || {}
    ).textRU,
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
      setColorScheme,
      setUnsavedChanges,
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
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(DashboardHeader);
