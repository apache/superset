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
import React, { useState } from 'react';
import { styled, t, useTheme } from '@superset-ui/core';
import {
  InfoTooltipWithTrigger,
  TimeFilter,
} from '@superset-ui/chart-controls';
import { Divider } from 'src/common/components';
import Select, { propertyComparator } from 'src/components/Select/Select';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import { CommonFrame } from './CommonFrame';
import { CalendarFrame } from './CalendarFrame';
import { AdvancedFrame } from './AdvancedFrame';
import { CustomFrame } from './CustomFrame';
import { getDateFilterControlTestId } from '../DateFilterLabel';
import { XAxisCheckbox } from './XAxisCheckbox';
import { FRAME_OPTIONS } from '../utils';
import { FrameType } from '../types';

const ContentStyleWrapper = styled.div`
  .ant-row {
    margin-top: 8px;
  }

  .ant-input-number {
    width: 100%;
  }

  .ant-picker {
    padding: 4px 17px 4px;
    border-radius: 4px;
    width: 100%;
  }

  .ant-divider-horizontal {
    margin: 16px 0;
  }

  .control-label {
    font-size: 11px;
    font-weight: 500;
    color: #b2b2b2;
    line-height: 16px;
    text-transform: uppercase;
    margin: 8px 0;
  }

  .vertical-radio {
    display: block;
    height: 40px;
    line-height: 40px;
  }

  .section-title {
    font-style: normal;
    font-weight: 500;
    font-size: 15px;
    line-height: 24px;
    margin-bottom: 8px;
  }

  .control-anchor-to {
    margin-top: 16px;
  }

  .control-anchor-to-datetime {
    width: 217px;
  }

  .footer {
    text-align: right;
  }
`;

const TimeColumnSectionControlWrapper = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  line-height: 1;
`;

const IconWrapper = styled.span`
  span {
    margin-right: ${({ theme }) => 2 * theme.gridUnit}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
  .error {
    color: ${({ theme }) => theme.colors.error.base};
  }
`;

const StyledSelect = styled(Select)`
  width: 272px;
`;

interface DateFilterPopoverContentI {
  dateFilter: TimeFilter;
  evalResponse: string | undefined;
  frame: FrameType;
  guessedFrame: FrameType;
  onChange: (val: TimeFilter) => void;
  setFrame: (frame: FrameType) => void;
  setShow?: (val: boolean) => void;
  setTimeRangeValue: (value: string) => void;
  timeColumnOptions: { value: string; label: string }[];
  timeGrainOptions: { value: string; label: string }[];
  timeRangeValue: string;
  validTimeRange: boolean;
  showTimeColumnSection: boolean;
  isTimeseries: boolean;
}

export const DateFilterPopoverContent = ({
  dateFilter,
  evalResponse,
  frame,
  guessedFrame,
  onChange,
  setFrame,
  setShow,
  setTimeRangeValue,
  timeColumnOptions,
  timeGrainOptions,
  timeRangeValue,
  validTimeRange,
  showTimeColumnSection,
  isTimeseries,
}: DateFilterPopoverContentI) => {
  const [timeGrain, setTimeGrain] = useState(dateFilter.timeGrain);
  const [timeColumn, setTimeColumn] = useState(dateFilter.timeColumn);
  const [isXAxis, setIsXAxis] = useState(dateFilter.isXAxis);

  const theme = useTheme();

  const onChangeFrame = (value: string) => {
    if (value === 'No filter') {
      setTimeRangeValue('No filter');
    }
    setFrame(value as FrameType);
  };

  function onHide() {
    setTimeRangeValue(dateFilter.timeRange);
    setFrame(guessedFrame);
    setShow?.(false);
  }

  function onSave() {
    onChange({ timeRange: timeRangeValue, timeColumn, timeGrain, isXAxis });
    onHide();
  }

  return (
    <ContentStyleWrapper>
      {showTimeColumnSection && (
        <>
          <TimeColumnSectionControlWrapper>
            <div className="control-label">
              {t('Time column')}{' '}
              <InfoTooltipWithTrigger
                tooltip={t(
                  'The time column for the visualization. Note that you ' +
                    'can define arbitrary expression that return a DATETIME ' +
                    'column in the table. Also note that the ' +
                    'filter below is applied against this column or ' +
                    'expression',
                )}
                placement="right"
              />
            </div>
            <StyledSelect
              ariaLabel={t('Time column')}
              options={timeColumnOptions}
              value={timeColumn}
              onChange={(value: string) => setTimeColumn(value)}
            />
          </TimeColumnSectionControlWrapper>
          {isTimeseries && (
            <TimeColumnSectionControlWrapper>
              <XAxisCheckbox
                setChecked={(value: boolean) => setIsXAxis(value)}
                checked={!!isXAxis}
                disabled={dateFilter.isXAxis}
              />
            </TimeColumnSectionControlWrapper>
          )}
          <TimeColumnSectionControlWrapper>
            <div className="control-label">
              {t('Time grain')}{' '}
              <InfoTooltipWithTrigger
                tooltip={t(
                  'The time granularity for the visualization. This ' +
                    'applies a date transformation to alter ' +
                    'your time column and defines a new time granularity. ' +
                    'The options here are defined on a per database ' +
                    'engine basis in the Superset source code.',
                )}
                placement="right"
              />
            </div>
            <StyledSelect
              ariaLabel={t('Time grain')}
              options={timeGrainOptions}
              value={timeGrain}
              onChange={(value: string) => setTimeGrain(value)}
            />
          </TimeColumnSectionControlWrapper>
          <Divider />
        </>
      )}
      <div className="control-label">{t('RANGE TYPE')}</div>
      <StyledSelect
        ariaLabel={t('RANGE TYPE')}
        options={FRAME_OPTIONS}
        value={frame}
        onChange={onChangeFrame}
        sortComparator={propertyComparator('order')}
      />
      {frame !== 'No filter' && <Divider />}
      {frame === 'Common' && (
        <CommonFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'Calendar' && (
        <CalendarFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'Advanced' && (
        <AdvancedFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'Custom' && (
        <CustomFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {frame === 'No filter' && <div data-test="no-filter" />}
      <Divider />
      <div>
        <div className="section-title">{t('Actual time range')}</div>
        {validTimeRange && <div>{evalResponse}</div>}
        {!validTimeRange && (
          <IconWrapper className="warning">
            <Icons.ErrorSolidSmall iconColor={theme.colors.error.base} />
            <span className="text error">{evalResponse}</span>
          </IconWrapper>
        )}
      </div>
      <div>
        <Divider />
        <div className="footer">
          <Button
            buttonStyle="secondary"
            cta
            key="cancel"
            onClick={onHide}
            data-test="cancel-button"
          >
            {t('CANCEL')}
          </Button>
          <Button
            buttonStyle="primary"
            cta
            disabled={!validTimeRange}
            key="apply"
            onClick={onSave}
            {...getDateFilterControlTestId('apply-button')}
          >
            {t('APPLY')}
          </Button>
        </div>
      </div>
    </ContentStyleWrapper>
  );
};
