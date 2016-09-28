import React from 'react';
import Select from 'react-select';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { sinceOptions, untilOptions } from '../constants';

const propTypes = {
  actions: React.PropTypes.object,
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

class TimeFilter extends React.Component {
  changeTimeColumn(timeColumnOpt) {
    const val = (timeColumnOpt) ? timeColumnOpt.value : null;
    this.props.actions.setTimeColumn(val);
  }
  changeTimeGrain(timeGrainOpt) {
    const val = (timeGrainOpt) ? timeGrainOpt.value : null;
    this.props.actions.setTimeGrain(val);
  }
  changeSince(sinceOpt) {
    const val = (sinceOpt) ? sinceOpt.value : null;
    this.props.actions.setSince(val);
  }
  changeUntil(untilOpt) {
    const val = (untilOpt) ? untilOpt.value : null;
    this.props.actions.setUntil(val);
  }
  render() {
    return (
      <div className="panel space-1">
        <div className="panel-header">Time Filter</div>
        <div className="panel-body">
          <div className="row">
            <h5 className="section-heading">Time Column & Grain</h5>
            <Select
              className="col-sm-6"
              name="select-time-column"
              placeholder="Select a time column"
              options={this.props.timeColumnOpts}
              value={this.props.timeColumn}
              autosize={false}
              onChange={this.changeTimeColumn.bind(this)}
            />
            <Select
              className="col-sm-6"
              name="select-time-grain"
              placeholder="Select a time grain"
              options={this.props.timeGrainOpts}
              value={this.props.timeGrain}
              autosize={false}
              onChange={this.changeTimeGrain.bind(this)}
            />
          </div>
          <div className="row">
            <h5 className="section-heading">Since - Until</h5>
            <Select
              className="col-sm-6"
              name="select-since"
              placeholder="Select Since Time"
              options={sinceOptions.map((s) => ({ value: s, label: s }))}
              value={this.props.since}
              autosize={false}
              onChange={this.changeSince.bind(this)}
            />
            <Select
              className="col-sm-6"
              name="select-until"
              placeholder="Select Until Time"
              options={untilOptions.map((u) => ({ value: u, label: u }))}
              value={this.props.until}
              autosize={false}
              onChange={this.changeUntil.bind(this)}
            />
          </div>
        </div>
      </div>
    );
  }
}

TimeFilter.propTypes = propTypes;
TimeFilter.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    timeColumnOpts: state.timeColumnOpts,
    timeColumn: state.timeColumn,
    timeGrainOpts: state.timeGrainOpts,
    timeGrain: state.timeGrain,
    since: state.since,
    until: state.until,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(TimeFilter);
