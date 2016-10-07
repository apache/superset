import React from 'react';
import SelectArray from './SelectArray';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import {
  rollingOptions, periodRatioTypeOptions, resampleHowOptions,
  resampleRuleOptions, resampleFillOptions,
} from '../constants';
import { getSelectOptions } from '../../../utils/common';

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
  changeInput(field, event) {
    this.props.actions.setStateValue(field, event.target.value);
  }
  render() {
    const selects = [
      {
        key: 'rolling',
        title: 'Rolling',
        options: getSelectOptions(rollingOptions),
        value: this.props.rolling,
      },
      {
        key: 'periodRatioType',
        title: 'Period Ratio Type',
        options: getSelectOptions(periodRatioTypeOptions),
        value: this.props.periodRatioType,
      },
      {
        key: 'resampleHow',
        title: 'Resample How',
        options: getSelectOptions(resampleHowOptions),
        value: this.props.resampleHow,
      },
      {
        key: 'resampleRule',
        title: 'Resample Rule',
        options: getSelectOptions(resampleRuleOptions),
        value: this.props.resampleRule,
      },
      {
        key: 'resampleFill',
        title: 'Resample Fill',
        options: getSelectOptions(resampleFillOptions),
        value: this.props.resampleFill,
        width: '12',
      }];
    return (
      <div className="panel space-1">
        <div className="panel-header">Advanced Analytics</div>
        <div className="panel-body">
          <SelectArray selectArray={selects} />
          <div className="col-sm-6">
            <h5 className="section-heading">Periods</h5>
            <input
              type="text"
              onChange={this.changeInput.bind(this, 'periods')}
              className="form-control input-sm"
            />
          </div>
          <div className="col-sm-6">
            <h5 className="section-heading">Period Ratio</h5>
            <input
              type="text"
              onChange={this.changeInput.bind(this, 'periodRatio')}
              className="form-control input-sm"
            />
          </div>
          <div className="col-sm-12">
            <h5 className="section-heading">Time Shift</h5>
            <input
              type="text"
              onChange={this.changeInput.bind(this, 'timeShift')}
              className="form-control input-sm"
            />
          </div>
        </div>
      </div>
    );
  }
}

AdvancedAnalytics.propTypes = propTypes;
AdvancedAnalytics.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    rolling: state.viz.formData.rolling,
    periodRatioType: state.viz.formData.periodRatioType,
    resampleHow: state.viz.formData.resampleHow,
    resampleRule: state.viz.formData.resampleRule,
    resampleFill: state.viz.formData.resampleFill,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(AdvancedAnalytics);
