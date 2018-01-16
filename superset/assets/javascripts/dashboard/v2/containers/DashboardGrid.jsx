import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import DashboardGrid from '../components/DashboardGrid';

import {
  updateComponents,
  handleComponentDrop,
} from '../actions';

function mapStateToProps({ dashboard = {} }) {
  return {
    dashboard,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    updateComponents,
    handleComponentDrop,
  }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(DashboardGrid);
