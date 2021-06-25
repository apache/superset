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
  | 'onChange'
  | 'placeholder'
  | 'showSearch'
  | 'value'
>;

export type OptionsType = Exclude<AntdSelectAllProps['options'], undefined>;

export type OptionsTypePage = {
  data: OptionsType;
  totalCount: number;
};

export type OptionsPromise = (search: string) => Promise<OptionsType>;

export type OptionsPagePromise = (
  search: string,
  offset: number,
  limit: number,
) => Promise<OptionsTypePage>;

export interface SelectProps extends PickedSelectProps {
  allowNewOptions?: boolean;
  ariaLabel: string;
  header?: ReactNode;
  mode?: 'single' | 'multiple';
  name?: string; // discourage usage
  options: OptionsType | OptionsPromise | OptionsPagePromise;
  paginatedFetch?: boolean;
  pageSize?: number;
  invertSelection?: boolean;
}

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledSelect = styled(AntdSelect, {
  shouldForwardProp: prop => prop !== 'hasHeader',
})<{ hasHeader: boolean }>`
  ${({ theme, hasHeader }) => `
    width: 100%;
    margin-top: ${hasHeader ? theme.gridUnit : 0}px;
  `}
`;

const StyledStopOutlined = styled(Icons.StopOutlined)`
  vertical-align: 0;
`;

const StyledCheckOutlined = styled(Icons.CheckOutlined)`
  vertical-align: 0;
`;

const StyledError = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    padding: ${theme.gridUnit * 2}px;
    color: ${theme.colors.error.base};

    & svg {
      margin-right: ${theme.gridUnit * 2}px;
    }
  `}
`;

// default behaviors
const MAX_TAG_COUNT = 4;
const TOKEN_SEPARATORS = [',', '\n', '\t', ';'];
const DEBOUNCE_TIMEOUT = 500;
const DEFAULT_PAGE_SIZE = 50;

const Error = ({ error }: { error: string }) => (
  <StyledError>
    <Icons.ErrorSolid /> {error}
  </StyledError>
);

const Select = ({
  allowNewOptions = false,
  ariaLabel,
  filterOption,
  header = null,
  mode = 'single',
  name,
  paginatedFetch,
  pageSize = DEFAULT_PAGE_SIZE,
  placeholder = t('Select ...'),
  options,
  showSearch,
  invertSelection = false,
  value,
  ...props
}: SelectProps) => {
  const isAsync = typeof options === 'function';
  const isSingleMode = mode === 'single';
  const shouldShowSearch = isAsync || allowNewOptions ? true : showSearch;
  const initialOptions = options && Array.isArray(options) ? options : [];
  const [selectOptions, setOptions] = useState<OptionsType>(initialOptions);
  const [selectValue, setSelectValue] = useState(value);
  const [searchedValue, setSearchedValue] = useState('');
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const fetchedQueries = useRef(new Set<string>());
  const mappedMode = isSingleMode
    ? undefined
    : allowNewOptions
    ? 'tags'
    : 'multiple';

  const handleTopOptions = (selectedValue: AntdSelectValue | undefined) => {
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

  const handleOnSelect = (
    selectedValue: string | number | AntdLabeledValue,
  ) => {
    if (isSingleMode) {
      setSelectValue(selectedValue);
      // in single mode the sorting must happen on selection
      handleTopOptions(selectedValue);
    } else {
      const currentSelected = Array.isArray(selectValue) ? selectValue : [];
      if (
        typeof selectedValue === 'number' ||
        typeof selectedValue === 'string'
      ) {
        setSelectValue([
          ...(currentSelected as (string | number)[]),
          selectedValue as string | number,
        ]);
      } else {
        setSelectValue([
          ...(currentSelected as AntdLabeledValue[]),
          selectedValue as AntdLabeledValue,
        ]);
      }
    }
    setSearchedValue('');
  };

  const handleOnDeselect = (value: string | number | AntdLabeledValue) => {
    if (Array.isArray(selectValue)) {
      const selectedValues = [
        ...(selectValue as []).filter(opt => opt !== value),
      ];
      setSelectValue(selectedValues);
    }
    setSearchedValue('');
  };

  const onError = (response: Response) =>
    getClientErrorObject(response).then(e => {
      const { error } = e;
      setError(error);
    });

  const handleData = (data: OptionsType) => {
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
  };

  const handleFetch = useMemo(
    () => (value: string) => {
      if (fetchedQueries.current.has(value)) {
        return;
      }
      setLoading(true);
      const fetchOptions = options as OptionsPromise;
      fetchOptions(value)
        .then((data: OptionsType) => {
          handleData(data);
          fetchedQueries.current.add(value);
        })
        .catch(onError)
        .finally(() => setLoading(false));
    },
    [options],
  );

  const handlePaginatedFetch = useMemo(
    () => (value: string, offset: number, limit: number) => {
      const key = `${value};${offset};${limit}`;
      if (fetchedQueries.current.has(key)) {
        return;
      }
      setLoading(true);
      const fetchOptions = options as OptionsPagePromise;
      fetchOptions(value, offset, limit)
        .then(({ data, totalCount }: OptionsTypePage) => {
          handleData(data);
          fetchedQueries.current.add(key);
          setTotalCount(totalCount);
        })
        .catch(onError)
        .finally(() => setLoading(false));
    },
    [options],
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
    const thresholdReached =
      vScroll.scrollTop > (vScroll.scrollHeight - vScroll.offsetHeight) * 0.7;
    const hasMoreData = offset + pageSize < totalCount;

    if (!isLoading && isAsync && hasMoreData && thresholdReached) {
      const newOffset = offset + pageSize;
      const limit =
        newOffset + pageSize > totalCount ? totalCount - newOffset : pageSize;
      handlePaginatedFetch(searchedValue, newOffset, limit);
      setOffset(newOffset);
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
    if (isAsync && !foundOption) {
      if (paginatedFetch) {
        const offset = 0;
        handlePaginatedFetch(searchedValue, offset, pageSize);
        setOffset(offset);
      } else {
        handleFetch(searchedValue);
      }
    }
  }, [
    isAsync,
    handleFetch,
    searchedValue,
    selectOptions,
    pageSize,
    paginatedFetch,
    handlePaginatedFetch,
  ]);

  const dropdownRender = (
    originNode: ReactElement & { ref?: RefObject<HTMLElement> },
  ) => {
    if (!isDropdownVisible) {
      originNode.ref?.current?.scrollTo({ top: 0 });
    }
    return error ? <Error error={error} /> : originNode;
  };

  return (
    <StyledContainer>
      {header}
      <StyledSelect
        hasHeader={!!header}
        aria-label={ariaLabel || name}
        dropdownRender={dropdownRender}
        filterOption={handleFilterOption}
        getPopupContainer={triggerNode => triggerNode.parentNode}
        loading={isLoading}
        maxTagCount={MAX_TAG_COUNT}
        mode={mappedMode}
        onDeselect={handleOnDeselect}
        onDropdownVisibleChange={handleOnDropdownVisibleChange}
        onPopupScroll={paginatedFetch ? handlePagination : undefined}
        onSearch={handleOnSearch}
        onSelect={handleOnSelect}
        onClear={() => setSelectValue(undefined)}
        options={selectOptions}
        placeholder={placeholder}
        showSearch={shouldShowSearch}
        showArrow
        tokenSeparators={TOKEN_SEPARATORS}
        value={selectValue}
        menuItemSelectedIcon={
          invertSelection ? (
            <StyledStopOutlined iconSize="m" />
          ) : (
            <StyledCheckOutlined iconSize="m" />
          )
        }
        {...props}
      />
    </StyledContainer>
  );
};

export default Select;
