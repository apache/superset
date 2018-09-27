import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import DashboardGrid from '../components/DashboardGrid';

import {
  handleComponentDrop,
  resizeComponent,
} from '../actions/dashboardLayout';

function mapStateToProps({ dashboardState }) {
  return {
    editMode: dashboardState.editMode,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      handleComponentDrop,
      resizeComponent,
    },
    dispatch,
  );
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DashboardGrid);
