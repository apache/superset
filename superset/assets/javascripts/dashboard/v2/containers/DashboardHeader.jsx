import { ActionCreators as UndoActionCreators } from 'redux-undo';
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
} from '../../actions/dashboard'
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import DashboardHeader from '../../components/Header';
import { DASHBOARD_HEADER_ID } from '../util/constants';

import {
  updateComponents,
  handleComponentDrop,
} from '../actions/dashboardLayout';

function mapStateToProps({ dashboardLayout: undoableLayout, dashboard, charts }) {
  return {
    dashboard: dashboard.dashboard,
    component: undoableLayout.present[DASHBOARD_HEADER_ID],
    canUndo: undoableLayout.past.length > 0,
    canRedo: undoableLayout.future.length > 0,
    layout: undoableLayout.present,
    filters: dashboard.filters,
    charts,
    userId: dashboard.userId,
    isStarred: !!dashboard.isStarred,
    hasUnsavedChanges: !!dashboard.hasUnsavedChanges,
    editMode: dashboard.editMode,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    updateComponents,
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
