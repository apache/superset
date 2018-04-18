import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import {
  addSliceToDashboard,
  removeSliceFromDashboard,
  onChange,
} from '../actions/dashboardState';
import { runQuery } from '../../chart/chartAction';
import Dashboard from './Dashboard';

function mapStateToProps({
  datasources,
  sliceEntities,
  charts,
  dashboardInfo,
  dashboardState,
  dashboardLayout,
  impressionId,
}) {
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
  return {
    actions: bindActionCreators({
      addSliceToDashboard,
      onChange,
      removeSliceFromDashboard,
      runQuery,
    }, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
