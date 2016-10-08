import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import CheckBoxArray from './CheckBoxArray';
import SelectArray from './SelectArray';
import { areaCheckBoxes, lineInterpolationOptions, stackedStyleOptions, timestampOptions,
  yAxisOptions, checkBoxLabels, seriesLimitOptions } from '../constants';
import { getSelectOptions } from '../../../utils/common';

const propTypes = {
  actions: React.PropTypes.object,
  showBrush: React.PropTypes.bool,
  showLegend: React.PropTypes.bool,
  richTooltip: React.PropTypes.bool,
  yAxisZero: React.PropTypes.bool,
  yLogScale: React.PropTypes.bool,
  contribution: React.PropTypes.bool,
  showControls: React.PropTypes.bool,
  xAxisShowminmax: React.PropTypes.bool,
  xAxisFormat: React.PropTypes.string,
  yAxisFormat: React.PropTypes.string,
  lineInterpolation: React.PropTypes.string,
  stackedStyle: React.PropTypes.string,
  seriesLimit: React.PropTypes.number,
};

const defaultProps = {
  showBrush: false,
  showLegend: false,
  richTooltip: false,
  yAxisZero: false,
  yLogScale: false,
  contribution: false,
  showControls: false,
  xAxisShowminmax: false,
  xAxisFormat: null,
  yAxisFormat: null,
  lineInterpolation: null,
  stackedStyle: null,
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
      key: 'lineInterpolation',
      title: 'Line Style',
      options: getSelectOptions(lineInterpolationOptions),
      value: props.lineInterpolation,
    },
    {
      key: 'stackedStyle',
      title: 'Chart Style',
      options: getSelectOptions(stackedStyleOptions),
      value: props.stackedStyle,
    },
    {
      key: 'xAxisFormat',
      title: 'X Axis Format',
      options: timestampOptions.map((o) => ({ value: o[0], label: o[1] })),
      value: props.xAxisFormat,
    },
    {
      key: 'yAxisFormat',
      title: 'Y Axis Format',
      options: yAxisOptions.map((o) => ({ value: o[0], label: o[1] })),
      value: props.yAxisFormat,
    },
    {
      key: 'seriesLimit',
      title: 'Series Limit',
      options: getSelectOptions(seriesLimitOptions),
      value: props.seriesLimit,
      width: '12',
    }];

  return (
    <div className="panel space-1">
      <div className="panel-header">Chart Options</div>
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
    showBrush: state.viz.formData.showBrush,
    showLegend: state.viz.formData.showLegend,
    richTooltip: state.viz.formData.richTooltip,
    yAxisZero: state.viz.formData.yAxisZero,
    yLogScale: state.viz.formData.yLogScale,
    contribution: state.viz.formData.contribution,
    xAxisShowminmax: state.viz.formData.xAxisShowminmax,
    showControls: state.viz.formData.showControls,
    xAxisFormat: state.viz.formData.xAxisFormat,
    yAxisFormat: state.viz.formData.yAxisFormat,
    lineInterpolation: state.viz.formData.lineInterpolation,
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
