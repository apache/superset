import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import CheckBoxArray from './CheckBoxArray';
import SelectArray from './SelectArray';
import { areaCheckBoxes, lineStyleOptions, chartStyleOptions,
  timestampOptions, yAxisOptions, checkBoxLabels } from '../constants';
import { getSelectOptions } from '../../../utils/common';

const propTypes = {
  actions: React.PropTypes.object,
  showBrush: React.PropTypes.bool,
  showLegend: React.PropTypes.bool,
  richTooltip: React.PropTypes.bool,
  yAxisZero: React.PropTypes.bool,
  yLogScale: React.PropTypes.bool,
  contribution: React.PropTypes.bool,
  showControl: React.PropTypes.bool,
  xAxisShowminmax: React.PropTypes.bool,
  xFormat: React.PropTypes.string,
  yFormat: React.PropTypes.string,
  lineStyle: React.PropTypes.string,
  chartStyle: React.PropTypes.string,
};

const defaultProps = {
  showBrush: false,
  showLegend: false,
  richTooltip: false,
  yAxisZero: false,
  yLogScale: false,
  contribution: false,
  showControl: false,
  xAxisShowminmax: false,
  xFormat: null,
  yFormat: null,
  lineStyle: null,
  chartStyle: null,
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
      key: 'lineStyle',
      title: 'Line Style',
      options: getSelectOptions(lineStyleOptions),
      value: props.lineStyle,
    },
    {
      key: 'chartStyle',
      title: 'Chart Style',
      options: getSelectOptions(chartStyleOptions),
      value: props.chartStyle,
    },
    {
      key: 'xFormat',
      title: 'X Axis Format',
      options: timestampOptions.map((o) => ({ value: o[0], label: o[1] })),
      value: props.xFormat,
    },
    {
      key: 'yFormat',
      title: 'Y Axis Format',
      options: yAxisOptions.map((o) => ({ value: o[0], label: o[1] })),
      value: props.yFormat,
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
    xFormat: state.viz.formData.xFormat,
    yFormat: state.viz.formData.yFormat,
    lineStyle: state.viz.formData.lineStyle,
    showControl: state.viz.formData.showControl,
    chartStyle: state.viz.formData.chartStyle,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(AreaChartOptions);
