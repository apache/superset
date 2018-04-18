import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import * as actions from './chartAction';
import Chart from './Chart';

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(null, mapDispatchToProps)(Chart);
