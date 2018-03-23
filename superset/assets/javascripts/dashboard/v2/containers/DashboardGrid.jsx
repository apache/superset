import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import DashboardGrid from '../components/DashboardGrid';

import {
  handleComponentDrop,
  resizeComponent,
} from '../actions';

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    handleComponentDrop,
    resizeComponent,
  }, dispatch);
}

export default connect(null, mapDispatchToProps)(DashboardGrid);
