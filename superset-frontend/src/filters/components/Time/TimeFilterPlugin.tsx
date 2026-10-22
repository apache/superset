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
import { FilterPlugins } from 'src/constants';
import SimpleDateRange from 'src/components/SimpleDateRange';
import SimpleDateTimeRange from 'src/components/SimpleDateTimeRange';
import {
  quickRangeStorageKey,
  rememberQuickRange,
} from 'src/components/BasicCalendar/quickRangeStorage';
import getBootstrapData from 'src/utils/getBootstrapData';
import { isUser } from 'src/types/bootstrapTypes';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
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
  } = props;
  const extensionsRegistry = getExtensionsRegistry();

  const DateFilterControlExtension = extensionsRegistry.get(
    'filter.dateFilterControl',
  );
  const filterType = props.formData.vizType ?? props.formData.viz_type;
  const mode =
    filterType === FilterPlugins.SimpleDateTimeRange
      ? 'datetime'
      : filterType === FilterPlugins.SimpleDateRange
        ? 'date'
        : undefined;
  const DateFilterComponent =
    mode === 'datetime'
      ? SimpleDateTimeRange
      : mode === 'date'
        ? SimpleDateRange
        : (DateFilterControlExtension ?? DateFilterControl);
  const { user } = getBootstrapData();
  const storageKey =
    mode && props.appSection !== AppSection.FilterConfigModal
      ? quickRangeStorageKey(
          isUser(user) ? user.userId : undefined,
          props.formData.dashboardId,
          props.formData.nativeFilterId,
          mode,
        )
      : undefined;

  const updateTimeRange = useCallback(
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

  const handleTimeRangeChange = (timeRange?: string) => {
    updateTimeRange(timeRange);
    if (mode) rememberQuickRange(storageKey, timeRange, mode);
  };

  useEffect(() => {
    updateTimeRange(filterState.value);
  }, [filterState.value, updateTimeRange]);

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
        />
      </ControlContainer>
    </TimeFilterStyles>
  ) : null;
}
