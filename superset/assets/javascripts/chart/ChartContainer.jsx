import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import * as Actions from './chartAction';
import Chart from './Chart';
import StackTraceMessage from '../components/StackTraceMessage';
import visMap from '../../visualizations/main';

const propTypes = {
  actions: PropTypes.object,
  chartKey: PropTypes.string.isRequired,
  containerId: PropTypes.string.isRequired,
  datasource: PropTypes.object.isRequired,
  formData: PropTypes.object.isRequired,
  height: PropTypes.number,
  width: PropTypes.number,
  setControlValue: PropTypes.func,
  timeout: PropTypes.number,
  viz_type: PropTypes.string.isRequired,
  // state
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  chartUpdateEndTime: PropTypes.number,
  chartUpdateStartTime: PropTypes.number,
  latestQueryFormData: PropTypes.object,
  queryRequest: PropTypes.object,
  queryResponse: PropTypes.object,
  triggerRender: PropTypes.bool,
  triggerQuery: PropTypes.bool,
  // dashboard callbacks
  addFilter: PropTypes.func,
  getFilters: PropTypes.func,
  clearFilter: PropTypes.func,
  removeFilter: PropTypes.func,
};

class ChartContainer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showStackTrace: false,
    };
  }

  componentDidMount() {
    this.runQuery();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.queryResponse &&
      this.props.chartStatus === 'success' &&
      !this.props.queryResponse.error && (
        prevProps.queryResponse !== this.props.queryResponse ||
        prevProps.height !== this.props.height ||
        prevProps.width !== this.props.width ||
        this.props.triggerRender)
    ) {
      this.renderViz();
    }
  }

  runQuery() {
    this.props.actions.runQuery(this.props.formData, true,
      this.props.timeout,
      this.props.chartKey,
    );
  }

  renderViz() {
    this.props.actions.renderTriggered(this.props.chartKey);

    const viz = visMap[this.props.viz_type];
    try {
      viz(this.sliceEl, this.props.queryResponse, this.props.actions.setControlValue);
    } catch (e) {
      this.props.actions.chartRenderingFailed(e, this.props.chartKey);
    }
  }

  render() {
    if (this.props.chartAlert) {
      return (
        <StackTraceMessage
          message={this.props.chartAlert}
          queryResponse={this.props.queryResponse}
        />
      );
    }

    const containerId = this.props.containerId;
    return (
      <Chart
        containerId={containerId}
        datasource={this.props.datasource}
        formData={this.props.formData}
        height={this.props.height}
        width={this.props.width}
        isLoading={this.props.chartStatus === 'loading'}
        addFilter={this.props.addFilter}
        getFilters={this.props.getFilters}
        clearFilter={this.props.clearFilter}
        removeFilter={this.props.removeFilter}
        ref={(sliceEl) => { this.sliceEl = sliceEl; }}
      />
    );
  }
}

ChartContainer.propTypes = propTypes;

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

export { ChartContainer };
export default connect(mapStateToProps, mapDispatchToProps)(ChartContainer);
