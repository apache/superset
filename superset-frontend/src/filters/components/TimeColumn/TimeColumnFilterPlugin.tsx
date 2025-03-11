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
  GenericDataType,
  t,
  tn,
} from '@superset-ui/core';
import { useEffect, useState } from 'react';
import { Select } from 'src/components';
import { FormItemProps } from 'antd/lib/form';
import { FilterPluginStyle, StyledFormItem, StatusMessage } from '../common';
import { PluginFilterTimeColumnProps } from './types';

export default function PluginFilterTimeColumn(
  props: PluginFilterTimeColumnProps,
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

  const handleChange = (value?: string[] | string | null) => {
    const resultValue: string[] = ensureIsArray<string>(value);
    setValue(resultValue);
    const extraFormData: ExtraFormData = {};
    if (resultValue.length) {
      extraFormData.granularity_sqla = resultValue[0];
    }

    setDataMask({
      extraFormData,
      filterState: {
        value: resultValue.length ? resultValue : null,
      },
    });
  };

  useEffect(() => {
    handleChange(defaultValue ?? null);
    // I think after Config Modal update some filter it re-creates default value for all other filters
    // so we can process it like this `JSON.stringify` or start to use `Immer`
  }, [JSON.stringify(defaultValue)]);

  useEffect(() => {
    handleChange(filterState.value ?? null);
  }, [JSON.stringify(filterState.value)]);

  const timeColumns = (data || []).filter(
    row => row.dtype === GenericDataType.Temporal,
  );

  const placeholderText =
    timeColumns.length === 0
      ? t('No time columns')
      : tn('%s option', '%s options', timeColumns.length, timeColumns.length);

  const formItemData: FormItemProps = {};
  if (filterState.validateMessage) {
    formItemData.extra = (
      <StatusMessage status={filterState.validateStatus}>
        {filterState.validateMessage}
      </StatusMessage>
    );
  }

  const options = timeColumns.map(
    (row: { column_name: string; verbose_name: string | null }) => {
      const { column_name: columnName, verbose_name: verboseName } = row;
      return {
        label: verboseName ?? columnName,
        value: columnName,
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
