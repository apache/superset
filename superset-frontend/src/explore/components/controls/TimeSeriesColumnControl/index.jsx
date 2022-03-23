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
import { Input } from 'src/components/Input';
import Button from 'src/components/Button';
import { Select, Row, Col } from 'src/components';
import { t, styled } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import BoundsControl from '../BoundsControl';
import CheckboxControl from '../CheckboxControl';
import ControlPopover from '../ControlPopover/ControlPopover';

const propTypes = {
  label: PropTypes.string,
  tooltip: PropTypes.string,
  colType: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
  timeLag: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
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
  label: t('Time series columns'),
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
};

const comparisonTypeOptions = [
  { value: 'value', label: 'Actual value', key: 'value' },
  { value: 'diff', label: 'Difference', key: 'diff' },
  { value: 'perc', label: 'Percentage', key: 'perc' },
  { value: 'perc_change', label: 'Percentage change', key: 'perc_change' },
];

const colTypeOptions = [
  { value: 'time', label: 'Time comparison', key: 'time' },
  { value: 'contrib', label: 'Contribution', key: 'contrib' },
  { value: 'spark', label: 'Sparkline', key: 'spark' },
  { value: 'avg', label: 'Period average', key: 'avg' },
];

const StyledRow = styled(Row)`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  display: flex;
  align-items: center;
`;

const StyledCol = styled(Col)`
  display: flex;
  align-items: center;
`;

const StyledTooltip = styled(InfoTooltipWithTrigger)`
  margin-left: ${({ theme }) => theme.gridUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

const ButtonBar = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 5}px;
  display: flex;
  justify-content: center;
`;

export default class TimeSeriesColumnControl extends React.Component {
  constructor(props) {
    super(props);

    this.onSave = this.onSave.bind(this);
    this.onClose = this.onClose.bind(this);
    this.resetState = this.resetState.bind(this);
    this.initialState = this.initialState.bind(this);
    this.onPopoverVisibleChange = this.onPopoverVisibleChange.bind(this);

    this.state = this.initialState();
  }

  initialState() {
    return {
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
      popoverVisible: false,
    };
  }

  resetState() {
    const initialState = this.initialState();
    this.setState({ ...initialState });
  }

  onSave() {
    this.props.onChange(this.state);
    this.setState({ popoverVisible: false });
  }

  onClose() {
    this.resetState();
  }

  onSelectChange(attr, opt) {
    this.setState({ [attr]: opt });
  }

  onTextInputChange(attr, event) {
    this.setState({ [attr]: event.target.value });
  }

  onCheckboxChange(attr, value) {
    this.setState({ [attr]: value });
  }

  onBoundsChange(bounds) {
    this.setState({ bounds });
  }

  onPopoverVisibleChange(popoverVisible) {
    if (popoverVisible) {
      this.setState({ popoverVisible });
    } else {
      this.resetState();
    }
  }

  onYAxisBoundsChange(yAxisBounds) {
    this.setState({ yAxisBounds });
  }

  textSummary() {
    return `${this.props.label}`;
  }

  formRow(label, tooltip, ttLabel, control) {
    return (
      <StyledRow>
        <StyledCol xs={24} md={11}>
          {label}
          <StyledTooltip placement="top" tooltip={tooltip} label={ttLabel} />
        </StyledCol>
        <Col xs={24} md={13}>
          {control}
        </Col>
      </StyledRow>
    );
  }

  renderPopover() {
    return (
      <div id="ts-col-popo" style={{ width: 320 }}>
        {this.formRow(
          'Label',
          'The column header label',
          'time-lag',
          <Input
            value={this.state.label}
            onChange={this.onTextInputChange.bind(this, 'label')}
            placeholder="Label"
          />,
        )}
        {this.formRow(
          'Tooltip',
          'Column header tooltip',
          'col-tooltip',
          <Input
            value={this.state.tooltip}
            onChange={this.onTextInputChange.bind(this, 'tooltip')}
            placeholder="Tooltip"
          />,
        )}
        {this.formRow(
          'Type',
          'Type of comparison, value difference or percentage',
          'col-type',
          <Select
            ariaLabel={t('Type')}
            value={this.state.colType || undefined}
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
            <Input
              value={this.state.width}
              onChange={this.onTextInputChange.bind(this, 'width')}
              placeholder="Width"
            />,
          )}
        {this.state.colType === 'spark' &&
          this.formRow(
            'Height',
            'Height of the sparkline',
            'spark-width',
            <Input
              value={this.state.height}
              onChange={this.onTextInputChange.bind(this, 'height')}
              placeholder="Height"
            />,
          )}
        {['time', 'avg'].indexOf(this.state.colType) >= 0 &&
          this.formRow(
            'Time lag',
            'Number of periods to compare against',
            'time-lag',
            <Input
              value={this.state.timeLag}
              onChange={this.onTextInputChange.bind(this, 'timeLag')}
              placeholder="Time Lag"
            />,
          )}
        {['spark'].indexOf(this.state.colType) >= 0 &&
          this.formRow(
            'Time ratio',
            'Number of periods to ratio against',
            'time-ratio',
            <Input
              value={this.state.timeRatio}
              onChange={this.onTextInputChange.bind(this, 'timeRatio')}
              placeholder="Time Ratio"
            />,
          )}
        {this.state.colType === 'time' &&
          this.formRow(
            'Type',
            'Type of comparison, value difference or percentage',
            'comp-type',
            <Select
              ariaLabel={t('Type')}
              value={this.state.comparisonType || undefined}
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
          <Input
            value={this.state.d3format}
            onChange={this.onTextInputChange.bind(this, 'd3format')}
            placeholder="Number format string"
          />,
        )}
        {this.state.colType === 'spark' &&
          this.formRow(
            'Date format',
            'Optional d3 date format string',
            'date-format',
            <Input
              value={this.state.dateFormat}
              onChange={this.onTextInputChange.bind(this, 'dateFormat')}
              placeholder="Date format string"
            />,
          )}
        <ButtonBar>
          <Button buttonSize="small" onClick={this.onClose} cta>
            {t('Close')}
          </Button>
          <Button
            buttonStyle="primary"
            buttonSize="small"
            onClick={this.onSave}
            cta
          >
            {t('Save')}
          </Button>
        </ButtonBar>
      </div>
    );
  }

  render() {
    return (
      <span>
        {this.textSummary()}{' '}
        <ControlPopover
          trigger="click"
          content={this.renderPopover()}
          title="Column Configuration"
          visible={this.state.popoverVisible}
          onVisibleChange={this.onPopoverVisibleChange}
        >
          <InfoTooltipWithTrigger
            icon="edit"
            className="text-primary"
            label="edit-ts-column"
          />
        </ControlPopover>
      </span>
    );
  }
}

TimeSeriesColumnControl.propTypes = propTypes;
TimeSeriesColumnControl.defaultProps = defaultProps;
