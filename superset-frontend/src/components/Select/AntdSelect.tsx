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
import React, {
  KeyboardEvent,
  ReactElement,
  SyntheticEvent,
  useState,
  useMemo,
  useRef,
} from 'react';
import { styled, t } from '@superset-ui/core';
import { Select as AntdSelect, Spin } from 'antd';
import {
  SelectProps as AntdSelectProps,
  SelectValue as AntdSelectValue,
  LabeledValue as AntdLabeledValue,
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
  header?: ReactElement;
  name?: string; // discourage usage
  notFoundContent?: ReactElement;
  options: AntdOptionsType & OptionsPromise;
  onPaste(e: SyntheticEvent): void;
}

// unexposed default behaviors
const MAX_TAG_COUNT = 4;
const CLOSE_ON_SCROLL_OUT = true;
const GET_POPUP_CONTAINER = '';
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
      <Spin size="large" />
    </StyledLoading>
  );
};

const SelectComponent = ({
  allowNewOptions = false,
  ariaLabel,
  loading,
  mode,
  name,
  notFoundContent,
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
      setSelectValue([...(selectValue as []).filter(opt => opt !== option)]);
    }
  };

  const handleNewOption = (e: KeyboardEvent<HTMLInputElement>) => {
    // enable option creation for single mode
    if (allowNewOptions && mode !== 'tags' && mode !== 'multiple') {
      const { value } = e.currentTarget;
      if (value) {
        const hasOption = selectOptions.find(opt => opt.value === value);
        if (!hasOption) {
          if (e.keyCode === 13) {
            const newOption = {
              label: value,
              value,
            };
            setOptions([...selectOptions, newOption]);
            setSelectValue(value);
          }
        }
      }
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

  const handleOnSearch = (search: string) => {
    if (isAsync && search) {
      handleFetch(search);
    }
  };

  return (
    <AntdSelect
      aria-label={ariaLabel || name}
      loading={isLoading}
      maxTagCount={MAX_TAG_COUNT}
      mode={handleSelectMode()}
      onInputKeyDown={handleNewOption}
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
  );
};

const Select = styled((
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { ...props }: SelectProps,
) => <SelectComponent {...props} />)`
  width: 100%;
`;

export default Select;
