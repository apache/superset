import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { sinceOptions, untilOptions } from '../constants';
import SelectArray from './SelectArray';

const propTypes = {
  actions: React.PropTypes.object,
  datasourceType: React.PropTypes.string,
  timeColumnOpts: React.PropTypes.array,
  timeColumn: React.PropTypes.string,
  timeGrainOpts: React.PropTypes.array,
  timeGrain: React.PropTypes.string,
  since: React.PropTypes.string,
  until: React.PropTypes.string,
};

const defaultProps = {
  timeColumnOpts: [],
  timeColumn: null,
  timeGrainOpts: [],
  timeGrain: null,
  since: null,
  until: null,
};

const TimeFilter = (props) => {
  const timeColumnTitle =
    (props.datasourceType === 'table') ? 'Time Column' : 'Time Granularity';
  const timeGrainTitle =
    (props.datasourceType === 'table') ? 'Time Grain' : 'Origin';
  const selects = [];
  selects.push({
    key: 'timeColumn',
    title: timeColumnTitle,
    options: props.timeColumnOpts,
    value: props.timeColumn,
  });
  selects.push({
    key: 'timeGrain',
    title: timeGrainTitle,
    options: props.timeGrainOpts,
    value: props.timeGrain,
  });
  selects.push({
    key: 'since',
    title: 'Since',
    options: sinceOptions.map((s) => ({ value: s, label: s })),
    value: props.since,
  });
  selects.push({
    key: 'until',
    title: 'Until',
    options: untilOptions.map((u) => ({ value: u, label: u })),
    value: props.until,
  });
  return (
    <div className="panel space-1">
      <div className="panel-header">Time Filter</div>
      <div className="panel-body">
        <SelectArray selectArray={selects} />
      </div>
    </div>
  );
};

TimeFilter.propTypes = propTypes;
TimeFilter.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    datasourceType: state.datasourceType,
    timeColumnOpts: state.timeColumnOpts,
    timeColumn: state.viz.formData.timeColumn,
    timeGrainOpts: state.timeGrainOpts,
    timeGrain: state.viz.formData.timeGrain,
    since: state.viz.formData.since,
    until: state.viz.formData.until,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(TimeFilter);
