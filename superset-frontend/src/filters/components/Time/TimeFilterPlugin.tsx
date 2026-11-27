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
import {
  AppSection,
  NO_TIME_RANGE,
  getExtensionsRegistry,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { useCallback, useEffect } from 'react';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import { CalendarRangePicker } from 'src/explore/components/controls/DateFilterControl/components';
import { formatCalendarRangeLabel } from 'src/explore/components/controls/DateFilterControl/utils/calendarRange';
import { PluginFilterTimeProps } from './types';
import { FilterPluginStyle } from '../common';

const TimeFilterStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow-x: visible;

  & .ant-tag {
    margin-right: 0;
  }
`;

const ControlContainer = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
}>`
  display: flex;
  height: 100%;
  max-width: 100%;
  width: 100%;
  & > div,
  & > div:hover {
    ${({ validateStatus, theme }) => {
      if (!validateStatus) return '';
      switch (validateStatus) {
        case 'error':
          return `border-color: ${theme.colorError}`;
        case 'warning':
          return `border-color: ${theme.colorWarning}`;
        case 'info':
          return `border-color: ${theme.colorInfo}`;
        default:
          return `border-color: ${theme.colorError}`;
      }
    }}
  }
  & > div {
    width: 100%;
  }

  &:focus > div {
    border-color: ${({ theme }) => theme.colorPrimary};
    box-shadow: ${({ theme }) => `0 0 0 2px ${theme.controlOutline}`};
    outline: 0;
  }
`;

export default function TimeFilterPlugin(props: PluginFilterTimeProps) {
  const {
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    width,
    height,
    filterState,
    inputRef,
    isOverflowingFilterBar = false,
    appSection,
  } = props;
  const extensionsRegistry = getExtensionsRegistry();

  const DateFilterControlExtension = extensionsRegistry.get(
    'filter.dateFilterControl',
  );
  const DateFilterComponent = DateFilterControlExtension ?? DateFilterControl;
  // The default value is always set with the full control, so any time range
  // (e.g. "Last week") can be chosen; only the dashboard filter bar uses the calendar.
  // A registered `filter.dateFilterControl` override wins: it replaces the date
  // control, so the built-in calendar must not bypass it.
  const useCalendarPicker =
    !!props.formData.calendarPicker &&
    appSection !== AppSection.FilterConfigModal &&
    !DateFilterControlExtension;

  const handleTimeRangeChange = useCallback(
    (timeRange?: string): void => {
      const isSet = timeRange && timeRange !== NO_TIME_RANGE;
      // The saved value ends one day after the last picked day (the end is exclusive), so
      // places that print the value (the "Applied filters" tooltip) get the days the user
      // picked instead: "2026-11-01 – 2026-11-30".
      const label =
        isSet && useCalendarPicker
          ? formatCalendarRangeLabel(timeRange)
          : undefined;
      setDataMask({
        extraFormData: isSet
          ? {
              time_range: timeRange,
            }
          : {},
        filterState: {
          value: isSet ? timeRange : undefined,
          ...(label ? { label } : {}),
        },
      });
    },
    [setDataMask, useCalendarPicker],
  );

  useEffect(() => {
    handleTimeRangeChange(filterState.value);
  }, [filterState.value]);

  return props.formData?.inView ? (
    <TimeFilterStyles width={width} height={height}>
      <ControlContainer
        ref={inputRef}
        validateStatus={filterState.validateStatus}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
        tabIndex={-1}
      >
        {useCalendarPicker ? (
          <CalendarRangePicker
            value={filterState.value || NO_TIME_RANGE}
            onChange={handleTimeRangeChange}
            onOpenChange={open => {
              setFilterActive(open);
              if (!open) {
                unsetHoveredFilter();
                unsetFocusedFilter();
              }
            }}
            status={
              filterState.validateStatus === 'error' ? 'error' : undefined
            }
          />
        ) : (
          <DateFilterComponent
            value={filterState.value || NO_TIME_RANGE}
            name={props.formData.nativeFilterId || 'time_range'}
            onChange={handleTimeRangeChange}
            onOpenPopover={() => setFilterActive(true)}
            onClosePopover={() => {
              setFilterActive(false);
              unsetHoveredFilter();
              unsetFocusedFilter();
            }}
            isOverflowingFilterBar={isOverflowingFilterBar}
            displayFormat={props.formData.displayFormat}
            calendarFrame={!!props.formData.calendarPicker}
          />
        )}
      </ControlContainer>
    </TimeFilterStyles>
  ) : null;
}
