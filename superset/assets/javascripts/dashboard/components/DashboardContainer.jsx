import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as dashboardActions from '../actions/dashboard';
import { saveSliceName } from '../actions/sliceEntities';
import * as chartActions from '../../chart/chartAction';
import Dashboard from './Dashboard';

function mapStateToProps({ datasources, sliceEntities, charts,
                           dashboardInfo, dashboardState,
                           dashboardLayout, impressionId }) {
  return {
    initMessages: dashboardInfo.common.flash_messages,
    timeout: dashboardInfo.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    userId: dashboardInfo.userId,
    dashboardInfo,
    dashboardState,
    charts,
    datasources,
    slices: sliceEntities.slices,
    layout: dashboardLayout.present,
    impressionId,
  };
}

function mapDispatchToProps(dispatch) {
  const actions = {
    ...chartActions,
    ...dashboardActions,
    saveSliceName,
  };
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
