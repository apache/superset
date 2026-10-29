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
import { t, tn } from '@apache-superset/core/translation';
import { ensureIsArray, ExtraFormData } from '@superset-ui/core';
import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  FormItem,
  type FormItemProps,
  LabeledValue,
  Select,
  type SelectValue,
} from '@superset-ui/core/components';
import { propertyComparator } from '@superset-ui/core/components/Select/utils';
import { FilterPluginStyle, StatusMessage } from '../common';
import { PluginFilterGroupByProps, ColumnOption, ColumnData } from './types';
import { getAllowedGroupByColumns } from './columnAllowlist';

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

  // The columns a default may use: the builder's allowlist, narrowed to the
  // dataset's groupable columns. Unrestricted (null) when neither is known.
  const allowedColumns = useMemo(
    () =>
      getAllowedGroupByColumns(
        formData.columnsAllowlist,
        formData.groupableColumns,
      ),
    [formData.columnsAllowlist, formData.groupableColumns],
  );

  const options = useMemo(
    () =>
      (data || [])
        .map((row: ColumnOption | ColumnData) => {
          const columnName = 'column_name' in row ? row.column_name : row.value;
          const label =
            ('verbose_name' in row && row.verbose_name) ||
            ('label' in row && row.label) ||
            columnName;
          return {
            label,
            value: columnName,
          };
        })
        .filter(option => !allowedColumns || allowedColumns.has(option.value)),
    [data, allowedColumns],
  );

  // A default that the allowlist excludes would put every viewer into a
  // group-by they cannot choose, so drop excluded columns from the selection
  // as soon as the options are known (never before, or an unloaded column
  // list would wipe a valid default).
  useEffect(() => {
    if (!allowedColumns || !(data || []).length) {
      return;
    }
    const kept = value.filter(column => allowedColumns.has(column));
    if (kept.length !== value.length) {
      handleChange(kept);
    }
  }, [allowedColumns, data, value]);

  const sortComparator = useCallback(
    (a: LabeledValue, b: LabeledValue) => {
      if (formData.sortAscending === undefined) {
        return 0;
      }
      const labelComparator = propertyComparator('label');
      if (formData.sortAscending) {
        return labelComparator(a, b);
      }
      return labelComparator(b, a);
    },
    [formData.sortAscending],
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
            sortComparator={sortComparator}
          />
        </div>
      </FormItem>
    </FilterPluginStyle>
  );
}
