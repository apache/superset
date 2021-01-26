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
import React, { useState, useEffect } from 'react';
import rison from 'rison';
import {
  SupersetClient,
  styled,
  supersetTheme,
  t,
  TimeRangeEndpoints,
} from '@superset-ui/core';
import {
  buildTimeRangeString,
  formatTimeRange,
} from 'src/explore/dateFilterUtils';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import Button from 'src/components/Button';
import ControlHeader from 'src/explore/components/ControlHeader';
import Label from 'src/components/Label';
import Popover from 'src/common/components/Popover';
import { Divider } from 'src/common/components';
import Icon from 'src/components/Icon';
import { Select } from 'src/components/Select';
import { Tooltip } from 'src/common/components/Tooltip';
import { SelectOptionType, FrameType } from './types';
import {
  COMMON_RANGE_VALUES_SET,
  CALENDAR_RANGE_VALUES_SET,
  FRAME_OPTIONS,
} from './constants';
import { customTimeRangeDecode } from './utils';
import {
  CommonFrame,
  CalendarFrame,
  CustomFrame,
  AdvancedFrame,
} from './frame';

const guessFrame = (timeRange: string): FrameType => {
  if (COMMON_RANGE_VALUES_SET.has(timeRange)) {
    return 'Common';
  }
  if (CALENDAR_RANGE_VALUES_SET.has(timeRange)) {
    return 'Calendar';
  }
  if (timeRange === 'No filter') {
    return 'No filter';
  }
  if (customTimeRangeDecode(timeRange).matchedFlag) {
    return 'Custom';
  }
  return 'Advanced';
};

const fetchTimeRange = async (
  timeRange: string,
  endpoints?: TimeRangeEndpoints,
) => {
  const query = rison.encode(timeRange);
  const endpoint = `/api/v1/time_range/?q=${query}`;
  try {
    const response = await SupersetClient.get({ endpoint });
    const timeRangeString = buildTimeRangeString(
      response?.json?.result?.since || '',
      response?.json?.result?.until || '',
    );
    return {
      value: formatTimeRange(timeRangeString, endpoints),
    };
  } catch (response) {
    const clientError = await getClientErrorObject(response);
    return {
      error: clientError.message || clientError.error,
    };
  }
};

const StyledPopover = styled(Popover)``;

const ContentStyleWrapper = styled.div`
  .ant-row {
    margin-top: 8px;
  }

  .ant-input-number {
    width: 100%;
  }

  .frame-dropdown {
    width: 272px;
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

const IconWrapper = styled.span`
  svg {
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

interface DateFilterLabelProps {
  name: string;
  onChange: (timeRange: string) => void;
  value?: string;
  endpoints?: TimeRangeEndpoints;
  datasource?: string;
}

export default function DateFilterControl(props: DateFilterLabelProps) {
  const { value = 'Last week', endpoints, onChange, datasource } = props;
  const [actualTimeRange, setActualTimeRange] = useState<string>(value);

  const [show, setShow] = useState<boolean>(false);
  const [frame, setFrame] = useState<FrameType>(guessFrame(value));
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [timeRangeValue, setTimeRangeValue] = useState(value);
  const [validTimeRange, setValidTimeRange] = useState<boolean>(false);
  const [evalResponse, setEvalResponse] = useState<string>(value);
  const [tooltipTitle, setTooltipTitle] = useState<string>(value);

  useEffect(() => {
    if (!isMounted) setIsMounted(true);
    fetchTimeRange(value, endpoints).then(({ value: actualRange, error }) => {
      if (error) {
        setEvalResponse(error || '');
        setValidTimeRange(false);
        setTooltipTitle(value || '');
      } else {
        /*
          HRT == human readable text
          ADR == actual datetime range
          +--------------+------+----------+--------+----------+-----------+
          |              | Last | Previous | Custom | Advanced | No Filter |
          +--------------+------+----------+--------+----------+-----------+
          | control pill | HRT  | HRT      | ADR    | ADR      |   HRT     |
          +--------------+------+----------+--------+----------+-----------+
          | tooltip      | ADR  | ADR      | HRT    | HRT      |   ADR     |
          +--------------+------+----------+--------+----------+-----------+
        */
        if (
          frame === 'Common' ||
          frame === 'Calendar' ||
          frame === 'No filter'
        ) {
          setActualTimeRange(value);
          setTooltipTitle(actualRange || '');
        } else {
          setActualTimeRange(actualRange || '');
          setTooltipTitle(value || '');
        }
        setValidTimeRange(true);
      }
    });
  }, [value]);

  useEffect(() => {
    if (isMounted) {
      onChange('Last week');
      setTimeRangeValue('Last week');
      setFrame(guessFrame('Last week'));
    }
  }, [datasource]);

  useEffect(() => {
    fetchTimeRange(timeRangeValue, endpoints).then(({ value, error }) => {
      if (error) {
        setEvalResponse(error || '');
        setValidTimeRange(false);
      } else {
        setEvalResponse(value || '');
        setValidTimeRange(true);
      }
    });
  }, [timeRangeValue]);

  function onSave() {
    onChange(timeRangeValue);
    setShow(false);
  }

  function onHide() {
    setTimeRangeValue(value);
    setFrame(guessFrame(value));
    setShow(false);
  }

  const togglePopover = () => {
    if (show) {
      onHide();
    } else {
      setShow(true);
    }
  };

  function onFrame(option: SelectOptionType) {
    if (option.value === 'No filter') {
      setTimeRangeValue('No filter');
    }
    setFrame(option.value as FrameType);
  }

  const overlayConetent = (
    <ContentStyleWrapper>
      <div className="control-label">{t('RANGE TYPE')}</div>
      <Select
        options={FRAME_OPTIONS}
        value={FRAME_OPTIONS.filter(({ value }) => value === frame)}
        onChange={onFrame}
        className="frame-dropdown"
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
            <Icon
              name="error-solid-small"
              color={supersetTheme.colors.error.base}
            />
            <span className="text error">{evalResponse}</span>
          </IconWrapper>
        )}
      </div>
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
        >
          {t('APPLY')}
        </Button>
      </div>
    </ContentStyleWrapper>
  );

  const title = (
    <IconWrapper>
      <Icon name="edit-alt" />
      <span className="text">{t('Edit time range')}</span>
    </IconWrapper>
  );

  const overlayStyle = {
    width: '600px',
  };

  return (
    <>
      <ControlHeader {...props} />
      <StyledPopover
        placement="right"
        trigger="click"
        content={overlayConetent}
        title={title}
        defaultVisible={show}
        visible={show}
        onVisibleChange={togglePopover}
        overlayStyle={overlayStyle}
      >
        <Tooltip placement="top" title={tooltipTitle}>
          <Label
            className="pointer"
            data-test="time-range-trigger"
            onClick={() => setShow(true)}
          >
            {actualTimeRange}
          </Label>
        </Tooltip>
      </StyledPopover>
    </>
  );
}
