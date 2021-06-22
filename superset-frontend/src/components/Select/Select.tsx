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
  RefObject,
  UIEvent,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { styled, t } from '@superset-ui/core';
import { Select as AntdSelect } from 'antd';
import Icons from 'src/components/Icons';
import {
  SelectProps as AntdSelectProps,
  SelectValue as AntdSelectValue,
  LabeledValue as AntdLabeledValue,
} from 'antd/lib/select';
import debounce from 'lodash/debounce';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { hasOption } from './utils';

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

export type OptionsPromiseResult = {
  data: OptionsType;
  hasMoreData: boolean;
};

export type OptionsPromise = (
  search: string,
  page?: number,
) => Promise<OptionsPromiseResult>;

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

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

// unexposed default behaviors
const MAX_TAG_COUNT = 4;
const TOKEN_SEPARATORS = [',', '\n', '\t', ';'];
const DEBOUNCE_TIMEOUT = 500;

const Error = ({ error }: { error: string }) => {
  const StyledError = styled.div`
    display: flex;
    justify-content: center;
    width: 100%;
    color: ${({ theme }) => theme.colors.error};
  `;
  return (
    <StyledError>
      <Icons.Error /> {error}
    </StyledError>
  );
};

const DropdownContent = ({
  content,
  error,
}: {
  content: ReactElement;
  error?: string;
  loading?: boolean;
}) => {
  if (error) {
    return <Error error={error} />;
  }
  return content;
};

const Select = ({
  allowNewOptions = false,
  ariaLabel,
  filterOption,
  header = null,
  loading,
  mode,
  name,
  notFoundContent,
  paginatedFetch = false,
  placeholder = t('Select ...'),
  options,
  showSearch,
  value,
  ...props
}: SelectProps) => {
  const isAsync = typeof options === 'function';
  const isSingleMode =
    mode !== ESelectTypes.TAGS && mode !== ESelectTypes.MULTIPLE;
  const shouldShowSearch = isAsync || allowNewOptions ? true : showSearch;
  const initialOptions = options && Array.isArray(options) ? options : [];
  const [selectOptions, setOptions] = useState<OptionsType>(initialOptions);
  const [selectValue, setSelectValue] = useState(value);
  const [searchedValue, setSearchedValue] = useState('');
  const [isLoading, setLoading] = useState(loading);
  const [error, setError] = useState('');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(false);
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

  const handleTopOptions = (selectedValue: any) => {
    // bringing selected options to the top of the list
    if (selectedValue) {
      const currentValue = selectedValue as string[] | string;
      const topOptions = selectOptions.filter(opt =>
        currentValue?.includes(opt.value),
      );
      const otherOptions = selectOptions.filter(
        opt => !topOptions.find(tOpt => tOpt.value === opt.value),
      );
      // fallback for custom options in tags mode as they
      // do not appear in the selectOptions state
      if (!isSingleMode && Array.isArray(currentValue)) {
        // eslint-disable-next-line no-restricted-syntax
        for (const val of currentValue) {
          if (!topOptions.find(tOpt => tOpt.value === val)) {
            topOptions.push({ label: val, value: val });
          }
        }
      }
      setOptions([...topOptions, ...otherOptions]);
    }
  };

  const handleOnSelect = (selectedValue: any) => {
    if (!isSingleMode) {
      const currentSelected = Array.isArray(selectValue) ? selectValue : [];
      setSelectValue([...currentSelected, selectedValue]);
    } else {
      setSelectValue(selectedValue);
      // in single mode the sorting must happen on selection
      handleTopOptions(selectedValue);
    }
  };

  const handleOnDeselect = (value: any) => {
    if (Array.isArray(selectValue)) {
      const selectedValues = [
        ...(selectValue as []).filter(opt => opt !== value),
      ];
      setSelectValue(selectedValues);
    }
  };

  const handleFetch = useMemo(
    () => (value: string, paginate?: 'paginate') => {
      if (paginate) {
        fetchRef.current += 1;
      } else {
        fetchRef.current = 0;
      }
      const fetchId = fetchRef.current;
      const page = paginatedFetch ? fetchId : undefined;
      const fetchOptions = options as OptionsPromise;
      fetchOptions(value, page)
        .then((result: OptionsPromiseResult) => {
          const { data, hasMoreData } = result;
          setHasMoreData(hasMoreData);
          if (fetchId !== fetchRef.current) return;
          if (data && Array.isArray(data) && data.length) {
            // merges with existing and creates unique options
            setOptions(prevOptions => [
              ...prevOptions,
              ...data.filter(
                newOpt =>
                  !prevOptions.find(prevOpt => prevOpt.value === newOpt.value),
              ),
            ]);
          }
        })
        .catch(response =>
          getClientErrorObject(response).then(e => {
            const { error } = e;
            setError(error);
          }),
        )
        .finally(() => setLoading(false));
    },
    [options, paginatedFetch],
  );

  const handleOnSearch = debounce((search: string) => {
    const searchValue = search.trim();
    // enables option creation
    if (allowNewOptions && isSingleMode) {
      const lastOption = selectOptions[selectOptions.length - 1].value;
      // replaces the last search value entered with the new one
      // only when the value wasn't part of the original options
      if (
        lastOption === searchedValue &&
        !initialOptions.find(o => o.value === searchedValue)
      ) {
        selectOptions.pop();
        setOptions(selectOptions);
      }
      if (searchValue && !hasOption(searchValue, selectOptions)) {
        const newOption = {
          label: searchValue,
          value: searchValue,
        };
        // adds a custom option
        const newOptions = [...selectOptions, newOption];
        setOptions(newOptions);
      }
    }
    setSearchedValue(searchValue);
  }, DEBOUNCE_TIMEOUT);

  const handlePagination = (e: UIEvent<HTMLElement>) => {
    const vScroll = e.currentTarget;
    if (
      hasMoreData &&
      isAsync &&
      paginatedFetch &&
      vScroll.scrollTop === vScroll.scrollHeight - vScroll.offsetHeight
    ) {
      handleFetch(searchedValue, 'paginate');
    }
  };

  const handleFilterOption = (search: string, option: AntdLabeledValue) => {
    const searchValue = search.trim().toLowerCase();
    if (filterOption && typeof filterOption === 'boolean') return filterOption;
    if (filterOption && typeof filterOption === 'function') {
      return filterOption(search, option);
    }
    const { value, label } = option;
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

  const handleOnDropdownVisibleChange = (isDropdownVisible: boolean) => {
    setIsDropdownVisible(isDropdownVisible);
    // multiple or tags mode keep the dropdown visible while selecting options
    // this waits for the dropdown to be closed before sorting the top options
    if (!isSingleMode && !isDropdownVisible) {
      handleTopOptions(selectValue);
    }
  };

  useEffect(() => {
    const foundOption = hasOption(searchedValue, selectOptions);
    if (isAsync && !foundOption && !allowNewOptions) {
      setLoading(true);
      handleFetch(searchedValue);
    }
  }, [allowNewOptions, isAsync, handleFetch, searchedValue, selectOptions]);

  useEffect(() => {
    if (isAsync && allowNewOptions) {
      setLoading(true);
      handleFetch(searchedValue);
    }
  }, [allowNewOptions, isAsync, handleFetch, searchedValue]);

  const dropdownRender = (
    originNode: ReactElement & { ref?: RefObject<HTMLElement> },
  ) => {
    if (!isDropdownVisible) {
      originNode.ref?.current?.scrollTo({ top: 0 });
    }
    return <DropdownContent content={originNode} error={error} />;
  };

  return (
    <StyledContainer>
      {header}
      <AntdSelect
        aria-label={ariaLabel || name}
        dropdownRender={dropdownRender}
        filterOption={handleFilterOption as any}
        getPopupContainer={triggerNode => triggerNode.parentNode}
        loading={isLoading}
        maxTagCount={MAX_TAG_COUNT}
        mode={handleSelectMode()}
        notFoundContent={isLoading ? null : notFoundContent}
        onDeselect={handleOnDeselect}
        onDropdownVisibleChange={handleOnDropdownVisibleChange}
        onPopupScroll={handlePagination}
        onSearch={handleOnSearch}
        onSelect={handleOnSelect}
        options={selectOptions}
        placeholder={shouldShowSearch ? t('Search ...') : placeholder}
        showSearch={shouldShowSearch}
        tokenSeparators={TOKEN_SEPARATORS}
        value={selectValue}
        style={{ width: '100%' }}
        {...props}
      />
    </StyledContainer>
  );
};

export default Select;
