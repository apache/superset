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
  ReactElement,
  ReactNode,
  UIEvent,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { styled } from '@superset-ui/core';
import { Select as AntdSelect, Spin } from 'antd';
import {
  SelectProps as AntdSelectProps,
  SelectValue as AntdSelectValue,
  LabeledValue as AntdLabeledValue,
} from 'antd/lib/select';
import debounce from 'lodash/debounce';

type AntdSelectAllProps = AntdSelectProps<AntdSelectValue>;
type PickedSelectProps = Pick<
  AntdSelectAllProps,
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
export type OptionsType = Exclude<AntdSelectAllProps['options'], undefined>;
export type OptionsPromise = (
  search: string,
  page?: number,
) => Promise<OptionsType>;
export enum ESelectTypes {
  MULTIPLE = 'multiple',
  TAGS = 'tags',
  SINGLE = '',
}
export interface SelectProps extends PickedSelectProps {
  allowNewOptions?: boolean;
  ariaLabel: string;
  header?: ReactNode;
  name?: string; // discourage usage
  notFoundContent?: ReactNode;
  options: OptionsType | OptionsPromise;
  paginatedFetch?: boolean;
}

// unexposed default behaviors
const MAX_TAG_COUNT = 4;
const TOKEN_SEPARATORS = [',', '\n', '\t', ';'];
const DEBOUNCE_TIMEOUT = 800;

const DropdownContent = ({
  content,
  loading,
}: {
  content: ReactElement;
  loading?: boolean;
}) => {
  const Loading = () => {
    const StyledLoading = styled.div`
      display: flex;
      justify-content: center;
      width: 100%;
    `;
    return (
      <StyledLoading>
        <Spin />
      </StyledLoading>
    );
  };
  return loading ? (
    <>
      {content}
      <Loading />
    </>
  ) : (
    content
  );
};

const SelectComponent = ({
  allowNewOptions = false,
  ariaLabel,
  filterOption,
  header = null,
  loading,
  mode,
  name,
  notFoundContent = null,
  paginatedFetch = false,
  options,
  showSearch,
  value,
  ...props
}: SelectProps) => {
  const isAsync = typeof options === 'function';
  const shouldShowSearch = isAsync || allowNewOptions ? true : showSearch;
  const initialOptions = options && Array.isArray(options) ? options : [];
  const [selectOptions, setOptions] = useState<OptionsType>(initialOptions);
  const [selectValue, setSelectValue] = useState(value);
  const [lastSearch, setLastSearch] = useState('');
  const [isLoading, setLoading] = useState(loading);
  const hasOption = selectOptions.find(
    opt =>
      opt.value.toLowerCase().includes(lastSearch.toLowerCase()) ||
      (typeof opt.label === 'string' &&
        opt.label.toLowerCase().includes(lastSearch.toLowerCase())),
  );
  const fetchRef = useRef(0);

  const handleSelectMode = () => {
    if (allowNewOptions && mode === ESelectTypes.MULTIPLE) {
      return ESelectTypes.TAGS;
    }
    if (!allowNewOptions && mode === ESelectTypes.TAGS) {
      return ESelectTypes.MULTIPLE;
    }
    return mode;
  };

  const handleOnSelect = (value: any) => {
    if (mode === ESelectTypes.MULTIPLE || mode === ESelectTypes.TAGS) {
      const currentSelected = Array.isArray(selectValue) ? selectValue : [];
      setSelectValue([...currentSelected, value]);
      return;
    }
    setSelectValue(value);
  };

  const handleOnDeselect = (value: any) => {
    if (Array.isArray(selectValue)) {
      const selectedValues = [
        ...(selectValue as []).filter(opt => opt !== value),
      ];
      setSelectValue(selectedValues);
    }
  };

  const handleFetch = useMemo(() => {
    const fetchOptions = options as OptionsPromise;
    const loadOptions = (value: string, paginate?: 'paginate') => {
      if (paginate) {
        fetchRef.current += 1;
      } else {
        fetchRef.current = 0;
      }
      const fetchId = fetchRef.current;
      const page = paginatedFetch ? fetchId : undefined;

      setLoading(true);

      fetchOptions(value, page).then((newOptions: OptionsType) => {
        if (fetchId !== fetchRef.current) return;

        setOptions(prevOptions => [
          ...prevOptions,
          ...newOptions.filter(
            newOpt =>
              !prevOptions.find(prevOpt => prevOpt.value === newOpt.value),
          ),
        ]);
        setLoading(false);
      });
    };
    return debounce(loadOptions, DEBOUNCE_TIMEOUT);
  }, [options, paginatedFetch]);

  const handleNewOptions = (options: OptionsType) =>
    options.filter(
      opt =>
        (opt.value !== '' && opt.value !== lastSearch) ||
        opt.value === selectValue,
    );

  const handleOnSearch = (searchValue: string) => {
    setLastSearch(searchValue);

    // enables option creation for single mode
    if (
      !isAsync &&
      allowNewOptions &&
      mode !== ESelectTypes.TAGS &&
      mode !== ESelectTypes.MULTIPLE
    ) {
      if (!hasOption) {
        const newOption = {
          label: searchValue,
          value: searchValue,
        };
        setOptions(handleNewOptions([...selectOptions, newOption]));
      }
      if (lastSearch && !searchValue) {
        setOptions(handleNewOptions(selectOptions));
      }
    }
  };

  const handlePagination = (e: UIEvent<HTMLElement>) => {
    const vScroll = e.currentTarget;
    if (
      isAsync &&
      paginatedFetch &&
      vScroll.scrollTop === vScroll.scrollHeight - vScroll.offsetHeight
    ) {
      handleFetch(lastSearch, 'paginate');
    }
  };

  const handleFilterOption = (
    search: string,
    option: { props: AntdLabeledValue },
  ) => {
    const searchValue = search.toLowerCase();
    if (filterOption && typeof filterOption === 'boolean') return filterOption;
    if (filterOption && typeof filterOption === 'function') {
      return filterOption(search);
    }
    const { value, label } = option.props;
    if (
      value &&
      label &&
      typeof value === 'string' &&
      typeof label === 'string'
    ) {
      return (
        value.toLowerCase().includes(searchValue) ||
        label.toLowerCase().includes(searchValue)
      );
    }
    return true;
  };

  useEffect(() => {
    if (isAsync && !hasOption) {
      handleFetch(lastSearch);
    }
  }, [isAsync, handleFetch, hasOption, lastSearch]);

  console.log('SELECT OPTIONS', selectOptions);

  return (
    <>
      {header}
      <AntdSelect
        aria-label={ariaLabel || name}
        dropdownRender={originNode => (
          <DropdownContent content={originNode} loading={isLoading} />
        )}
        filterOption={handleFilterOption}
        getPopupContainer={triggerNode => triggerNode.parentNode}
        loading={isLoading}
        maxTagCount={MAX_TAG_COUNT}
        mode={handleSelectMode()}
        notFoundContent={notFoundContent}
        onDeselect={handleOnDeselect}
        onPopupScroll={handlePagination}
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
