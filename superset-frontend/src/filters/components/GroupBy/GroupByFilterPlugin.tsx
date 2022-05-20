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
  getColumnLabel,
  t,
  tn,
} from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { FormItemProps } from 'antd/lib/form';
import { Select } from 'src/components';
import { FilterPluginStyle, StyledFormItem, StatusMessage } from '../common';
import { PluginFilterGroupByProps } from './types';

export default function PluginFilterGroupBy(props: PluginFilterGroupByProps) {
  const {
    data,
    formData,
    height,
    width,
    setDataMask,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    filterState,
    inputRef,
  } = props;
  const { defaultValue, multiSelect } = formData;

  const [value, setValue] = useState<string[]>(defaultValue ?? []);

  const handleChange = (value?: string[] | string | null) => {
    const resultValue: string[] = ensureIsArray<string>(value);
    setValue(resultValue);
    const extraFormData: ExtraFormData = {};
    if (resultValue.length) {
      extraFormData.interactive_groupby = resultValue;
    }

    setDataMask({
      filterState: { value: resultValue.length ? resultValue : null },
      extraFormData,
    });
  };

  useEffect(() => {
    handleChange(filterState.value);
  }, [JSON.stringify(filterState.value), multiSelect]);

  useEffect(() => {
    handleChange(defaultValue ?? null);
    // I think after Config Modal update some filter it re-creates default value for all other filters
    // so we can process it like this `JSON.stringify` or start to use `Immer`
  }, [JSON.stringify(defaultValue), multiSelect]);

  const groupbys = ensureIsArray(formData.groupby).map(getColumnLabel);
  const groupby = groupbys[0].length ? groupbys[0] : null;

  const withData = groupby
    ? data.filter(row => groupby.includes(row.column_name as string))
    : data;

  const columns = data ? withData : [];

  const placeholderText =
    columns.length === 0
      ? t('No columns')
      : tn('%s option', '%s options', columns.length, columns.length);

  const formItemData: FormItemProps = {};
  if (filterState.validateMessage) {
    formItemData.extra = (
      <StatusMessage status={filterState.validateStatus}>
        {filterState.validateMessage}
      </StatusMessage>
    );
  }
  const options = columns.map(
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
          allowClear
          value={value}
          placeholder={placeholderText}
          mode={multiSelect ? 'multiple' : undefined}
          // @ts-ignore
          onChange={handleChange}
          onBlur={unsetFocusedFilter}
          onFocus={setFocusedFilter}
          ref={inputRef}
          options={options}
          onDropdownVisibleChange={setFilterActive}
        />
      </StyledFormItem>
    </FilterPluginStyle>
  );
}
