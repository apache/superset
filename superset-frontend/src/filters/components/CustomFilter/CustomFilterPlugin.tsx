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
/* eslint-disable no-param-reassign */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  ensureIsArray,
  getColumnLabel,
  JsonObject,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { GenericDataType } from '@apache-superset/core/common';
import { Select } from '@superset-ui/core/components';
import { Checkbox, Radio } from 'antd';
import { FilterPluginStyle } from '../common';
import { PluginFilterCustomFilterQueryFormData, DEFAULT_FORM_DATA } from './types';

interface CustomFilterPluginProps {
  data: { [key: string]: any }[];
  formData: PluginFilterCustomFilterQueryFormData;
  coltypeMap: Record<string, GenericDataType>;
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

const StyledCheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: ${({ height }: { height: number }) => height - 40}px;
  overflow-y: auto;
  padding: 8px;
`;

const StyledRadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: ${({ height }: { height: number }) => height - 40}px;
  overflow-y: auto;
  padding: 8px;
`;

export default function CustomFilterPlugin(
  props: CustomFilterPluginProps,
) {
  const {
    data,
    formData,
    _coltypeMap,
    width,
    height,
    filterState,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    _setFilterActive,
    inputRef,
    isRefreshing,
  } = props;

  const {
    groupby,
    controlType = 'dropdown',
    multiSelect = true,
    _enableEmptyFilter = false,
    inverseSelection = false,
    defaultToFirstItem = false,
    sortAscending = true,
  } = { ...DEFAULT_FORM_DATA, ...formData };

  const column = useMemo(() => getColumnLabel(groupby?.[0]), [groupby]);
  const values = useMemo(
    () =>
      data
        .map(d => d[column])
        .filter(v => v !== null && v !== undefined)
        .sort((a, b) => {
          if (sortAscending) {
            return String(a).localeCompare(String(b));
          }
          return String(b).localeCompare(String(a));
        }),
    [data, column, sortAscending],
  );

  const [filterValue, setFilterValue] = useState<any[]>(
    filterState.value || (defaultToFirstItem && values.length > 0 ? [values[0]] : []),
  );

  const handleChange = useCallback(
    (selectedValues: any[]) => {
      const value = ensureIsArray(selectedValues);
      setFilterValue(value);

      const dataMask = {
        extraFormData: {
          filters:
            value.length > 0
              ? [
                  {
                    col: column,
                    op: inverseSelection ? 'NOT IN' : 'IN',
                    val: value,
                  },
                ]
              : [],
        },
        filterState: {
          value,
        },
      };
      setDataMask(dataMask);
    },
    [column, inverseSelection, setDataMask],
  );

  useEffect(() => {
    if (filterState.value !== undefined) {
      setFilterValue(filterState.value);
    }
  }, [filterState.value]);

  useEffect(() => {
    if (defaultToFirstItem && values.length > 0 && filterValue.length === 0) {
      handleChange([values[0]]);
    }
  }, [defaultToFirstItem, values, filterValue.length, handleChange]);

  const handleHover = useCallback(
    (isHovered: boolean) => {
      if (isHovered) {
        setHoveredFilter(column);
      } else {
        unsetHoveredFilter();
      }
    },
    [column, setHoveredFilter, unsetHoveredFilter],
  );

  const handleFocus = useCallback(
    (isFocused: boolean) => {
      if (isFocused) {
        setFocusedFilter(column);
      } else {
        unsetFocusedFilter();
      }
    },
    [column, setFocusedFilter, unsetFocusedFilter],
  );

  const options = values.map(value => ({
    label: String(value),
    value,
  }));

  if (controlType === 'checkbox') {
    return (
      <FilterPluginStyle width={width} height={height}>
        <StyledCheckboxGroup
          height={height}
          onMouseEnter={() => handleHover(true)}
          onMouseLeave={() => handleHover(false)}
        >
          <Checkbox.Group
            value={filterValue}
            onChange={handleChange as any}
            disabled={isRefreshing}
          >
            {values.map(value => (
              <div key={value}>
                <Checkbox value={value}>{String(value)}</Checkbox>
              </div>
            ))}
          </Checkbox.Group>
        </StyledCheckboxGroup>
      </FilterPluginStyle>
    );
  }

  if (controlType === 'radio') {
    return (
      <FilterPluginStyle width={width} height={height}>
        <StyledRadioGroup
          height={height}
          onMouseEnter={() => handleHover(true)}
          onMouseLeave={() => handleHover(false)}
        >
          <Radio.Group
            value={filterValue[0]}
            onChange={e => handleChange([e.target.value])}
            disabled={isRefreshing}
          >
            {values.map(value => (
              <div key={value}>
                <Radio value={value}>{String(value)}</Radio>
              </div>
            ))}
          </Radio.Group>
        </StyledRadioGroup>
      </FilterPluginStyle>
    );
  }

  return (
    <FilterPluginStyle width={width} height={height}>
      <Select
        mode={multiSelect ? 'multiple' : undefined}
        value={filterValue}
        onChange={handleChange}
        disabled={isRefreshing}
        showSearch
        placeholder={t('Select values')}
        onMouseEnter={() => handleHover(true)}
        onMouseLeave={() => handleHover(false)}
        onFocus={() => handleFocus(true)}
        onBlur={() => handleFocus(false)}
        ref={inputRef}
        style={{ width: '100%' }}
        dropdownMatchSelectWidth={false}
        options={options}
      />
    </FilterPluginStyle>
  );
}
