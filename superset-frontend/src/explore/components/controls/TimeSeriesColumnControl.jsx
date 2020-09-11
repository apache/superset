/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import {
  Row,
  Col,
  FormControl,
  OverlayTrigger,
  Popover,
} from 'react-bootstrap';
import Select from 'src/components/Select';
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

import BoundsControl from './BoundsControl';
import CheckboxControl from './CheckboxControl';

const propTypes = {
  label: PropTypes.string,
  tooltip: PropTypes.string,
  colType: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
  timeLag: PropTypes.string,
  timeRatio: PropTypes.string,
  comparisonType: PropTypes.string,
  showYAxis: PropTypes.bool,
  yAxisBounds: PropTypes.array,
  bounds: PropTypes.array,
  d3format: PropTypes.string,
  dateFormat: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
  label: t('Time Series Columns'),
  tooltip: '',
  colType: '',
  width: '',
  height: '',
  timeLag: '',
  timeRatio: '',
  comparisonType: '',
  showYAxis: false,
  yAxisBounds: [null, null],
  bounds: [null, null],
  d3format: '',
  dateFormat: '',
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
    const state = {
      label: this.props.label,
      tooltip: this.props.tooltip,
      colType: this.props.colType,
      width: this.props.width,
      height: this.props.height,
      timeLag: this.props.timeLag || 0,
      timeRatio: this.props.timeRatio,
      comparisonType: this.props.comparisonType,
      showYAxis: this.props.showYAxis,
      yAxisBounds: this.props.yAxisBounds,
      bounds: this.props.bounds,
      d3format: this.props.d3format,
      dateFormat: this.props.dateFormat,
    };
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
  onCheckboxChange(attr, value) {
    this.setState({ [attr]: value }, this.onChange);
  }
  onBoundsChange(bounds) {
    this.setState({ bounds }, this.onChange);
  }
  onYAxisBoundsChange(yAxisBounds) {
    this.setState({ yAxisBounds }, this.onChange);
  }
  setType() {}
  textSummary() {
    return `${this.state.label}`;
  }
  edit() {}
  formRow(label, tooltip, ttLabel, control) {
    return (
      <Row style={{ marginTop: '5px' }}>
        <Col md={5}>
          {`${label} `}
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
        <div style={{ width: 300 }}>
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
          {this.state.colType === 'spark' &&
            this.formRow(
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
          {this.state.colType === 'spark' &&
            this.formRow(
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
          {['time', 'avg'].indexOf(this.state.colType) >= 0 &&
            this.formRow(
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
          {['spark'].indexOf(this.state.colType) >= 0 &&
            this.formRow(
              'Time Ratio',
              'Number of periods to ratio against',
              'time-ratio',
              <FormControl
                value={this.state.timeRatio}
                onChange={this.onTextInputChange.bind(this, 'timeRatio')}
                bsSize="small"
                placeholder="Time Ratio"
              />,
            )}
          {this.state.colType === 'time' &&
            this.formRow(
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
          {this.state.colType === 'spark' &&
            this.formRow(
              'Show Y-axis',
              'Show Y-axis on the sparkline. Will display the manually set min/max if set or min/max values in the data otherwise.',
              'show-y-axis-bounds',
              <CheckboxControl
                value={this.state.showYAxis}
                onChange={this.onCheckboxChange.bind(this, 'showYAxis')}
              />,
            )}
          {this.state.colType === 'spark' &&
            this.formRow(
              'Y-axis bounds',
              'Manually set min/max values for the y-axis.',
              'y-axis-bounds',
              <BoundsControl
                value={this.state.yAxisBounds}
                onChange={this.onYAxisBoundsChange.bind(this)}
              />,
            )}
          {this.state.colType !== 'spark' &&
            this.formRow(
              'Color bounds',
              `Number bounds used for color encoding from red to blue.
              Reverse the numbers for blue to red. To get pure red or blue,
              you can enter either only min or max.`,
              'bounds',
              <BoundsControl
                value={this.state.bounds}
                onChange={this.onBoundsChange.bind(this)}
              />,
            )}
          {this.formRow(
            'Number format',
            'Optional d3 number format string',
            'd3-format',
            <FormControl
              value={this.state.d3format}
              onChange={this.onTextInputChange.bind(this, 'd3format')}
              bsSize="small"
              placeholder="Number format string"
            />,
          )}
          {this.state.colType === 'spark' &&
            this.formRow(
              'Date format',
              'Optional d3 date format string',
              'date-format',
              <FormControl
                value={this.state.dateFormat}
                onChange={this.onTextInputChange.bind(this, 'dateFormat')}
                bsSize="small"
                placeholder="Date format string"
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
