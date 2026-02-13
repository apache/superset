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
import React, { useCallback, useState } from 'react';
import {
  Button,
  Col,
  Divider,
  InfoTooltip,
  Input,
  Row,
  Select,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import BoundsControl from '../BoundsControl';
import CheckboxControl from '../CheckboxControl';
import ControlPopover from '../ControlPopover/ControlPopover';

interface TimeSeriesColumnControlProps {
  label?: string;
  tooltip?: string;
  colType?: string;
  width?: string;
  height?: string;
  timeLag?: string | number;
  timeRatio?: string;
  comparisonType?: string;
  showYAxis?: boolean;
  yAxisBounds?: (number | null)[];
  bounds?: (number | null)[];
  d3format?: string;
  dateFormat?: string;
  sparkType?: string;
  onChange?: (state: TimeSeriesColumnControlState) => void;
}

interface TimeSeriesColumnControlState {
  label: string;
  tooltip: string;
  colType: string;
  width: string;
  height: string;
  timeLag: string | number;
  timeRatio: string;
  comparisonType: string;
  showYAxis: boolean;
  yAxisBounds: (number | null)[];
  bounds: (number | null)[];
  d3format: string;
  dateFormat: string;
  sparkType: string;
  popoverVisible: boolean;
}

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

const sparkTypeOptions = [
  { value: 'line', label: t('Line Chart'), key: 'line' },
  { value: 'bar', label: t('Bar Chart'), key: 'bar' },
  { value: 'area', label: t('Area Chart'), key: 'area' },
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
  color: ${({ theme }) => theme.colorIcon};
`;

const ButtonBar = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 5}px;
  display: flex;
  justify-content: center;
`;

function TimeSeriesColumnControl({
  label: propLabel = t('Time series columns'),
  tooltip: propTooltip = '',
  colType: propColType = '',
  width: propWidth = '',
  height: propHeight = '',
  timeLag: propTimeLag = '',
  timeRatio: propTimeRatio = '',
  comparisonType: propComparisonType = '',
  showYAxis: propShowYAxis = false,
  yAxisBounds: propYAxisBounds = [null, null],
  bounds: propBounds = [null, null],
  d3format: propD3format = '',
  dateFormat: propDateFormat = '',
  sparkType: propSparkType = 'line',
  onChange,
}: TimeSeriesColumnControlProps) {
  const getInitialState = useCallback(
    (): TimeSeriesColumnControlState => ({
      label: propLabel ?? t('Time series columns'),
      tooltip: propTooltip ?? '',
      colType: propColType ?? '',
      width: propWidth ?? '',
      height: propHeight ?? '',
      timeLag: propTimeLag ?? 0,
      timeRatio: propTimeRatio ?? '',
      comparisonType: propComparisonType ?? '',
      showYAxis: propShowYAxis ?? false,
      yAxisBounds: propYAxisBounds ?? [null, null],
      bounds: propBounds ?? [null, null],
      d3format: propD3format ?? '',
      dateFormat: propDateFormat ?? '',
      sparkType: propSparkType ?? 'line',
      popoverVisible: false,
    }),
    [
      propLabel,
      propTooltip,
      propColType,
      propWidth,
      propHeight,
      propTimeLag,
      propTimeRatio,
      propComparisonType,
      propShowYAxis,
      propYAxisBounds,
      propBounds,
      propD3format,
      propDateFormat,
      propSparkType,
    ],
  );

  const [state, setState] =
    useState<TimeSeriesColumnControlState>(getInitialState());

  const resetState = useCallback(() => {
    setState(getInitialState());
  }, [getInitialState]);

  const onSave = useCallback(() => {
    onChange?.(state);
    setState(prev => ({ ...prev, popoverVisible: false }));
  }, [onChange, state]);

  const onClose = useCallback(() => {
    resetState();
  }, [resetState]);

  const onSelectChange = useCallback((attr: string, opt: string) => {
    setState(prev => ({ ...prev, [attr]: opt }));
  }, []);

  const onTextInputChange = useCallback(
    (attr: string, event: React.ChangeEvent<HTMLInputElement>) => {
      setState(prev => ({ ...prev, [attr]: event.target.value }));
    },
    [],
  );

  const onCheckboxChange = useCallback((attr: string, value: boolean) => {
    setState(prev => ({ ...prev, [attr]: value }));
  }, []);

  const onBoundsChange = useCallback((bounds: (number | null)[]) => {
    setState(prev => ({ ...prev, bounds }));
  }, []);

  const onPopoverVisibleChange = useCallback(
    (popoverVisible: boolean) => {
      if (popoverVisible) {
        setState(prev => ({ ...prev, popoverVisible }));
      } else {
        resetState();
      }
    },
    [resetState],
  );

  const onYAxisBoundsChange = useCallback((yAxisBounds: (number | null)[]) => {
    setState(prev => ({ ...prev, yAxisBounds }));
  }, []);

  const textSummary = useCallback(() => `${propLabel ?? ''}`, [propLabel]);

  const formRow = useCallback(
    (
      label: string,
      tooltip: string,
      ttLabel: string,
      control: React.ReactNode,
    ) => (
      <StyledRow>
        <StyledCol xs={24} md={11}>
          {label}
          <StyledTooltip placement="top" tooltip={tooltip} label={ttLabel} />
        </StyledCol>
        <Col xs={24} md={13}>
          {control}
        </Col>
      </StyledRow>
    ),
    [],
  );

  const renderPopover = useCallback(() => {
    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) =>
      onTextInputChange('label', e);
    const handleTooltipChange = (e: React.ChangeEvent<HTMLInputElement>) =>
      onTextInputChange('tooltip', e);
    const handleColTypeChange = (opt: string) => onSelectChange('colType', opt);
    const handleSparkTypeChange = (opt: string) =>
      onSelectChange('sparkType', opt);
    const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) =>
      onTextInputChange('width', e);
    const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) =>
      onTextInputChange('height', e);
    const handleTimeLagChange = (e: React.ChangeEvent<HTMLInputElement>) =>
      onTextInputChange('timeLag', e);
    const handleTimeRatioChange = (e: React.ChangeEvent<HTMLInputElement>) =>
      onTextInputChange('timeRatio', e);
    const handleComparisonTypeChange = (opt: string) =>
      onSelectChange('comparisonType', opt);
    const handleShowYAxisChange = (value: boolean) =>
      onCheckboxChange('showYAxis', value);
    const handleD3formatChange = (e: React.ChangeEvent<HTMLInputElement>) =>
      onTextInputChange('d3format', e);
    const handleDateFormatChange = (e: React.ChangeEvent<HTMLInputElement>) =>
      onTextInputChange('dateFormat', e);

    return (
      <div id="ts-col-popo" style={{ width: 320 }}>
        {formRow(
          t('Label'),
          t('The column header label'),
          'time-lag',
          <Input
            value={state.label}
            onChange={handleLabelChange}
            placeholder={t('Label')}
          />,
        )}
        {formRow(
          t('Tooltip'),
          t('Column header tooltip'),
          'col-tooltip',
          <Input
            value={state.tooltip}
            onChange={handleTooltipChange}
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
            onChange={handleColTypeChange}
            options={colTypeOptions}
          />,
        )}
        <Divider />
        {state.colType === 'spark' &&
          formRow(
            t('Chart type'),
            t('Type of chart to display in sparkline'),
            'spark-type',
            <Select
              ariaLabel={t('Chart Type')}
              value={state.sparkType || undefined}
              onChange={handleSparkTypeChange}
              options={sparkTypeOptions}
            />,
          )}
        {state.colType === 'spark' &&
          formRow(
            t('Width'),
            t('Width of the sparkline'),
            'spark-width',
            <Input
              value={state.width}
              onChange={handleWidthChange}
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
              onChange={handleHeightChange}
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
              onChange={handleTimeLagChange}
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
              onChange={handleTimeRatioChange}
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
              onChange={handleComparisonTypeChange}
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
              onChange={handleShowYAxisChange}
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
            onChange={handleD3formatChange}
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
              onChange={handleDateFormatChange}
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
  }, [
    state,
    formRow,
    onTextInputChange,
    onSelectChange,
    onCheckboxChange,
    onBoundsChange,
    onYAxisBoundsChange,
    onClose,
    onSave,
  ]);

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
        <span
          css={theme => ({
            display: 'inline-block',
            cursor: 'pointer',
            '& svg path': {
              fill: theme.colorIcon,
              transition: `fill ${theme.motionDurationMid} ease-out`,
            },
            '&:hover svg path': {
              fill: theme.colorPrimary,
            },
          })}
        >
          <Icons.EditOutlined iconSize="s" />
        </span>
      </ControlPopover>
    </span>
  );
}

export default TimeSeriesColumnControl;
