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
import { styled } from '@superset-ui/core';
import React, { useCallback, useEffect } from 'react';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import { NO_TIME_RANGE } from 'src/explore/constants';
import { PluginFilterTimeProps } from './types';
import { ControlContainer, FilterPluginStyle } from '../common';

const TimeFilterStyles = styled(FilterPluginStyle)`
  overflow-x: auto;
`;

export default function TimeFilterPlugin(props: PluginFilterTimeProps) {
  const {
    setDataMask,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
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
    handleTimeRangeChange(filterState.value);
  }, [filterState.value]);

  return props.formData?.inView ? (
    // @ts-ignore
    <TimeFilterStyles width={width} height={height}>
      <ControlContainer
        tabIndex={-1}
        ref={inputRef}
        validateStatus={filterState.validateStatus}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setFocusedFilter}
        onMouseLeave={unsetFocusedFilter}
      >
        <DateFilterControl
          value={filterState.value || NO_TIME_RANGE}
          name="time_range"
          onChange={handleTimeRangeChange}
          type={filterState.validateStatus}
          onOpenPopover={() => setFilterActive(true)}
          onClosePopover={() => setFilterActive(false)}
        />
      </ControlContainer>
    </TimeFilterStyles>
  ) : null;
}
