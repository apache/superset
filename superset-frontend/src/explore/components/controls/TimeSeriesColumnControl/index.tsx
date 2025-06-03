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
import { Component } from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Col,
  Divider,
  InfoTooltip,
  Input,
  Row,
  Select,
} from '@superset-ui/core/components';
import { t, styled } from '@superset-ui/core';
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
  { value: 'value', label: t('Actual value'), key: 'value' },
  { value: 'diff', label: t('Difference'), key: 'diff' },
  { value: 'perc', label: t('Percentage'), key: 'perc' },
  { value: 'perc_change', label: t('Percentage change'), key: 'perc_change' },
];

const colTypeOptions = [
  { value: 'time', label: t('Time comparison'), key: 'time' },
  { value: 'contrib', label: t('Contribution'), key: 'contrib' },
  { value: 'spark', label: t('Sparkline'), key: 'spark' },
  { value: 'avg', label: t('Period average'), key: 'avg' },
];

const StyledRow = styled(Row)`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  display: flex;
  align-items: center;
`;

const StyledCol = styled(Col)`
  display: flex;
  align-items: center;
`;

const StyledTooltip = styled(InfoTooltip)`
  margin-left: ${({ theme }) => theme.sizeUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

const ButtonBar = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 5}px;
  display: flex;
  justify-content: center;
`;

export default class TimeSeriesColumnControl extends Component {
  constructor(props: $TSFixMe) {
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
      // @ts-expect-error TS(2339): Property 'label' does not exist on type 'Readonly<... Remove this comment to see the full error message
      label: this.props.label,
      // @ts-expect-error TS(2339): Property 'tooltip' does not exist on type 'Readonl... Remove this comment to see the full error message
      tooltip: this.props.tooltip,
      // @ts-expect-error TS(2339): Property 'colType' does not exist on type 'Readonl... Remove this comment to see the full error message
      colType: this.props.colType,
      // @ts-expect-error TS(2339): Property 'width' does not exist on type 'Readonly<... Remove this comment to see the full error message
      width: this.props.width,
      // @ts-expect-error TS(2339): Property 'height' does not exist on type 'Readonly... Remove this comment to see the full error message
      height: this.props.height,
      // @ts-expect-error TS(2339): Property 'timeLag' does not exist on type 'Readonl... Remove this comment to see the full error message
      timeLag: this.props.timeLag || 0,
      // @ts-expect-error TS(2339): Property 'timeRatio' does not exist on type 'Reado... Remove this comment to see the full error message
      timeRatio: this.props.timeRatio,
      // @ts-expect-error TS(2339): Property 'comparisonType' does not exist on type '... Remove this comment to see the full error message
      comparisonType: this.props.comparisonType,
      // @ts-expect-error TS(2339): Property 'showYAxis' does not exist on type 'Reado... Remove this comment to see the full error message
      showYAxis: this.props.showYAxis,
      // @ts-expect-error TS(2339): Property 'yAxisBounds' does not exist on type 'Rea... Remove this comment to see the full error message
      yAxisBounds: this.props.yAxisBounds,
      // @ts-expect-error TS(2339): Property 'bounds' does not exist on type 'Readonly... Remove this comment to see the full error message
      bounds: this.props.bounds,
      // @ts-expect-error TS(2339): Property 'd3format' does not exist on type 'Readon... Remove this comment to see the full error message
      d3format: this.props.d3format,
      // @ts-expect-error TS(2339): Property 'dateFormat' does not exist on type 'Read... Remove this comment to see the full error message
      dateFormat: this.props.dateFormat,
      popoverVisible: false,
    };
  }

  resetState() {
    const initialState = this.initialState();
    this.setState({ ...initialState });
  }

  onSave() {
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(this.state);
    this.setState({ popoverVisible: false });
  }

  onClose() {
    this.resetState();
  }

  onSelectChange(attr: $TSFixMe, opt: $TSFixMe) {
    this.setState({ [attr]: opt });
  }

  onTextInputChange(attr: $TSFixMe, event: $TSFixMe) {
    this.setState({ [attr]: event.target.value });
  }

  onCheckboxChange(attr: $TSFixMe, value: $TSFixMe) {
    this.setState({ [attr]: value });
  }

  onBoundsChange(bounds: $TSFixMe) {
    this.setState({ bounds });
  }

  onPopoverVisibleChange(popoverVisible: $TSFixMe) {
    if (popoverVisible) {
      this.setState({ popoverVisible });
    } else {
      this.resetState();
    }
  }

  onYAxisBoundsChange(yAxisBounds: $TSFixMe) {
    this.setState({ yAxisBounds });
  }

  textSummary() {
    // @ts-expect-error TS(2339): Property 'label' does not exist on type 'Readonly<... Remove this comment to see the full error message
    return `${this.props.label}`;
  }

  formRow(
    label: $TSFixMe,
    tooltip: $TSFixMe,
    ttLabel: $TSFixMe,
    control: $TSFixMe,
  ) {
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
          t('Label'),
          t('The column header label'),
          'time-lag',
          <Input
            // @ts-expect-error TS(2339): Property 'label' does not exist on type 'Readonly<... Remove this comment to see the full error message
            value={this.state.label}
            onChange={this.onTextInputChange.bind(this, 'label')}
            placeholder={t('Label')}
          />,
        )}
        {this.formRow(
          t('Tooltip'),
          t('Column header tooltip'),
          'col-tooltip',
          <Input
            // @ts-expect-error TS(2339): Property 'tooltip' does not exist on type 'Readonl... Remove this comment to see the full error message
            value={this.state.tooltip}
            onChange={this.onTextInputChange.bind(this, 'tooltip')}
            placeholder={t('Tooltip')}
          />,
        )}
        {this.formRow(
          t('Type'),
          t('Type of comparison, value difference or percentage'),
          'col-type',
          <Select
            ariaLabel={t('Type')}
            // @ts-expect-error TS(2339): Property 'colType' does not exist on type 'Readonl... Remove this comment to see the full error message
            value={this.state.colType || undefined}
            onChange={this.onSelectChange.bind(this, 'colType')}
            options={colTypeOptions}
          />,
        )}
        <Divider />
        // @ts-expect-error TS(2339): Property 'colType' does not exist on type
        'Readonl... Remove this comment to see the full error message
        {this.state.colType === 'spark' &&
          this.formRow(
            t('Width'),
            t('Width of the sparkline'),
            'spark-width',
            <Input
              // @ts-expect-error TS(2339): Property 'width' does not exist on type 'Readonly<... Remove this comment to see the full error message
              value={this.state.width}
              onChange={this.onTextInputChange.bind(this, 'width')}
              placeholder={t('Width')}
            />,
          )}
        // @ts-expect-error TS(2339): Property 'colType' does not exist on type
        'Readonl... Remove this comment to see the full error message
        {this.state.colType === 'spark' &&
          this.formRow(
            t('Height'),
            t('Height of the sparkline'),
            'spark-width',
            <Input
              // @ts-expect-error TS(2339): Property 'height' does not exist on type 'Readonly... Remove this comment to see the full error message
              value={this.state.height}
              onChange={this.onTextInputChange.bind(this, 'height')}
              placeholder={t('Height')}
            />,
          )}
        // @ts-expect-error TS(2339): Property 'colType' does not exist on type
        'Readonl... Remove this comment to see the full error message
        {['time', 'avg'].indexOf(this.state.colType) >= 0 &&
          this.formRow(
            t('Time lag'),
            t(
              'Number of periods to compare against. You can use negative numbers to compare from the beginning of the time range.',
            ),
            'time-lag',
            <Input
              // @ts-expect-error TS(2339): Property 'timeLag' does not exist on type 'Readonl... Remove this comment to see the full error message
              value={this.state.timeLag}
              onChange={this.onTextInputChange.bind(this, 'timeLag')}
              placeholder={t('Time Lag')}
            />,
          )}
        // @ts-expect-error TS(2339): Property 'colType' does not exist on type
        'Readonl... Remove this comment to see the full error message
        {['spark'].indexOf(this.state.colType) >= 0 &&
          this.formRow(
            t('Time ratio'),
            t('Number of periods to ratio against'),
            'time-ratio',
            <Input
              // @ts-expect-error TS(2339): Property 'timeRatio' does not exist on type 'Reado... Remove this comment to see the full error message
              value={this.state.timeRatio}
              onChange={this.onTextInputChange.bind(this, 'timeRatio')}
              placeholder={t('Time Ratio')}
            />,
          )}
        // @ts-expect-error TS(2339): Property 'colType' does not exist on type
        'Readonl... Remove this comment to see the full error message
        {this.state.colType === 'time' &&
          this.formRow(
            t('Type'),
            t('Type of comparison, value difference or percentage'),
            'comp-type',
            <Select
              ariaLabel={t('Type')}
              // @ts-expect-error TS(2339): Property 'comparisonType' does not exist on type '... Remove this comment to see the full error message
              value={this.state.comparisonType || undefined}
              onChange={this.onSelectChange.bind(this, 'comparisonType')}
              options={comparisonTypeOptions}
            />,
          )}
        // @ts-expect-error TS(2339): Property 'colType' does not exist on type
        'Readonl... Remove this comment to see the full error message
        {this.state.colType === 'spark' &&
          this.formRow(
            t('Show Y-axis'),
            t(
              'Show Y-axis on the sparkline. Will display the manually set min/max if set or min/max values in the data otherwise.',
            ),
            'show-y-axis-bounds',
            <CheckboxControl
              // @ts-expect-error TS(2769): No overload matches this call.
              value={this.state.showYAxis}
              onChange={this.onCheckboxChange.bind(this, 'showYAxis')}
            />,
          )}
        // @ts-expect-error TS(2339): Property 'colType' does not exist on type
        'Readonl... Remove this comment to see the full error message
        {this.state.colType === 'spark' &&
          this.formRow(
            t('Y-axis bounds'),
            t('Manually set min/max values for the y-axis.'),
            'y-axis-bounds',
            <BoundsControl
              // @ts-expect-error TS(2339): Property 'yAxisBounds' does not exist on type 'Rea... Remove this comment to see the full error message
              value={this.state.yAxisBounds}
              onChange={this.onYAxisBoundsChange.bind(this)}
            />,
          )}
        // @ts-expect-error TS(2339): Property 'colType' does not exist on type
        'Readonl... Remove this comment to see the full error message
        {this.state.colType !== 'spark' &&
          this.formRow(
            t('Color bounds'),
            t(`Number bounds used for color encoding from red to blue.
               Reverse the numbers for blue to red. To get pure red or blue,
               you can enter either only min or max.`),
            'bounds',
            <BoundsControl
              // @ts-expect-error TS(2339): Property 'bounds' does not exist on type 'Readonly... Remove this comment to see the full error message
              value={this.state.bounds}
              onChange={this.onBoundsChange.bind(this)}
            />,
          )}
        {this.formRow(
          t('Number format'),
          t('Optional d3 number format string'),
          'd3-format',
          <Input
            // @ts-expect-error TS(2339): Property 'd3format' does not exist on type 'Readon... Remove this comment to see the full error message
            value={this.state.d3format}
            onChange={this.onTextInputChange.bind(this, 'd3format')}
            placeholder={t('Number format string')}
          />,
        )}
        // @ts-expect-error TS(2339): Property 'colType' does not exist on type
        'Readonl... Remove this comment to see the full error message
        {this.state.colType === 'spark' &&
          this.formRow(
            t('Date format'),
            t('Optional d3 date format string'),
            'date-format',
            <Input
              // @ts-expect-error TS(2339): Property 'dateFormat' does not exist on type 'Read... Remove this comment to see the full error message
              value={this.state.dateFormat}
              onChange={this.onTextInputChange.bind(this, 'dateFormat')}
              placeholder={t('Date format string')}
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
          title={t('Column Configuration')}
          // @ts-expect-error TS(2339): Property 'popoverVisible' does not exist on type '... Remove this comment to see the full error message
          open={this.state.popoverVisible}
          onOpenChange={this.onPopoverVisibleChange}
        >
          <InfoTooltip
            // @ts-expect-error TS(2322): Type '{ icon: string; className: string; label: st... Remove this comment to see the full error message
            icon="edit"
            className="text-primary"
            label="edit-ts-column"
          />
        </ControlPopover>
      </span>
    );
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
TimeSeriesColumnControl.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
TimeSeriesColumnControl.defaultProps = defaultProps;
