import React from 'react';
import Select from 'react-select';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { aggMetricOpts } from '../constants';

const propTypes = {
  actions: React.PropTypes.object,
  pivotColumnOpts: React.PropTypes.array,
  pivotColumns: React.PropTypes.array,
  aggMetric: React.PropTypes.string,
};

const defaultProps = {
  pivotColumnOpts: [],
  pivotColumns: [],
  aggMetric: null,
};

class PivotColumns extends React.Component {
  changeColumns(pivotColumns) {
    this.props.actions.setPivotColumns(pivotColumns);
  }
  changeAggMetric(aggMetric) {
    const val = (aggMetric) ? aggMetric.value : null;
    this.props.actions.setAggMetric(val);
  }
  render() {
    return (
      <div className="panel space-1">
        <div className="panel-header">Pivot Choices</div>
        <div className="panel-body">
          <div className="row">
            <h5 className="section-heading">Pivot Columns</h5>
            <Select
              multi
              name="select-pivot-column"
              placeholder="Select pivot columns"
              options={this.props.pivotColumnOpts}
              value={this.props.pivotColumns}
              autosize={false}
              onChange={this.changeColumns.bind(this)}
            />
          </div>
          <div className="row">
            <h5 className="section-heading">Aggregation function</h5>
            <Select
              name="select-agg-func"
              placeholder="Select aggregate function"
              options={aggMetricOpts.map((m) => ({ value: m, label: m }))}
              value={this.props.aggMetric}
              autosize={false}
              onChange={this.changeAggMetric.bind(this)}
            />
          </div>
        </div>
      </div>
    );
  }
}

PivotColumns.propTypes = propTypes;
PivotColumns.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    pivotColumnOpts: state.groupByColumnOpts,
    pivotColumns: state.pivotColumns,
    aggMetric: state.aggMetric,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(PivotColumns);
