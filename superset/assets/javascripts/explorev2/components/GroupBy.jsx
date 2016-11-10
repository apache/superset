import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import SelectArray from './SelectArray';

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

const GroupBy = (props) => {
  const selects = [
    {
      key: 'groupByColumns',
      title: 'Group By',
      options: props.groupByColumnOpts,
      value: props.groupByColumns,
      multi: true,
      width: '12',
    },
    {
      key: 'metrics',
      title: 'Metrics',
      options: props.metricsOpts,
      value: props.metrics,
      multi: true,
      width: '12',
    }];
  return (
    <div className="panel">
      <div className="panel-header">GroupBy</div>
      <div className="panel-body">
        <SelectArray selectArray={selects} />
      </div>
    </div>
  );
};

GroupBy.propTypes = propTypes;
GroupBy.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    metricsOpts: state.metricsOpts,
    metrics: state.viz.formData.metrics,
    groupByColumnOpts: state.groupByColumnOpts,
    groupByColumns: state.viz.formData.groupByColumns,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(GroupBy);
