import React from 'react';
import Select from 'react-select';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import {
  rollingOptions, periodRatioTypeOptions, resampleHowOptions,
  resampleRuleOptions, resampleFillOptions,
} from '../constants';

const propTypes = {
  actions: React.PropTypes.object,
  rolling: React.PropTypes.string,
  periodRatioType: React.PropTypes.string,
  resampleHow: React.PropTypes.string,
  resampleRule: React.PropTypes.string,
  resampleFill: React.PropTypes.string,
};

const defaultProps = {
  rolling: null,
  periodRatioType: null,
  resampleHow: null,
  resampleRule: null,
  resampleFill: null,
};

class AdvancedAnalytics extends React.Component {
  changeSelectData(field, opt) {
    const val = opt ? opt.value : null;
    this.props.actions.setStateValue(field, val);
  }
  changeInput(field, event) {
    this.props.actions.setStateValue(field, event.target.value);
  }
  render() {
    return (
      <div className="panel space-1">
        <div className="panel-header">Advanced Analytics</div>
        <div className="panel-body">
          <div className="col-sm-6">
            <h5 className="section-heading">Rolling</h5>
            <Select
              name="select-rolling"
              options={rollingOptions.map((o) => ({ value: o, label: o }))}
              value={this.props.rolling}
              autosize={false}
              onChange={this.changeSelectData.bind(this, 'rolling')}
            />
          </div>
          <div className="col-sm-6">
            <h5 className="section-heading">Periods</h5>
            <input
              type="text"
              onChange={this.changeInput.bind(this, 'periods')}
              className="form-control input-sm"
            />
          </div>
          <h5 className="section-heading">Time Shift</h5>
          <input
            type="text"
            onChange={this.changeInput.bind(this, 'timeShift')}
            className="form-control input-sm"
          />
          <div className="col-sm-6">
            <h5 className="section-heading">Period Ratio</h5>
            <input
              type="text"
              onChange={this.changeInput.bind(this, 'periodRatio')}
              className="form-control input-sm"
            />
          </div>
          <div className="col-sm-6">
            <h5 className="section-heading">Period Ratio Type</h5>
            <Select
              name="select-rolling"
              options={periodRatioTypeOptions.map((o) => ({ value: o, label: o }))}
              value={this.props.periodRatioType}
              autosize={false}
              onChange={this.changeSelectData.bind(this, 'periodRatioType')}
            />
          </div>
          <div className="col-sm-6">
            <h5 className="section-heading">Resample How</h5>
            <Select
              name="select-rolling"
              options={resampleHowOptions.map((o) => ({ value: o, label: o }))}
              value={this.props.resampleHow}
              autosize={false}
              onChange={this.changeSelectData.bind(this, 'resampleHow')}
            />
          </div>
          <div className="col-sm-6">
            <h5 className="section-heading">Resample Rule</h5>
            <Select
              name="select-rolling"
              options={resampleRuleOptions.map((o) => ({ value: o, label: o }))}
              value={this.props.resampleRule}
              autosize={false}
              onChange={this.changeSelectData.bind(this, 'resampleRule')}
            />
          </div>
          <h5 className="section-heading">Resample Fill Method</h5>
          <Select
            name="select-rolling"
            options={resampleFillOptions.map((o) => ({ value: o, label: o }))}
            value={this.props.resampleFill}
            autosize={false}
            onChange={this.changeSelectData.bind(this, 'resampleFill')}
          />
        </div>
      </div>
    );
  }
}

AdvancedAnalytics.propTypes = propTypes;
AdvancedAnalytics.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    rolling: state.rolling,
    periodRatioType: state.periodRatioType,
    resampleHow: state.resampleHow,
    resampleRule: state.resampleRule,
    resampleFill: state.resampleFill,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(AdvancedAnalytics);
