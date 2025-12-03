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
import { ensureIsArray, ExtraFormData, t, tn } from '@superset-ui/core';
import { useEffect, useState, useMemo } from 'react';
import {
  FormItem,
  type FormItemProps,
  Select,
  type SelectValue,
} from '@superset-ui/core/components';
import { FilterPluginStyle, StatusMessage } from '../common';
import { PluginFilterGroupByProps, ColumnOption, ColumnData } from './types';

const EMPTY_OBJECT = {};

export default function PluginFilterDynamicGroupBy(
  props: PluginFilterGroupByProps,
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

  const [value, setValue] = useState<string[]>(
    ensureIsArray<string>(defaultValue ?? []),
  );

  const handleChange = (values: SelectValue) => {
    const resultValue: string[] = ensureIsArray<string>(
      values as string | string[] | null | undefined,
    );

    const extraFormData: ExtraFormData = {
      custom_form_data: {
        groupby: resultValue,
      },
    };

    setValue(resultValue);
    setDataMask({
      extraFormData,
      filterState: {
        label: resultValue.join(', '),
        value: resultValue.length ? resultValue : null,
      },
    });
  };

  useEffect(() => {
    handleChange(defaultValue ?? []);
  }, [JSON.stringify(defaultValue)]);

  useEffect(() => {
    handleChange(filterState.value ?? []);
  }, [JSON.stringify(filterState.value)]);

  const placeholderText =
    (data || []).length === 0
      ? t('No data')
      : tn('%s option', '%s options', data.length, data.length);

  const formItemData: FormItemProps = useMemo(() => {
    if (filterState.validateMessage) {
      return {
        extra: (
          <StatusMessage status={filterState.validateStatus}>
            {filterState.validateMessage}
          </StatusMessage>
        ),
      };
    }
    return EMPTY_OBJECT as FormItemProps;
  }, [filterState.validateMessage, filterState.validateStatus]);

  const options = useMemo(
    () =>
      (data || []).map((row: ColumnOption | ColumnData) => {
        const columnName = 'column_name' in row ? row.column_name : row.value;
        const label =
          ('verbose_name' in row && row.verbose_name) ||
          ('label' in row && row.label) ||
          columnName;
        return {
          label,
          value: columnName,
        };
      }),
    [data],
  );

  return (
    <FilterPluginStyle height={height} width={width}>
      <FormItem validateStatus={filterState.validateStatus} {...formItemData}>
        <div onMouseEnter={setHoveredFilter} onMouseLeave={unsetHoveredFilter}>
          <Select
            name={formData.nativeFilterId}
            allowClear
            mode="multiple"
            value={value}
            placeholder={placeholderText}
            onChange={handleChange}
            onBlur={unsetFocusedFilter}
            onFocus={setFocusedFilter}
            ref={inputRef}
            options={options}
            onOpenChange={setFilterActive}
          />
        </div>
      </FormItem>
    </FilterPluginStyle>
  );
}
