import { ActionCreators as UndoActionCreators } from 'redux-undo';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import DashboardHeader from '../components/DashboardHeader';
import { DASHBOARD_HEADER_ID } from '../util/constants';

import {
  updateComponents,
  handleComponentDrop,
} from '../actions/dashboardLayout';

import { setEditMode } from '../actions/editMode';

function mapStateToProps({ dashboardLayout: undoableLayout, dashboard }) {
  return {
    component: undoableLayout.present[DASHBOARD_HEADER_ID],
    canUndo: undoableLayout.past.length > 0,
    canRedo: undoableLayout.future.length > 0,
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
  }, dispatch);
}


export default connect(mapStateToProps, mapDispatchToProps)(DashboardHeader);
