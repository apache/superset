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
import { useCallback, useEffect, RefObject } from 'react';
import {
  styled,
  NO_TIME_RANGE,
  FilterState,
  QueryFormData,
} from '@superset-ui/core';
import { FilterPluginStyle } from '../common';
import { PersianCalendarFrame } from 'src/explore/components/controls/DateFilterControl/components/PersianCalendarFrame';
import { PluginFilterHooks, PluginFilterStylesProps } from '../types';

interface PersianCalendarFilterPluginProps
  extends PluginFilterStylesProps,
    PluginFilterHooks {
  formData: QueryFormData;
  filterState: FilterState;
  inputRef?: RefObject<HTMLInputElement>;
  isOverflowingFilterBar?: boolean;
}

const PersianCalendarFilterStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow-x: visible;
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

export default function PersianCalendarFilterPlugin(
  props: PersianCalendarFilterPluginProps,
) {
  const {
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    width,
    height,
    filterState,
    inputRef,
  } = props;

  const handleTimeRangeChange = useCallback(
    (timeRange?: string): void => {
      const isSet = timeRange && timeRange !== NO_TIME_RANGE;
      setDataMask({
        extraFormData: isSet
          ? {
              time_range: timeRange,
            }
          : {},
        filterState: {
          value: isSet ? timeRange : undefined,
        },
      });
    },
    [setDataMask],
  );

  useEffect(() => {
    // Only call handleTimeRangeChange if filterState.value exists and is different from NO_TIME_RANGE
    if (filterState.value && filterState.value !== NO_TIME_RANGE) {
      handleTimeRangeChange(filterState.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState.value]);

  return props.formData?.inView ? (
    <PersianCalendarFilterStyles width={width} height={height}>
      <ControlContainer
        ref={inputRef}
        validateStatus={filterState.validateStatus}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
        tabIndex={-1}
      >
        <PersianCalendarFrame
          value={filterState.value || NO_TIME_RANGE}
          onChange={handleTimeRangeChange}
        />
      </ControlContainer>
    </PersianCalendarFilterStyles>
  ) : null;
}
