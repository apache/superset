import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import DashboardBuilder from '../components/DashboardBuilder';

import {
  deleteTopLevelTabs,
  handleComponentDrop,
} from '../actions/dashboardLayout';

function mapStateToProps({ dashboardLayout: undoableLayout, dashboard }) {
  return {
    dashboardLayout: undoableLayout.present,
    editMode: dashboard.editMode,
    showBuilderPane: dashboard.showBuilderPane,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    deleteTopLevelTabs,
    handleComponentDrop,
  }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(DashboardBuilder);
