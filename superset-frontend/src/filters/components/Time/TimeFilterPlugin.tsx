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
import React, { useEffect } from 'react';
import { NO_TIME_RANGE, styled } from '@superset-ui/core';
import { GenericDataType } from '@superset-ui/core';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import { PluginFilterTimeProps } from './types';
import { FilterPluginStyle, StyledFormItem } from '../common';

// Custom StyledFormItem for time filter to override width restrictions
const TimeFilterFormItem = styled(StyledFormItem)`
  &.ant-row.ant-form-item {
    margin: 0;
    
    .ant-form-item-control {
      width: 100% !important; // Override any fixed width restrictions
    }
  }
`;

export default function TimeFilterPlugin(props: PluginFilterTimeProps) {
  const {
    setDataMask,
    unsetHoveredFilter,
    unsetFocusedFilter,
    setFilterActive,
    width,
    height,
    filterState,
    isOverflowingFilterBar = false,
  } = props;

  const handleTimeRangeChange = (timeRange?: string): void => {
    const isSet = timeRange && timeRange !== NO_TIME_RANGE;
    const extraFormData: any = {};
    let columnName: string | undefined;

    // Always try to get column name, even if time range is not set
    // Method 1: Get from granularity_sqla or granularitySqla
    if (props.formData?.granularity_sqla || props.formData?.granularitySqla) {
      columnName = props.formData?.granularity_sqla || props.formData?.granularitySqla;
    }

    // Method 2: Get from first groupby column
    if (!columnName && props.formData?.groupby && props.formData.groupby.length > 0) {
      const firstGroupBy = props.formData.groupby[0];
      if (typeof firstGroupBy === 'string') {
        columnName = firstGroupBy;
      } else if (typeof firstGroupBy === 'object' && 'column_name' in firstGroupBy) {
        columnName = (firstGroupBy as any).column_name;
      }
    }

    // Method 3: Get from data
    if (!columnName && props.data && props.data.length > 0) {
      const timeColumns = props.data.filter(
        (row: any) => row.dtype === GenericDataType.Temporal,
      );
      if (timeColumns.length > 0) {
        const firstTimeColumn = timeColumns[0];
        if (
          firstTimeColumn.column_name &&
          typeof firstTimeColumn.column_name === 'string'
        ) {
          columnName = firstTimeColumn.column_name;
        }
      }
    }

    // Method 4: Use default column name
    if (!columnName) {
      columnName = 'dst'; // Common default time column name
    }

    // Only create filter when time range is set
    if (isSet && columnName) {
      // Use filters format instead of adhoc_filters to avoid being reset
      extraFormData.filters = [
        {
          col: columnName,
          op: 'TEMPORAL_RANGE',
          val: timeRange,
        },
      ];
    }
    setDataMask({
      extraFormData,
      filterState: {
        value: isSet ? timeRange : undefined,
      },
    });
  };

  const filterStateValueString = JSON.stringify(filterState.value);
  useEffect(() => {
    handleTimeRangeChange(filterState.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStateValueString]);

  return props.formData?.inView ? (
    <FilterPluginStyle height={height} width={width}>
      <TimeFilterFormItem
        validateStatus={filterState.validateStatus}
      >
        <DateFilterControl
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
        />
      </TimeFilterFormItem>
    </FilterPluginStyle>
  ) : null;
}
