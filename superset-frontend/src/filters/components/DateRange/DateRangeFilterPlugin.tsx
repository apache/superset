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
import { useCallback, useMemo } from 'react';
import { styled } from '@apache-superset/core/theme';
import { RangePicker } from '@superset-ui/core/components';
import { PluginFilterDateRangeProps } from './types';
import { DATE_FORMAT, formatTimeRange, parseTimeRange } from './utils';
import { FilterPluginStyle } from '../common';

const ControlContainer = styled.div`
  width: 100%;
`;

export default function DateRangeFilterPlugin(
  props: PluginFilterDateRangeProps,
) {
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
  } = props;

  const value = useMemo(
    () => parseTimeRange(filterState.value),
    [filterState.value],
  );

  const handleChange = useCallback(
    (dates: ReturnType<typeof parseTimeRange>) => {
      const timeRange = formatTimeRange(dates);
      setDataMask({
        extraFormData: timeRange ? { time_range: timeRange } : {},
        filterState: { value: timeRange },
      });
    },
    [setDataMask],
  );

  return props.formData?.inView ? (
    <FilterPluginStyle width={width} height={height}>
      <ControlContainer
        ref={inputRef}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
        tabIndex={-1}
      >
        <RangePicker
          value={value}
          format={DATE_FORMAT}
          allowClear
          style={{ width: '100%' }}
          onChange={handleChange}
          onFocus={() => {
            setFilterActive(true);
            setFocusedFilter();
          }}
          onBlur={() => {
            setFilterActive(false);
            unsetFocusedFilter();
          }}
        />
      </ControlContainer>
    </FilterPluginStyle>
  ) : null;
}
