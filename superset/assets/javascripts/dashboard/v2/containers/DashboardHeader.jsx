import { ActionCreators as UndoActionCreators } from 'redux-undo';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import DashboardHeader from '../components/DashboardHeader';
import { DASHBOARD_HEADER_ID } from '../util/constants';

import {
  updateComponents,
  handleComponentDrop,
} from '../actions/dashboardLayout';

function mapStateToProps({ dashboardLayout: undoableLayout }) {
  return {
    component: undoableLayout.present[DASHBOARD_HEADER_ID],
    canUndo: undoableLayout.past.length > 0,
    canRedo: undoableLayout.future.length > 0,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    updateComponents,
    handleComponentDrop,
    onUndo: UndoActionCreators.undo,
    onRedo: UndoActionCreators.redo,
  }, dispatch);
}


export default connect(mapStateToProps, mapDispatchToProps)(DashboardHeader);
