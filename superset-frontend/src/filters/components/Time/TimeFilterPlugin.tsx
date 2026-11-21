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
  DataMask,
  NO_TIME_RANGE,
  getExtensionsRegistry,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { FormItem } from '@superset-ui/core/components';
import { FocusEvent, useCallback, useEffect, useRef } from 'react';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import {
  checkTimeRange,
  hasLimits,
  type LimitCheck,
} from 'src/utils/timeRangeLimits';
import { limitCheckMessage } from 'src/dashboard/components/nativeFilters/FilterBar/utils';
import { PluginFilterTimeProps } from './types';
import { FilterPluginStyle, StatusMessage } from '../common';

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

  const limits = props.formData?.timeRangeLimits;
  const limitsOn = !!limits && hasLimits(limits.levels);
  const levelsKey = JSON.stringify(limitsOn ? limits.levels : null);
  const limitsRef = useRef({ limitsOn, levelsKey, limits });
  limitsRef.current = { limitsOn, levelsKey, limits };
  const lastCheck = useRef<{ levelsKey: string; check: LimitCheck }>();
  const checkRequest = useRef(0);

  // With limits on, the value is checked first and set together with its
  // error in one data mask, so the error never reaches Redux on its own.
  const handleTimeRangeChange = useCallback(
    (timeRange?: string): void => {
      const isSet = timeRange && timeRange !== NO_TIME_RANGE;
      const dataMask: DataMask = {
        extraFormData: isSet
          ? {
              time_range: timeRange,
            }
          : {},
        filterState: {
          value: isSet ? timeRange : undefined,
        },
      };
      checkRequest.current += 1;
      const { current } = limitsRef;
      if (!current.limitsOn || !current.limits) {
        setDataMask(dataMask);
        return;
      }
      const request = checkRequest.current;
      const value = isSet ? timeRange : NO_TIME_RANGE;
      const cached = lastCheck.current;
      const check =
        cached?.levelsKey === current.levelsKey &&
        cached.check.timeRange === value
          ? Promise.resolve(cached.check)
          : checkTimeRange(value, current.limits.levels);
      check.then(result => {
        if (request !== checkRequest.current) {
          return;
        }
        if (result.status === 'checked') {
          lastCheck.current = { levelsKey: current.levelsKey, check: result };
        }
        const validateMessage = limitCheckMessage(result);
        setDataMask(
          validateMessage
            ? {
                ...dataMask,
                filterState: {
                  ...dataMask.filterState,
                  validateStatus: 'error',
                  limitInvalid: true,
                  validateMessage,
                },
              }
            : dataMask,
        );
      });
    },
    [setDataMask],
  );

  useEffect(() => {
    handleTimeRangeChange(filterState.value);
  }, [filterState.value, levelsKey, filterState.limitInvalid]);

  const nativeFilterId = props.formData?.nativeFilterId;
  const messageId = `${nativeFilterId || 'time_range'}-limit-error`;
  // In filter settings the Default Value field shows the error and sets
  // describedBy, so the plugin shows no message of its own there.
  const showMessage =
    !!filterState.validateMessage &&
    appSection !== AppSection.FilterConfigModal;
  const pickerLimits = limits && {
    ...limits,
    ...(showMessage && { describedBy: messageId }),
    ...(nativeFilterId && { labelledBy: `filter-name-${nativeFilterId}` }),
  };
  // The filter bar focuses this container to show a filter; with limits on,
  // focus goes on to the time range trigger unless its picker is open.
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    setFocusedFilter();
    if (event.target !== event.currentTarget) {
      return;
    }
    const trigger = event.currentTarget.querySelector<HTMLElement>(
      '[data-test="time-range-trigger"] button',
    );
    if (trigger && trigger.getAttribute('aria-expanded') !== 'true') {
      trigger.focus();
    }
  };
  const control = (
    <ControlContainer
      ref={inputRef}
      validateStatus={filterState.validateStatus}
      onFocus={limitsOn ? onFocus : setFocusedFilter}
      onBlur={unsetFocusedFilter}
      onMouseEnter={setHoveredFilter}
      onMouseLeave={unsetHoveredFilter}
      tabIndex={-1}
    >
      <DateFilterComponent
        value={filterState.value || NO_TIME_RANGE}
        name={props.formData?.nativeFilterId || 'time_range'}
        onChange={handleTimeRangeChange}
        onOpenPopover={() => setFilterActive(true)}
        onClosePopover={() => {
          setFilterActive(false);
          unsetHoveredFilter();
          unsetFocusedFilter();
        }}
        isOverflowingFilterBar={isOverflowingFilterBar}
        displayFormat={props.formData?.displayFormat}
        timeRangeLimits={pickerLimits}
      />
    </ControlContainer>
  );

  if (!props.formData?.inView) {
    return null;
  }
  // With limits on, the filter lays out as SelectFilterPlugin: a FormItem
  // with the error under the control.
  return limitsOn ? (
    <FilterPluginStyle width={width} height={height}>
      <FormItem
        validateStatus={filterState.validateStatus}
        extra={
          showMessage ? (
            <StatusMessage id={messageId} status={filterState.validateStatus}>
              {filterState.validateMessage}
            </StatusMessage>
          ) : undefined
        }
      >
        {control}
      </FormItem>
    </FilterPluginStyle>
  ) : (
    <TimeFilterStyles width={width} height={height}>
      {control}
    </TimeFilterStyles>
  );
}
