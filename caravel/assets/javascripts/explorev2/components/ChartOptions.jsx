import React from 'react';
import Select from 'react-select';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { Checkbox } from 'react-bootstrap';
import { checkBoxLabels } from '../stores/store';
import { lineStyleOptions, yAxisOptions, timestampOptions } from '../constants';

const propTypes = {
  actions: React.PropTypes.object,
  lineStyle: React.PropTypes.string,
  xFormat: React.PropTypes.string,
  yFormat: React.PropTypes.string,
  showBrush: React.PropTypes.bool,
  showLegend: React.PropTypes.bool,
  richTooltip: React.PropTypes.bool,
  yAxisZero: React.PropTypes.bool,
  yLogScale: React.PropTypes.bool,
  contribution: React.PropTypes.bool,
  showMarkers: React.PropTypes.bool,
  xAxisShowminmax: React.PropTypes.bool,
};

const defaultProps = {
  lineStyle: null,
  xFormat: null,
  yFormat: null,
  showBrush: false,
  showLegend: false,
  richTooltip: false,
  yAxisZero: false,
  yLogScale: false,
  contribution: false,
  showMarkers: false,
  xAxisShowminmax: false,
};

class ChartOptions extends React.Component {
  onToggle(checkBoxKey) {
    this.props.actions.toggleCheckBox(checkBoxKey);
  }
  changeSelectData(field, opt) {
    const val = opt ? opt.value : null;
    this.props.actions.setStateValue(field, val);
  }
  changeInput(field, event) {
    this.props.actions.setStateValue(field, event.target.value);
  }
  render() {
    const checkBoxes = Object.keys(checkBoxLabels).map((k) => (
      <Checkbox
        inline
        onChange={this.onToggle.bind(this, k)}
        key={k}
        checked={this.props[k]}
      >
        {checkBoxLabels[k]}
      </Checkbox>
    ));

    return (
      <div className="panel space-1">
        <div className="panel-header">Chart Options</div>
        <div className="panel-body">
          {checkBoxes}
          <h5 className="section-heading">Line Style</h5>
          <Select
            className="row"
            name="select-line-style"
            placeholder={'Select a line interpolation'}
            options={lineStyleOptions.map((o) => ({ value: o, label: o }))}
            value={this.props.lineStyle}
            autosize={false}
            onChange={this.changeSelectData.bind(this, 'lineStyle')}
          />
          <div className="col-sm-6">
            <h5 className="section-heading">X Axis Format</h5>
            <Select
              name="select-x-axis"
              placeholder={'Select X axis format'}
              options={timestampOptions.map((o) => ({ value: o[0], label: o[1] }))}
              value={this.props.xFormat}
              autosize={false}
              onChange={this.changeSelectData.bind(this, 'xFormat')}
            />
          </div>
          <div className="col-sm-6">
            <h5 className="section-heading">Y Axis Format</h5>
            <Select
              name="select-y-axis"
              placeholder={'Select Y axis format'}
              options={yAxisOptions.map((o) => ({ value: o[0], label: o[1] }))}
              value={this.props.yFormat}
              autosize={false}
              onChange={this.changeSelectData.bind(this, 'yFormat')}
            />
          </div>
          <div className="col-sm-6">
            <h5 className="section-heading">X Axis Label</h5>
            <input
              type="text"
              onChange={this.changeInput.bind(this, 'xLabel')}
              className="form-control input-sm"
              placeholder="X Axis Label"
            />
          </div>
          <div className="col-sm-6">
            <h5 className="section-heading">Y Axis Label</h5>
            <input
              type="text"
              onChange={this.changeInput.bind(this, 'yLabel')}
              className="form-control input-sm"
              placeholder="Y Axis Label"
            />
          </div>
        </div>
      </div>
    );
  }
}

ChartOptions.propTypes = propTypes;
ChartOptions.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    lineStyle: state.lineStyle,
    xFormat: state.xFormat,
    yFormat: state.yFormat,
    showBrush: state.showBrush,
    showLegend: state.showLegend,
    richTooltip: state.richTooltip,
    yAxisZero: state.yAxisZero,
    yLogScale: state.yLogScale,
    contribution: state.contribution,
    showMarkers: state.showMarkers,
    xAxisShowminmax: state.xAxisShowminmax,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(ChartOptions);
