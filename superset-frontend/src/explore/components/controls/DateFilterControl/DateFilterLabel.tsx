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
import React, { useState, useMemo, useEffect } from 'react';
import rison from 'rison';
import {
  styled,
  t,
  TimeRangeEndpoints,
  useTheme,
  Datasource,
  SupersetClient,
  css,
  SupersetTheme,
} from '@superset-ui/core';
import { DEFAULT_DATE_FILTER, TimeFilter } from '@superset-ui/chart-controls';
import {
  buildTimeRangeString,
  CALENDAR_RANGE_VALUES_SET,
  COMMON_RANGE_VALUES_SET,
  customTimeRangeDecode,
  formatTimeRange,
} from 'src/explore/components/controls/DateFilterControl/utils';
import { useDebouncedEffect } from 'src/explore/exploreUtils';
import Popover from 'src/components/Popover';
import Icons from 'src/components/Icons';
import { testWithId } from 'src/utils/testUtils';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { SLOW_DEBOUNCE } from 'src/constants';
import { FrameType } from './types';
import { DateFilterPopoverContent } from './components/DateFilterPopoverContent';
import { DndItemType } from '../../DndItemType';
import OptionWrapper from '../DndColumnSelectControl/OptionWrapper';

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

interface DateFilterLabelI {
  children?: React.ReactNode;
  onChange: (timeFilter: TimeFilter) => void;
  endpoints?: TimeRangeEndpoints;
  dateFilter: TimeFilter;
  datasource: Datasource;
  timeColumnOptions: { value: string; label: string }[];
  timeGrainOptions: { value: string; label: string }[];
  onRemoveFilter: (index: number) => void;
  onShiftFilters: (dragIndex: number, hoverIndex: number) => void;
  index: number;
  popoverVisible: boolean;
  setPopoverVisible: (val: boolean) => void;
}

export const DATE_FILTER_CONTROL_TEST_ID = 'date-filter-control';
export const getDateFilterControlTestId = testWithId(
  DATE_FILTER_CONTROL_TEST_ID,
);

const overlayStyle = {
  width: '600px',
};

const generateTooltip = (
  timeColumn: string,
  timeGrain: string,
  range1: string,
  range2?: string,
) => (
  <div>
    <div
      css={(theme: SupersetTheme) => css`
        font-weight: ${theme.typography.weights.bold};
      `}
    >
      {timeColumn}
    </div>
    {timeGrain && <div>{timeGrain}</div>}
    <div>
      <span>{range1}</span>
      {range2 && <span>{` (${range2})`}</span>}
    </div>
  </div>
);

export default function DateFilterLabel(props: DateFilterLabelI) {
  const {
    children,
    datasource,
    endpoints,
    onChange,
    timeColumnOptions,
    timeGrainOptions,
    dateFilter = DEFAULT_DATE_FILTER,
    onRemoveFilter,
    onShiftFilters,
    index = 1,
    popoverVisible,
    setPopoverVisible,
  } = props;
  const [actualTimeRange, setActualTimeRange] = useState<string>(
    dateFilter.timeRange,
  );

  const guessedFrame = useMemo(
    () => guessFrame(dateFilter.timeRange),
    [dateFilter.timeRange],
  );
  const [frame, setFrame] = useState<FrameType>(guessedFrame);
  const [lastFetchedTimeRange, setLastFetchedTimeRange] = useState(
    dateFilter.timeRange,
  );
  const [timeRangeValue, setTimeRangeValue] = useState(dateFilter.timeRange);
  const [validTimeRange, setValidTimeRange] = useState<boolean>(false);
  const [evalResponse, setEvalResponse] = useState<string | undefined>(
    dateFilter.timeRange,
  );
  const [tooltipTitle, setTooltipTitle] = useState<
    string | React.ReactNode | undefined
  >(dateFilter.timeRange);

  const theme = useTheme();

  useEffect(() => {
    fetchTimeRange(dateFilter.timeRange, endpoints).then(
      ({ value: actualRange, error }) => {
        if (error) {
          setEvalResponse(error || '');
          setValidTimeRange(false);
          setTooltipTitle(dateFilter.timeRange || '');
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
            guessedFrame === 'Common' ||
            guessedFrame === 'Calendar' ||
            guessedFrame === 'No filter'
          ) {
            setActualTimeRange(dateFilter.timeRange);
            setTooltipTitle(
              generateTooltip(
                dateFilter.timeColumn || '',
                dateFilter.timeGrain || '',
                dateFilter.timeRange,
                actualRange || '',
              ),
            );
          } else {
            setActualTimeRange(actualRange || '');
            setTooltipTitle(
              generateTooltip(
                dateFilter.timeColumn || '',
                dateFilter.timeGrain || '',
                actualRange || '',
              ),
            );
          }
          setValidTimeRange(true);
        }
        setLastFetchedTimeRange(dateFilter.timeRange);
      },
    );
  }, [dateFilter.timeRange]);

  useDebouncedEffect(
    () => {
      if (lastFetchedTimeRange !== timeRangeValue) {
        fetchTimeRange(timeRangeValue, endpoints).then(
          ({ value: actualRange, error }) => {
            if (error) {
              setEvalResponse(error || '');
              setValidTimeRange(false);
            } else {
              setEvalResponse(actualRange || '');
              setValidTimeRange(true);
            }
            setLastFetchedTimeRange(timeRangeValue);
          },
        );
      }
    },
    SLOW_DEBOUNCE,
    [timeRangeValue],
  );

  function onOpen() {
    setTimeRangeValue(dateFilter.timeRange);
    setFrame(guessedFrame);
    setPopoverVisible(true);
  }

  function onHide() {
    setTimeRangeValue(dateFilter.timeRange);
    setFrame(guessedFrame);
    setPopoverVisible(false);
  }

  const togglePopover = () => {
    if (popoverVisible) {
      onHide();
    } else {
      onOpen();
    }
  };

  const title = (
    <IconWrapper>
      <Icons.EditAlt iconColor={theme.colors.grayscale.base} />
      <span className="text">{t('Edit time range')}</span>
    </IconWrapper>
  );

  const overlayContent = (
    <DateFilterPopoverContent
      timeColumnOptions={timeColumnOptions}
      timeGrainOptions={timeGrainOptions}
      onChange={onChange}
      dateFilter={dateFilter}
      frame={frame}
      setFrame={setFrame}
      guessedFrame={guessedFrame}
      setShow={setPopoverVisible}
      timeRangeValue={timeRangeValue}
      setTimeRangeValue={setTimeRangeValue}
      evalResponse={evalResponse}
      validTimeRange={validTimeRange}
    />
  );

  let label = '';
  if (dateFilter.isXAxis) {
    label += '(X-Axis) ';
  }
  const timeColumnVerboseName = useMemo(
    () =>
      datasource?.columns?.find(
        column => column.column_name === dateFilter.timeColumn,
      )?.verbose_name,
    [datasource?.columns, dateFilter.timeColumn],
  );
  label += timeColumnVerboseName ?? dateFilter.timeColumn;
  label += ` (${actualTimeRange})`;
  return (
    <>
      <Popover
        placement="right"
        trigger="click"
        content={overlayContent}
        title={title}
        defaultVisible={popoverVisible}
        visible={popoverVisible}
        onVisibleChange={togglePopover}
        overlayStyle={overlayStyle}
        destroyTooltipOnHide
      >
        {children || (
          <OptionWrapper
            index={index}
            label={label}
            tooltipTitle={tooltipTitle}
            clickClose={onRemoveFilter}
            onShiftOptions={onShiftFilters}
            type={DndItemType.Column}
            withCaret
          />
        )}
      </Popover>
    </>
  );
}
