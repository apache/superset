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
import { useState, useCallback } from 'react';
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

const TimeSeriesColumnControl = props => {
  // Initialize state with props
  const getInitialState = () => ({
    label: props.label,
    tooltip: props.tooltip,
    colType: props.colType,
    width: props.width,
    height: props.height,
    timeLag: props.timeLag || 0,
    timeRatio: props.timeRatio,
    comparisonType: props.comparisonType,
    showYAxis: props.showYAxis,
    yAxisBounds: props.yAxisBounds,
    bounds: props.bounds,
    d3format: props.d3format,
    dateFormat: props.dateFormat,
    popoverVisible: false,
  });

  const [state, setState] = useState(getInitialState());

  // Reset state to initial values
  const resetState = useCallback(() => {
    setState(getInitialState());
  }, [props]);

  // Save changes and close popover
  const onSave = useCallback(() => {
    props.onChange(state);
    setState(prevState => ({ ...prevState, popoverVisible: false }));
  }, [props.onChange, state]);

  // Close popover and reset state
  const onClose = useCallback(() => {
    resetState();
  }, [resetState]);

  // Handle select changes
  const onSelectChange = useCallback((attr, opt) => {
    setState(prevState => ({ ...prevState, [attr]: opt }));
  }, []);

  // Handle text input changes
  const onTextInputChange = useCallback((attr, event) => {
    setState(prevState => ({ ...prevState, [attr]: event.target.value }));
  }, []);

  // Handle checkbox changes
  const onCheckboxChange = useCallback((attr, value) => {
    setState(prevState => ({ ...prevState, [attr]: value }));
  }, []);

  // Handle bounds changes
  const onBoundsChange = useCallback(bounds => {
    setState(prevState => ({ ...prevState, bounds }));
  }, []);

  // Handle Y-axis bounds changes
  const onYAxisBoundsChange = useCallback(yAxisBounds => {
    setState(prevState => ({ ...prevState, yAxisBounds }));
  }, []);

  // Handle popover visibility changes
  const onPopoverVisibleChange = useCallback(
    popoverVisible => {
      if (popoverVisible) {
        setState(prevState => ({ ...prevState, popoverVisible }));
      } else {
        resetState();
      }
    },
    [resetState],
  );

  // Text summary
  const textSummary = useCallback(() => `${props.label}`, [props.label]);

  // Form row
  const formRow = (label, tooltip, ttLabel, control) => (
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

  // Render popover content
  const renderPopover = () => (
    <div id="ts-col-popo" style={{ width: 320 }}>
      {formRow(
        t('Label'),
        t('The column header label'),
        'time-lag',
        <Input
          value={state.label}
          onChange={e => onTextInputChange('label', e)}
          placeholder={t('Label')}
        />,
      )}
      {formRow(
        t('Tooltip'),
        t('Column header tooltip'),
        'col-tooltip',
        <Input
          value={state.tooltip}
          onChange={e => onTextInputChange('tooltip', e)}
          placeholder={t('Tooltip')}
        />,
      )}
      {formRow(
        t('Type'),
        t('Type of comparison, value difference or percentage'),
        'col-type',
        <Select
          ariaLabel={t('Type')}
          value={state.colType || undefined}
          onChange={value => onSelectChange('colType', value)}
          options={colTypeOptions}
        />,
      )}
      <hr />
      {state.colType === 'spark' &&
        formRow(
          t('Width'),
          t('Width of the sparkline'),
          'spark-width',
          <Input
            value={state.width}
            onChange={e => onTextInputChange('width', e)}
            placeholder={t('Width')}
          />,
        )}
      {state.colType === 'spark' &&
        formRow(
          t('Height'),
          t('Height of the sparkline'),
          'spark-width',
          <Input
            value={state.height}
            onChange={e => onTextInputChange('height', e)}
            placeholder={t('Height')}
          />,
        )}
      {['time', 'avg'].indexOf(state.colType) >= 0 &&
        formRow(
          t('Time lag'),
          t(
            'Number of periods to compare against. You can use negative numbers to compare from the beginning of the time range.',
          ),
          'time-lag',
          <Input
            value={state.timeLag}
            onChange={e => onTextInputChange('timeLag', e)}
            placeholder={t('Time Lag')}
          />,
        )}
      {['spark'].indexOf(state.colType) >= 0 &&
        formRow(
          t('Time ratio'),
          t('Number of periods to ratio against'),
          'time-ratio',
          <Input
            value={state.timeRatio}
            onChange={e => onTextInputChange('timeRatio', e)}
            placeholder={t('Time Ratio')}
          />,
        )}
      {state.colType === 'time' &&
        formRow(
          t('Type'),
          t('Type of comparison, value difference or percentage'),
          'comp-type',
          <Select
            ariaLabel={t('Type')}
            value={state.comparisonType || undefined}
            onChange={value => onSelectChange('comparisonType', value)}
            options={comparisonTypeOptions}
          />,
        )}
      {state.colType === 'spark' &&
        formRow(
          t('Show Y-axis'),
          t(
            'Show Y-axis on the sparkline. Will display the manually set min/max if set or min/max values in the data otherwise.',
          ),
          'show-y-axis-bounds',
          <CheckboxControl
            value={state.showYAxis}
            onChange={value => onCheckboxChange('showYAxis', value)}
          />,
        )}
      {state.colType === 'spark' &&
        formRow(
          t('Y-axis bounds'),
          t('Manually set min/max values for the y-axis.'),
          'y-axis-bounds',
          <BoundsControl
            value={state.yAxisBounds}
            onChange={onYAxisBoundsChange}
          />,
        )}
      {state.colType !== 'spark' &&
        formRow(
          t('Color bounds'),
          t(`Number bounds used for color encoding from red to blue.
             Reverse the numbers for blue to red. To get pure red or blue,
             you can enter either only min or max.`),
          'bounds',
          <BoundsControl value={state.bounds} onChange={onBoundsChange} />,
        )}
      {formRow(
        t('Number format'),
        t('Optional d3 number format string'),
        'd3-format',
        <Input
          value={state.d3format}
          onChange={e => onTextInputChange('d3format', e)}
          placeholder={t('Number format string')}
        />,
      )}
      {state.colType === 'spark' &&
        formRow(
          t('Date format'),
          t('Optional d3 date format string'),
          'date-format',
          <Input
            value={state.dateFormat}
            onChange={e => onTextInputChange('dateFormat', e)}
            placeholder={t('Date format string')}
          />,
        )}
      <ButtonBar>
        <Button buttonSize="small" onClick={onClose} cta>
          {t('Close')}
        </Button>
        <Button buttonStyle="primary" buttonSize="small" onClick={onSave} cta>
          {t('Save')}
        </Button>
      </ButtonBar>
    </div>
  );

  return (
    <span>
      {textSummary()}{' '}
      <ControlPopover
        trigger="click"
        content={renderPopover()}
        title={t('Column Configuration')}
        open={state.popoverVisible}
        onOpenChange={onPopoverVisibleChange}
      >
        <InfoTooltipWithTrigger
          icon="edit"
          className="text-primary"
          label="edit-ts-column"
        />
      </ControlPopover>
    </span>
  );
};

TimeSeriesColumnControl.propTypes = propTypes;
TimeSeriesColumnControl.defaultProps = defaultProps;

export default TimeSeriesColumnControl;
