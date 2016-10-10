import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import CheckBoxArray from './CheckBoxArray';
import SelectArray from './SelectArray';
import { areaCheckBoxes, stackedStyleOptions,
  checkBoxLabels, seriesLimitOptions } from '../constants';
import { formatSelectOptions } from '../../../utils/common';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  showControls: React.PropTypes.bool,
  stackedStyle: React.PropTypes.string,
  seriesLimit: React.PropTypes.number,
};

const defaultProps = {
  showControls: false,
  stackedStxyle: null,
  seriesLimit: null,
};

const AreaChartOptions = (props) => {
  const checkBoxes = areaCheckBoxes.map((k) => (
    {
      key: k,
      label: checkBoxLabels[k],
      checked: props[k],
    }));
  const selects = [
    {
      key: 'stackedStyle',
      title: 'Chart Style',
      options: formatSelectOptions(stackedStyleOptions),
      value: props.stackedStyle,
    },
    {
      key: 'seriesLimit',
      title: 'Series Limit',
      options: formatSelectOptions(seriesLimitOptions),
      value: props.seriesLimit,
    }];

  return (
    <div className="panel space-1">
      <div className="panel-body">
        <CheckBoxArray checkBoxArray={checkBoxes} />
        <SelectArray selectArray={selects} />
      </div>
    </div>
  );
};

AreaChartOptions.propTypes = propTypes;
AreaChartOptions.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    showControls: state.viz.formData.showControls,
    stackedStyle: state.viz.formData.stackedStyle,
    seriesLimit: state.viz.formData.seriesLimit,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(AreaChartOptions);
