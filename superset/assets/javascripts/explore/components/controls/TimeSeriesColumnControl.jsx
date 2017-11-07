import React from 'react';
import PropTypes from 'prop-types';
import {
  Row, Col, FormControl, OverlayTrigger, Popover,
} from 'react-bootstrap';
import Select from 'react-select';

import InfoTooltipWithTrigger from '../../../components/InfoTooltipWithTrigger';
import BoundsControl from './BoundsControl';

const propTypes = {
  onChange: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
};

const comparisonTypeOptions = [
  { value: 'value', label: 'Actual value' },
  { value: 'diff', label: 'Difference' },
  { value: 'perc', label: 'Percentage' },
  { value: 'perc_change', label: 'Percentage Change' },
];

const colTypeOptions = [
  { value: 'time', label: 'Time Comparison' },
  { value: 'contrib', label: 'Contribution' },
  { value: 'spark', label: 'Sparkline' },
  { value: 'avg', label: 'Period Average' },
];

export default class TimeSeriesColumnControl extends React.Component {
  constructor(props) {
    super(props);
    const state = Object.assign({}, props);
    delete state.onChange;
    this.state = state;
    this.onChange = this.onChange.bind(this);
  }
  onChange() {
    this.props.onChange(this.state);
  }
  onSelectChange(attr, opt) {
    this.setState({ [attr]: opt.value }, this.onChange);
  }
  onTextInputChange(attr, event) {
    this.setState({ [attr]: event.target.value }, this.onChange);
  }
  onBoundsChange(bounds) {
    this.setState({ bounds }, this.onChange);
  }
  setType() {
  }
  textSummary() {
    return `${this.state.label}`;
  }
  edit() {
  }
  formRow(label, tooltip, ttLabel, control) {
    return (
      <Row style={{ marginTop: '5px' }}>
        <Col md={5}>
          {label}{' '}
          <InfoTooltipWithTrigger
            placement="top"
            tooltip={tooltip}
            label={ttLabel}
          />
        </Col>
        <Col md={7}>{control}</Col>
      </Row>
    );
  }
  renderPopover() {
    return (
      <Popover id="ts-col-popo" title="Column Configuration">
        <div style={{ width: '280px' }}>
          {this.formRow(
            'Label',
            'The column header label',
            'time-lag',
            <FormControl
              value={this.state.label}
              onChange={this.onTextInputChange.bind(this, 'label')}
              bsSize="small"
              placeholder="Label"
            />,
          )}
          {this.formRow(
            'Tooltip',
            'Column header tooltip',
            'col-tooltip',
            <FormControl
              value={this.state.tooltip}
              onChange={this.onTextInputChange.bind(this, 'tooltip')}
              bsSize="small"
              placeholder="Tooltip"
            />,
          )}
          {this.formRow(
            'Type',
            'Type of comparison, value difference or percentage',
            'col-type',
            <Select
              value={this.state.colType}
              clearable={false}
              onChange={this.onSelectChange.bind(this, 'colType')}
              options={colTypeOptions}
            />,
          )}
          <hr />
          {this.state.colType === 'spark' && this.formRow(
            'Width',
            'Width of the sparkline',
            'spark-width',
            <FormControl
              value={this.state.width}
              onChange={this.onTextInputChange.bind(this, 'width')}
              bsSize="small"
              placeholder="Width"
            />,
          )}
          {this.state.colType === 'spark' && this.formRow(
            'Height',
            'Height of the sparkline',
            'spark-width',
            <FormControl
              value={this.state.height}
              onChange={this.onTextInputChange.bind(this, 'height')}
              bsSize="small"
              placeholder="height"
            />,
          )}
          {['time', 'avg'].indexOf(this.state.colType) >= 0 && this.formRow(
            'Time Lag',
            'Number of periods to compare against',
            'time-lag',
            <FormControl
              value={this.state.timeLag}
              onChange={this.onTextInputChange.bind(this, 'timeLag')}
              bsSize="small"
              placeholder="Time Lag"
            />,
          )}
          {['spark'].indexOf(this.state.colType) >= 0 && this.formRow(
            'Time Ratio',
            'Number of periods to ratio against',
            'time-ratio',
            <FormControl
              value={this.state.timeRatio}
              onChange={this.onTextInputChange.bind(this, 'timeRatio')}
              bsSize="small"
              placeholder="Time Lag"
            />,
          )}
          {this.state.colType === 'time' && this.formRow(
            'Type',
            'Type of comparison, value difference or percentage',
            'comp-type',
            <Select
              value={this.state.comparisonType}
              clearable={false}
              onChange={this.onSelectChange.bind(this, 'comparisonType')}
              options={comparisonTypeOptions}
            />,
          )}
          {this.state.colType !== 'spark' && this.formRow(
            'Bounds',
            (
              'Number bounds used for color coding from red to green. ' +
              'Reverse the number for green to red. To get boolean ' +
              'red or green without spectrum, you can use either only ' +
              'min, or max, depending on whether small or big should be ' +
              'green or red.'
            ),
            'bounds',
            <BoundsControl
              value={this.state.bounds}
              onChange={this.onBoundsChange.bind(this)}
            />,
          )}
          {this.formRow(
            'D3 format',
            'D3 format string',
            'd3-format',
            <FormControl
              value={this.state.d3format}
              onChange={this.onTextInputChange.bind(this, 'd3format')}
              bsSize="small"
              placeholder="D3 format string"
            />,
          )}
        </div>
      </Popover>
    );
  }
  render() {
    return (
      <span>
        {this.textSummary()}{' '}
        <OverlayTrigger
          container={document.body}
          trigger="click"
          rootClose
          ref="trigger"
          placement="right"
          overlay={this.renderPopover()}
        >
          <InfoTooltipWithTrigger
            icon="edit"
            className="text-primary"
            onClick={this.edit.bind(this)}
            label="edit-ts-column"
          />
        </OverlayTrigger>
      </span>
    );
  }
}

TimeSeriesColumnControl.propTypes = propTypes;
TimeSeriesColumnControl.defaultProps = defaultProps;
