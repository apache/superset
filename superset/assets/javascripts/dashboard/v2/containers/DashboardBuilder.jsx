import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import DashboardBuilder from '../components/DashboardBuilder';

import {
  deleteTopLevelTabs,
  updateComponents,
  handleComponentDrop,
} from '../actions';

function mapStateToProps({ dashboard: undoableDashboard }) {
  return {
    dashboard: undoableDashboard.present,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    deleteTopLevelTabs,
    updateComponents,
    handleComponentDrop,
  }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(DashboardBuilder);
