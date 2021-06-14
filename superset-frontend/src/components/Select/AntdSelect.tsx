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
import React, { ReactNode, useMemo, useState, useRef } from 'react';
import { styled } from '@superset-ui/core';
import { Select as AntdSelect, Spin } from 'antd';
import {
  SelectProps as AntdSelectProps,
  SelectValue as AntdSelectValue,
} from 'antd/lib/select';
import debounce from 'lodash/debounce';

type AntdSelectType = AntdSelectProps<AntdSelectValue>;
type PickedSelectProps = Pick<
  AntdSelectType,
  | 'allowClear'
  | 'autoFocus'
  | 'value'
  | 'defaultValue'
  | 'disabled'
  | 'filterOption'
  | 'loading'
  | 'mode'
  | 'notFoundContent'
  | 'onChange'
  | 'placeholder'
  | 'showSearch'
  | 'value'
>;

export type AntdOptionsType = Exclude<AntdSelectType['options'], undefined>;
export type OptionsPromise = (search: string) => Promise<AntdOptionsType>;
export interface SelectProps extends PickedSelectProps {
  allowNewOptions?: boolean;
  ariaLabel: string;
  header?: ReactNode;
  name?: string; // discourage usage
  notFoundContent?: ReactNode;
  options: AntdOptionsType | OptionsPromise;
}

// unexposed default behaviors
const MAX_TAG_COUNT = 4;
const TOKEN_SEPARATORS = [',', '\n', '\t', ';'];
const DEBOUNCE_TIMEOUT = 800;

const Loading = () => {
  const StyledLoading = styled.div`
    display: flex;
    width: 100%;
    justify-content: center;
  `;
  return (
    <StyledLoading>
      <Spin />
    </StyledLoading>
  );
};

const SelectComponent = ({
  allowNewOptions = false,
  ariaLabel,
  header = null,
  loading,
  mode,
  name,
  notFoundContent = null,
  options,
  showSearch,
  value,
  ...props
}: SelectProps) => {
  const isAsync = typeof options === 'function';
  const shouldShowSearch = isAsync || allowNewOptions ? true : showSearch;
  const initialOptions = options && Array.isArray(options) ? options : [];
  const [selectOptions, setOptions] = useState<AntdOptionsType>(initialOptions);
  const [selectValue, setSelectValue] = useState(value);
  const [lastSearch, setLastSearch] = useState('');
  const [isLoading, setLoading] = useState(loading);
  const fetchRef = useRef(0);

  const handleSelectMode = () => {
    if (allowNewOptions && mode === 'multiple') return 'tags';
    if (!allowNewOptions && mode === 'tags') return 'multiple';
    return mode;
  };

  const handleOnSelect = (option: any) => {
    if (mode === 'multiple' || mode === 'tags') {
      const currentSelected = Array.isArray(selectValue) ? selectValue : [];
      setSelectValue([...currentSelected, option]);
      return;
    }
    setSelectValue(option);
  };

  const handleOnDeselect = (option: any) => {
    if (Array.isArray(selectValue)) {
      const selectedValues = [
        ...(selectValue as []).filter(opt => opt !== option),
      ];
      setSelectValue(selectedValues);
    }
  };

  const handleFetch = useMemo(() => {
    const fetchOptions = options as OptionsPromise;
    const loadOptions = (value: string) => {
      fetchRef.current += 1;
      const fetchId = fetchRef.current;
      setOptions([]);
      setLoading(true);

      fetchOptions(value).then((newOptions: AntdOptionsType) => {
        if (fetchId !== fetchRef.current) {
          return;
        }
        setOptions(newOptions);
        setLoading(false);
      });
    };
    return debounce(loadOptions, DEBOUNCE_TIMEOUT);
  }, [options]);

  const handleNewOptions = (options: AntdOptionsType) =>
    options.filter(
      opt =>
        (opt.value !== '' && opt.value !== lastSearch) ||
        opt.value === selectValue,
    );

  const handleOnSearch = (searchValue: string) => {
    if (isAsync && searchValue) {
      handleFetch(searchValue);
    }
    // enables option creation for single mode replicating the default tags mode behavior
    if (!isAsync && allowNewOptions && mode !== 'tags' && mode !== 'multiple') {
      const hasOption = selectOptions.find(opt =>
        opt.value.toLowerCase().includes(searchValue.toLowerCase()),
      );
      if (!hasOption) {
        const newOption = {
          label: searchValue,
          value: searchValue,
        };
        setOptions(handleNewOptions([...selectOptions, newOption]));
        setLastSearch(searchValue);
      }
      if (!searchValue && !/^\s*$/.test(lastSearch)) {
        setOptions(handleNewOptions(selectOptions));
      }
    }
  };

  return (
    <>
      {header}
      <AntdSelect
        aria-label={ariaLabel || name}
        getPopupContainer={triggerNode => triggerNode.parentNode}
        loading={isLoading}
        maxTagCount={MAX_TAG_COUNT}
        mode={handleSelectMode()}
        notFoundContent={isLoading ? <Loading /> : notFoundContent}
        onDeselect={handleOnDeselect}
        onSearch={handleOnSearch}
        onSelect={handleOnSelect}
        options={selectOptions}
        showSearch={shouldShowSearch}
        tokenSeparators={TOKEN_SEPARATORS}
        value={selectValue}
        {...props}
      />
    </>
  );
};

const Select = styled((
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { ...props }: SelectProps,
) => <SelectComponent {...props} />)`
  width: 100%;
`;

export default Select;
