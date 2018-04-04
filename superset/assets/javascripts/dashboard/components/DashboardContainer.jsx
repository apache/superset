import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as dashboardActions from '../actions/dashboard';
import { saveSliceName } from '../actions/allSlices';
import * as chartActions from '../../chart/chartAction';
import Dashboard from './Dashboard';

function mapStateToProps({ datasources, allSlices, charts, dashboard, undoableLayout, impressionId }) {
  return {
    initMessages: dashboard.common.flash_messages,
    timeout: dashboard.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    dashboard: dashboard.dashboard,
    charts,
    datasources,
    allSlices,
    filters: dashboard.filters,
    refresh: !!dashboard.refresh,
    userId: dashboard.userId,
    isStarred: !!dashboard.isStarred,
    editMode: dashboard.editMode,
    layout: undoableLayout.present,
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
