import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as dashboardActions from '../actions/dashboard';
import { saveSliceName } from '../actions/allSlices';
import * as chartActions from '../../chart/chartAction';
import Dashboard from './Dashboard';

// @TODO remove unneeded props
function mapStateToProps({ datasources, allSlices, charts, dashboard, dashboardLayout, impressionId }) {
  return {
    initMessages: dashboard.common.flash_messages,
    timeout: dashboard.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
    dashboard: dashboard.dashboard,
    charts,
    datasources,
    slices: allSlices.slices,
    filters: dashboard.filters,
    layout: dashboardLayout.present,
    refresh: !!dashboard.refresh,
    userId: dashboard.userId,
    isStarred: !!dashboard.isStarred,
    editMode: dashboard.editMode,
    showBuilderPane: dashboard.showBuilderPane,
    hasUnsavedChanges: !!dashboard.hasUnsavedChanges,
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
    // @TODO update to the 4 actions we actually need and remove actions object
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
