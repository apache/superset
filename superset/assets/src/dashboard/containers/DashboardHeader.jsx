import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import DashboardHeader from '../components/Header';
import isDashboardLoading from '../util/isDashboardLoading';

import {
  setEditMode,
  toggleBuilderPane,
  fetchFaveStar,
  saveFaveStar,
  fetchCharts,
  startPeriodicRender,
  updateCss,
  onChange,
  saveDashboardRequest,
  setMaxUndoHistoryExceeded,
  maxUndoHistoryToast,
} from '../actions/dashboardState';

import {
  undoLayoutAction,
  redoLayoutAction,
  updateDashboardTitle,
} from '../actions/dashboardLayout';

import {
  addSuccessToast,
  addDangerToast,
  addWarningToast,
} from '../../messageToasts/actions';

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
    filters: dashboardState.filters,
    dashboardTitle: (
      (undoableLayout.present[DASHBOARD_HEADER_ID] || {}).meta || {}
    ).text,
    expandedSlices: dashboardState.expandedSlices,
    css: dashboardState.css,
    charts,
    userId: dashboardInfo.userId,
    isStarred: !!dashboardState.isStarred,
    isLoading: isDashboardLoading(charts),
    hasUnsavedChanges: !!dashboardState.hasUnsavedChanges,
    maxUndoHistoryExceeded: !!dashboardState.maxUndoHistoryExceeded,
    editMode: !!dashboardState.editMode,
    showBuilderPane: !!dashboardState.showBuilderPane,
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
      toggleBuilderPane,
      fetchFaveStar,
      saveFaveStar,
      fetchCharts,
      startPeriodicRender,
      updateDashboardTitle,
      updateCss,
      onChange,
      onSave: saveDashboardRequest,
      setMaxUndoHistoryExceeded,
      maxUndoHistoryToast,
    },
    dispatch,
  );
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DashboardHeader);
