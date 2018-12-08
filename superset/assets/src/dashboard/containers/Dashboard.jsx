import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import Dashboard from '../components/Dashboard';

import {
  addSliceToDashboard,
  removeSliceFromDashboard,
} from '../actions/dashboardState';
import { runQuery } from '../../chart/chartAction';
import getLoadStatsPerTopLevelComponent from '../util/logging/getLoadStatsPerTopLevelComponent';

function mapStateToProps(state) {
  const {
    datasources,
    sliceEntities,
    charts,
    dashboardInfo,
    dashboardState,
    dashboardLayout,
    impressionId,
  } = state;

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
    loadStats: getLoadStatsPerTopLevelComponent({
      layout: dashboardLayout.present,
      chartQueries: charts,
    }),
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(
      {
        addSliceToDashboard,
        removeSliceFromDashboard,
        runQuery,
      },
      dispatch,
    ),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Dashboard);
