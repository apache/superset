import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import * as Actions from './chartAction';
import Chart from './Chart';

function mapStateToProps({ charts }, ownProps) {
  const chart = charts[ownProps.chartKey];
  return {
    chartAlert: chart.chartAlert,
    chartStatus: chart.chartStatus,
    chartUpdateEndTime: chart.chartUpdateEndTime,
    chartUpdateStartTime: chart.chartUpdateStartTime,
    latestQueryFormData: chart.latestQueryFormData,
    queryResponse: chart.queryResponse,
    queryRequest: chart.queryRequest,
    triggerQuery: chart.triggerQuery,
    triggerRender: chart.triggerRender,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Chart);
