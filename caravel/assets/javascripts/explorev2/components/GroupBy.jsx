import React from 'react';
import Select from 'react-select';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';

const propTypes = {
  actions: React.PropTypes.object,
  metricsOpts: React.PropTypes.array,
  metrics: React.PropTypes.array,
  groupByColumnOpts: React.PropTypes.array,
  groupByColumns: React.PropTypes.array,
};

const defaultProps = {
  metricsOpts: [],
  metrics: [],
  groupByColumnOpts: [],
  groupByColumns: [],
};

class GroupBy extends React.Component {
  changeColumns(groupByColumns) {
    this.props.actions.setGroupByColumns(groupByColumns);
  }
  changeMetrics(metrics) {
    this.props.actions.setMetrics(metrics);
  }
  render() {
    return (
      <div className="panel space-1">
        <div className="panel-header">GroupBy</div>
        <div className="panel-body">
          <div className="row">
            <h5 className="section-heading">GroupBy Column</h5>
            <Select
              multi
              name="select-time-column"
              placeholder="Select groupby columns"
              options={this.props.groupByColumnOpts}
              value={this.props.groupByColumns}
              autosize={false}
              onChange={this.changeColumns.bind(this)}
            />
          </div>
          <div className="row">
            <h5 className="section-heading">Metrics</h5>
            <Select
              multi
              name="select-since"
              placeholder="Select metrics"
              options={this.props.metricsOpts}
              value={this.props.metrics}
              autosize={false}
              onChange={this.changeMetrics.bind(this)}
            />
          </div>
        </div>
      </div>
    );
  }
}

GroupBy.propTypes = propTypes;
GroupBy.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    metricsOpts: state.metricsOpts,
    metrics: state.metrics,
    groupByColumnOpts: state.groupByColumnOpts,
    groupByColumns: state.groupByColumns,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(GroupBy);
