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
import React, { useState, ReactNode } from 'react';
import AntdSelect, { SelectProps as AntdSelectProps } from 'antd/lib/select';

export const { Option }: any = AntdSelect;

export type SelectOption<VT = string> = [VT, ReactNode];

export type SelectProps<VT> = Omit<AntdSelectProps<VT>, 'options'> & {
  creatable?: boolean;
  minWidth?: string | number;
  options?: SelectOption<VT>[];
};

/**
 * AntD select with creatable options.
 */
export default function Select<VT extends string | number>({
  creatable,
  onSearch,
  dropdownMatchSelectWidth = false,
  minWidth = '100%',
  showSearch: showSearch_ = true,
  onChange,
  options,
  children,
  value,
  ...props
}: SelectProps<VT>) {
  const [searchValue, setSearchValue] = useState<string>();
  // force show search if creatable
  const showSearch = showSearch_ || creatable;
  const handleSearch = showSearch
    ? (input: string) => {
        if (creatable) {
          setSearchValue(input);
        }
        if (onSearch) {
          onSearch(input);
        }
      }
    : undefined;

  const optionsHasSearchValue = options?.some(([val]) => val === searchValue);
  const optionsHasValue = options?.some(([val]) => val === value);

  const handleChange: SelectProps<VT>['onChange'] = showSearch
    ? (val, opt) => {
        // reset input value once selected
        setSearchValue('');
        if (onChange) {
          onChange(val, opt);
        }
      }
    : onChange;

  return (
    <AntdSelect<VT>
      dropdownMatchSelectWidth={dropdownMatchSelectWidth}
      showSearch={showSearch}
      onSearch={handleSearch}
      onChange={handleChange}
      value={value}
      {...props}
      css={{
        minWidth,
      }}
    >
      {options?.map(([val, label]) => (
        <Option value={val}>{label}</Option>
      ))}
      {children}
      {value && !optionsHasValue && (
        <Option key={value} value={value}>
          {value}
        </Option>
      )}
      {searchValue && !optionsHasSearchValue && (
        <Option key={searchValue} value={searchValue}>
          {/* Unfortunately AntD select does not support displaying different
          label for option vs select value, so we can't use
          `t('Create "%s"', searchValue)` here */}
          {searchValue}
        </Option>
      )}
    </AntdSelect>
  );
}

Select.Option = Option;
