import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import {
  toggleExpandSlice,
  addFilter,
  removeFilter,
  addSliceToDashboard,
  removeSliceFromDashboard,
  onChange,
} from '../actions/dashboardState';
import { saveSliceName } from '../actions/sliceEntities';
import { refreshChart, runQuery, renderTriggered } from '../../chart/chartAction';
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
    refreshChart,
    runQuery,
    renderTriggered,
    saveSliceName,
    toggleExpandSlice,
    addFilter,
    removeFilter,
    addSliceToDashboard,
    removeSliceFromDashboard,
    onChange,
  };
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
