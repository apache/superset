import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import DashboardHeader from '../components/Header';
import {
  setEditMode,
  toggleBuilderPane,
  fetchFaveStar,
  saveFaveStar,
  fetchCharts,
  startPeriodicRender,
  updateDashboardTitle,
  onChange,
  saveDashboard,
  setMaxUndoHistoryExceeded,
  maxUndoHistoryToast,
} from '../actions/dashboardState';
import { undoLayoutAction, redoLayoutAction } from '../actions/dashboardLayout';

function mapStateToProps({
  dashboardLayout: undoableLayout,
  dashboardState: dashboard,
  dashboardInfo,
  charts,
}) {
  return {
    dashboardInfo,
    undoLength: undoableLayout.past.length,
    redoLength: undoableLayout.future.length,
    layout: undoableLayout.present,
    filters: dashboard.filters,
    dashboardTitle: dashboard.title,
    expandedSlices: dashboard.expandedSlices,
    charts,
    userId: dashboardInfo.userId,
    isStarred: !!dashboard.isStarred,
    hasUnsavedChanges: !!dashboard.hasUnsavedChanges,
    maxUndoHistoryExceeded: !!dashboard.maxUndoHistoryExceeded,
    editMode: !!dashboard.editMode,
    showBuilderPane: !!dashboard.showBuilderPane,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      onUndo: undoLayoutAction,
      onRedo: redoLayoutAction,
      setEditMode,
      toggleBuilderPane,
      fetchFaveStar,
      saveFaveStar,
      fetchCharts,
      startPeriodicRender,
      updateDashboardTitle,
      onChange,
      onSave: saveDashboard,
      setMaxUndoHistoryExceeded,
      maxUndoHistoryToast,
    },
    dispatch,
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(DashboardHeader);
