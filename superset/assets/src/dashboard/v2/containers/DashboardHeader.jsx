import { ActionCreators as UndoActionCreators } from 'redux-undo';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import DashboardHeader from '../../components/Header';
import {
  setEditMode,
  toggleBuilderPane,
  fetchFaveStar,
  saveFaveStar,
  fetchCharts,
  startPeriodicRender,
  updateDashboardTitle,
  onChange,
  onSave,
} from '../../actions/dashboardState';
import {
  handleComponentDrop,
} from '../actions/dashboardLayout';

function mapStateToProps({ dashboardLayout: undoableLayout, dashboardState: dashboard,
                           dashboardInfo, charts }) {
  return {
    dashboardInfo,
    canUndo: undoableLayout.past.length > 0,
    canRedo: undoableLayout.future.length > 0,
    layout: undoableLayout.present,
    filters: dashboard.filters,
    dashboardTitle: dashboard.title,
    expandedSlices: dashboard.expandedSlices,
    charts,
    userId: dashboardInfo.userId,
    isStarred: !!dashboard.isStarred,
    hasUnsavedChanges: !!dashboard.hasUnsavedChanges,
    editMode: !!dashboard.editMode,
    showBuilderPane: !!dashboard.showBuilderPane,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    handleComponentDrop,
    onUndo: UndoActionCreators.undo,
    onRedo: UndoActionCreators.redo,
    setEditMode,
    toggleBuilderPane,
    fetchFaveStar,
    saveFaveStar,
    fetchCharts,
    startPeriodicRender,
    updateDashboardTitle,
    onChange,
    onSave,
  }, dispatch);
}


export default connect(mapStateToProps, mapDispatchToProps)(DashboardHeader);
