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
  ensureIsArray,
  ExtraFormData,
  t,
  TimeGranularity,
  tn,
} from '@superset-ui/core';
import { useEffect, useMemo, useState } from 'react';
import { Select } from 'src/components';
import { FormItemProps } from 'antd/lib/form';
import { FilterPluginStyle, StyledFormItem, StatusMessage } from '../common';
import { PluginFilterTimeGrainProps } from './types';

export default function PluginFilterTimegrain(
  props: PluginFilterTimeGrainProps,
) {
  const {
    data,
    formData,
    height,
    width,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    filterState,
    inputRef,
  } = props;
  const { defaultValue } = formData;

  const [value, setValue] = useState<string[]>(defaultValue ?? []);
  const durationMap = useMemo(
    () =>
      data.reduce(
        (agg, { duration, name }: { duration: string; name: string }) => ({
          ...agg,
          [duration]: name,
        }),
        {} as { [key in string]: string },
      ),
    [JSON.stringify(data)],
  );

  const handleChange = (values: string[] | string | undefined | null) => {
    const resultValue: string[] = ensureIsArray<string>(values);
    const [timeGrain] = resultValue;
    const label = timeGrain ? durationMap[timeGrain] : undefined;

    const extraFormData: ExtraFormData = {};
    if (timeGrain) {
      extraFormData.time_grain_sqla = timeGrain as TimeGranularity;
    }
    setValue(resultValue);
    setDataMask({
      extraFormData,
      filterState: {
        label,
        value: resultValue.length ? resultValue : null,
      },
    });
  };

  useEffect(() => {
    handleChange(defaultValue ?? []);
    // I think after Config Modal update some filter it re-creates default value for all other filters
    // so we can process it like this `JSON.stringify` or start to use `Immer`
  }, [JSON.stringify(defaultValue)]);

  useEffect(() => {
    handleChange(filterState.value ?? []);
  }, [JSON.stringify(filterState.value)]);

  const placeholderText =
    (data || []).length === 0
      ? t('No data')
      : tn('%s option', '%s options', data.length, data.length);

  const formItemData: FormItemProps = {};
  if (filterState.validateMessage) {
    formItemData.extra = (
      <StatusMessage status={filterState.validateStatus}>
        {filterState.validateMessage}
      </StatusMessage>
    );
  }

  const options = (data || []).map(
    (row: { name: string; duration: string }) => {
      const { name, duration } = row;
      return {
        label: name,
        value: duration,
      };
    },
  );

  return (
    <FilterPluginStyle height={height} width={width}>
      <StyledFormItem
        validateStatus={filterState.validateStatus}
        {...formItemData}
      >
        <Select
          name={formData.nativeFilterId}
          allowClear
          value={value}
          placeholder={placeholderText}
          // @ts-ignore
          onChange={handleChange}
          onBlur={unsetFocusedFilter}
          onFocus={setFocusedFilter}
          onMouseEnter={setHoveredFilter}
          onMouseLeave={unsetHoveredFilter}
          ref={inputRef}
          options={options}
          onDropdownVisibleChange={setFilterActive}
        />
      </StyledFormItem>
    </FilterPluginStyle>
  );
}
