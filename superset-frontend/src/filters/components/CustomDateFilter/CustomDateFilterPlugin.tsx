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
import { useCallback, useEffect, useState } from 'react';
import { JsonObject } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { DatePicker } from '@superset-ui/core/components';
import { FilterPluginStyle } from '../common';
import { PluginFilterCustomDateFilterQueryFormData, DEFAULT_FORM_DATA } from './types';

interface CustomDateFilterPluginProps {
  data: { [key: string]: any }[];
  formData: PluginFilterCustomDateFilterQueryFormData;
  width: number;
  height: number;
  filterState: { value?: any[] };
  setDataMask: (arg: JsonObject) => void;
  setHoveredFilter: (arg: string) => void;
  unsetHoveredFilter: () => void;
  setFocusedFilter: (arg: string) => void;
  unsetFocusedFilter: () => void;
  setFilterActive: (arg: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  isRefreshing: boolean;
  appSection: string;
}

const StyledDatePicker = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 8px;
`;

export default function CustomDateFilterPlugin(
  props: CustomDateFilterPluginProps,
) {
  const {
    formData,
    width,
    height,
    filterState,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    isRefreshing,
  } = props;

  const {
    controlType = 'date',
    granularitySqla,
  } = { ...DEFAULT_FORM_DATA, ...formData };

  const [dateValue, setDateValue] = useState<any>(
    filterState.value || null,
  );

  const handleChange = useCallback(
    (date: any, _dateString: string | [string, string]) => {
      setDateValue(date);

      let filters: any[] = [];
      if (date) {
        if (controlType === 'daterange' && Array.isArray(date)) {
          filters = [
            {
              col: granularitySqla,
              op: '>=',
              val: date[0].toISOString(),
            },
            {
              col: granularitySqla,
              op: '<=',
              val: date[1].toISOString(),
            },
          ];
        } else if (date instanceof Date) {
          filters = [
            {
              col: granularitySqla,
              op: '=',
              val: date.toISOString(),
            },
          ];
        }
      }

      const dataMask = {
        extraFormData: {
          filters,
        },
        filterState: {
          value: date ? [date] : [],
        },
      };
      setDataMask(dataMask);
    },
    [controlType, granularitySqla, setDataMask],
  );

  useEffect(() => {
    if (filterState.value !== undefined) {
      setDateValue(filterState.value[0] || null);
    }
  }, [filterState.value]);

  const handleHover = useCallback(
    (isHovered: boolean) => {
      if (isHovered) {
        setHoveredFilter(granularitySqla || '');
      } else {
        unsetHoveredFilter();
      }
    },
    [granularitySqla, setHoveredFilter, unsetHoveredFilter],
  );

  const handleFocus = useCallback(
    (isFocused: boolean) => {
      if (isFocused) {
        setFocusedFilter(granularitySqla || '');
      } else {
        unsetFocusedFilter();
      }
    },
    [granularitySqla, setFocusedFilter, unsetFocusedFilter],
  );

  return (
    <FilterPluginStyle width={width} height={height}>
      <StyledDatePicker
        onMouseEnter={() => handleHover(true)}
        onMouseLeave={() => handleHover(false)}
      >
        {controlType === 'daterange' ? (
          <DatePicker.RangePicker
            value={dateValue}
            onChange={handleChange}
            disabled={isRefreshing}
            style={{ width: '100%' }}
            onFocus={() => handleFocus(true)}
            onBlur={() => handleFocus(false)}
          />
        ) : controlType === 'datetime' ? (
          <DatePicker
            showTime
            value={dateValue}
            onChange={handleChange}
            disabled={isRefreshing}
            style={{ width: '100%' }}
            onFocus={() => handleFocus(true)}
            onBlur={() => handleFocus(false)}
          />
        ) : (
          <DatePicker
            value={dateValue}
            onChange={handleChange}
            disabled={isRefreshing}
            style={{ width: '100%' }}
            onFocus={() => handleFocus(true)}
            onBlur={() => handleFocus(false)}
          />
        )}
      </StyledDatePicker>
    </FilterPluginStyle>
  );
}
