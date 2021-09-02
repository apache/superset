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
  useCallback,
} from 'react';
import { styled, t } from '@superset-ui/core';
import AntdSelect, {
  SelectProps as AntdSelectProps,
  SelectValue as AntdSelectValue,
  LabeledValue as AntdLabeledValue,
} from 'antd/lib/select';
import { DownOutlined, SearchOutlined } from '@ant-design/icons';
import debounce from 'lodash/debounce';
import { isEqual } from 'lodash';
import { Spin } from 'antd';
import Icons from 'src/components/Icons';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { hasOption } from './utils';

type AntdSelectAllProps = AntdSelectProps<AntdSelectValue>;

type PickedSelectProps = Pick<
  AntdSelectAllProps,
  | 'allowClear'
  | 'autoFocus'
  | 'disabled'
  | 'filterOption'
  | 'notFoundContent'
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

export type OptionsPagePromise = (
  search: string,
  page: number,
  pageSize: number,
) => Promise<OptionsTypePage>;

export interface SelectProps extends PickedSelectProps {
  allowNewOptions?: boolean;
  ariaLabel: string;
  header?: ReactNode;
  mode?: 'single' | 'multiple';
  name?: string; // discourage usage
  options: OptionsType | OptionsPagePromise;
  pageSize?: number;
  invertSelection?: boolean;
  fetchOnlyOnSearch?: boolean;
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

    && .ant-select-selector {
      border-radius: ${theme.gridUnit}px;
    }

    // Open the dropdown when clicking on the suffix
    // This is fixed in version 4.16
    .ant-select-arrow .anticon:not(.ant-select-suffix) {
      pointer-events: none;
    }
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

const StyledErrorMessage = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledSpin = styled(Spin)`
  margin-top: ${({ theme }) => -theme.gridUnit}px;
`;

const StyledLoadingText = styled.span`
  ${({ theme }) => `
    margin-left: ${theme.gridUnit * 3}px;
    color: ${theme.colors.grayscale.light1};
  `}
`;

const MAX_TAG_COUNT = 4;
const TOKEN_SEPARATORS = [',', '\n', '\t', ';'];
const DEBOUNCE_TIMEOUT = 500;
const DEFAULT_PAGE_SIZE = 100;
const EMPTY_OPTIONS: OptionsType = [];

const Error = ({ error }: { error: string }) => (
  <StyledError>
    <Icons.ErrorSolid /> <StyledErrorMessage>{error}</StyledErrorMessage>
  </StyledError>
);

const Select = ({
  allowNewOptions = false,
  ariaLabel,
  fetchOnlyOnSearch,
  filterOption = true,
  header = null,
  invertSelection = false,
  mode = 'single',
  name,
  options,
  pageSize = DEFAULT_PAGE_SIZE,
  placeholder = t('Select ...'),
  showSearch,
  value,
  ...props
}: SelectProps) => {
  const isAsync = typeof options === 'function';
  const isSingleMode = mode === 'single';
  const shouldShowSearch = isAsync || allowNewOptions ? true : showSearch;
  const initialOptions =
    options && Array.isArray(options) ? options : EMPTY_OPTIONS;
  const [selectOptions, setSelectOptions] = useState<OptionsType>(
    initialOptions,
  );
  const [selectValue, setSelectValue] = useState(value);
  const [searchedValue, setSearchedValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingEnabled, setLoadingEnabled] = useState(false);
  const fetchedQueries = useRef(new Map<string, number>());
  const mappedMode = isSingleMode
    ? undefined
    : allowNewOptions
    ? 'tags'
    : 'multiple';

  useEffect(() => {
    setSelectOptions(
      options && Array.isArray(options) ? options : EMPTY_OPTIONS,
    );
  }, [options]);

  useEffect(() => {
    if (isAsync && value) {
      const array: AntdLabeledValue[] = Array.isArray(value)
        ? (value as AntdLabeledValue[])
        : [value as AntdLabeledValue];
      const options: AntdLabeledValue[] = [];
      array.forEach(element => {
        const found = selectOptions.find(
          option => option.value === element.value,
        );
        if (!found) {
          options.push(element);
        }
      });
      if (options.length > 0) {
        setSelectOptions([...selectOptions, ...options]);
      }
    }
  }, [isAsync, selectOptions, value]);

  useEffect(() => {
    setSelectValue(value);
  }, [value]);

  const handleTopOptions = useCallback(
    (selectedValue: AntdSelectValue | undefined) => {
      // bringing selected options to the top of the list
      if (selectedValue !== undefined && selectedValue !== null) {
        const topOptions: OptionsType = [];
        const otherOptions: OptionsType = [];

        selectOptions.forEach(opt => {
          let found = false;
          if (Array.isArray(selectedValue)) {
            if (isAsync) {
              found =
                (selectedValue as AntdLabeledValue[]).find(
                  element => element.value === opt.value,
                ) !== undefined;
            } else {
              found = selectedValue.includes(opt.value);
            }
          } else {
            found = isAsync
              ? (selectedValue as AntdLabeledValue).value === opt.value
              : selectedValue === opt.value;
          }

          if (found) {
            topOptions.push(opt);
          } else {
            otherOptions.push(opt);
          }
        });

        // fallback for custom options in tags mode as they
        // do not appear in the selectOptions state
        if (!isSingleMode && Array.isArray(selectedValue)) {
          selectedValue.forEach((val: string | number | AntdLabeledValue) => {
            if (
              !topOptions.find(
                tOpt =>
                  tOpt.value ===
                  (isAsync ? (val as AntdLabeledValue)?.value : val),
              )
            ) {
              if (isAsync) {
                const labelValue = val as AntdLabeledValue;
                topOptions.push({
                  label: labelValue.label,
                  value: labelValue.value,
                });
              } else {
                const value = val as string | number;
                topOptions.push({ label: String(value), value });
              }
            }
          });
        }

        const sortedOptions = [...topOptions, ...otherOptions];
        if (!isEqual(sortedOptions, selectOptions)) {
          setSelectOptions(sortedOptions);
        }
      }
    },
    [isAsync, isSingleMode, selectOptions],
  );

  const handleOnSelect = (
    selectedValue: string | number | AntdLabeledValue,
  ) => {
    if (isSingleMode) {
      setSelectValue(selectedValue);
    } else {
      const currentSelected = selectValue
        ? Array.isArray(selectValue)
          ? selectValue
          : [selectValue]
        : [];
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
      if (typeof value === 'number' || typeof value === 'string') {
        const array = selectValue as (string | number)[];
        setSelectValue(array.filter(element => element !== value));
      } else {
        const array = selectValue as AntdLabeledValue[];
        setSelectValue(array.filter(element => element.value !== value.value));
      }
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
      setSelectOptions(prevOptions => [
        ...prevOptions,
        ...data.filter(
          newOpt =>
            !prevOptions.find(prevOpt => prevOpt.value === newOpt.value),
        ),
      ]);
    }
  };

  const handlePaginatedFetch = useMemo(
    () => (value: string, page: number, pageSize: number) => {
      const key = `${value};${page};${pageSize}`;
      const cachedCount = fetchedQueries.current.get(key);
      if (cachedCount) {
        setTotalCount(cachedCount);
        setIsTyping(false);
        return;
      }
      setIsLoading(true);
      const fetchOptions = options as OptionsPagePromise;
      fetchOptions(value, page, pageSize)
        .then(({ data, totalCount }: OptionsTypePage) => {
          handleData(data);
          fetchedQueries.current.set(key, totalCount);
          setTotalCount(totalCount);
        })
        .catch(onError)
        .finally(() => {
          setIsLoading(false);
          setIsTyping(false);
        });
    },
    [options],
  );

  const handleOnSearch = useMemo(
    () =>
      debounce((search: string) => {
        const searchValue = search.trim();
        // enables option creation
        if (allowNewOptions && isSingleMode) {
          const firstOption =
            selectOptions.length > 0 && selectOptions[0].value;
          // replaces the last search value entered with the new one
          // only when the value wasn't part of the original options
          if (
            searchValue &&
            firstOption === searchedValue &&
            !initialOptions.find(o => o.value === searchedValue)
          ) {
            selectOptions.shift();
            setSelectOptions(selectOptions);
          }
          if (searchValue && !hasOption(searchValue, selectOptions)) {
            const newOption = {
              label: searchValue,
              value: searchValue,
            };
            // adds a custom option
            const newOptions = [...selectOptions, newOption];
            setSelectOptions(newOptions);
            setSelectValue(searchValue);
          }
        }
        setSearchedValue(searchValue);
        if (!searchValue) {
          setIsTyping(false);
        }
      }, DEBOUNCE_TIMEOUT),
    [
      allowNewOptions,
      initialOptions,
      isSingleMode,
      searchedValue,
      selectOptions,
    ],
  );

  const handlePagination = (e: UIEvent<HTMLElement>) => {
    const vScroll = e.currentTarget;
    const thresholdReached =
      vScroll.scrollTop > (vScroll.scrollHeight - vScroll.offsetHeight) * 0.7;
    const hasMoreData = page * pageSize + pageSize < totalCount;

    if (!isLoading && isAsync && hasMoreData && thresholdReached) {
      const newPage = page + 1;
      handlePaginatedFetch(searchedValue, newPage, pageSize);
      setPage(newPage);
    }
  };

  const handleFilterOption = (search: string, option: AntdLabeledValue) => {
    if (typeof filterOption === 'function') {
      return filterOption(search, option);
    }

    if (filterOption) {
      const searchValue = search.trim().toLowerCase();
      const { value, label } = option;
      const valueText = String(value);
      const labelText = String(label);
      return (
        valueText.toLowerCase().includes(searchValue) ||
        labelText.toLowerCase().includes(searchValue)
      );
    }

    return false;
  };

  const handleOnDropdownVisibleChange = (isDropdownVisible: boolean) => {
    setIsDropdownVisible(isDropdownVisible);

    if (isAsync && !loadingEnabled) {
      setLoadingEnabled(true);
    }

    // multiple or tags mode keep the dropdown visible while selecting options
    // this waits for the dropdown to be closed before sorting the top options
    if (!isSingleMode && !isDropdownVisible) {
      handleTopOptions(selectValue);
    }
  };

  useEffect(() => {
    const allowFetch = !fetchOnlyOnSearch || searchedValue;
    if (isAsync && loadingEnabled && allowFetch) {
      const page = 0;
      handlePaginatedFetch(searchedValue, page, pageSize);
      setPage(page);
    }
  }, [
    isAsync,
    searchedValue,
    pageSize,
    handlePaginatedFetch,
    loadingEnabled,
    fetchOnlyOnSearch,
  ]);

  useEffect(() => {
    if (isSingleMode) {
      handleTopOptions(selectValue);
    }
  }, [handleTopOptions, isSingleMode, selectValue]);

  const dropdownRender = (
    originNode: ReactElement & { ref?: RefObject<HTMLElement> },
  ) => {
    if (!isDropdownVisible) {
      originNode.ref?.current?.scrollTo({ top: 0 });
    }
    if ((isLoading && selectOptions.length === 0) || isTyping) {
      return <StyledLoadingText>{t('Loading...')}</StyledLoadingText>;
    }
    return error ? <Error error={error} /> : originNode;
  };

  const onInputKeyDown = () => {
    if (isAsync && !isTyping) {
      setIsTyping(true);
    }
  };

  const SuffixIcon = () => {
    if (isLoading) {
      return <StyledSpin size="small" />;
    }
    if (shouldShowSearch && isDropdownVisible) {
      return <SearchOutlined />;
    }
    return <DownOutlined />;
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
        labelInValue={isAsync}
        maxTagCount={MAX_TAG_COUNT}
        mode={mappedMode}
        onDeselect={handleOnDeselect}
        onDropdownVisibleChange={handleOnDropdownVisibleChange}
        onInputKeyDown={onInputKeyDown}
        onPopupScroll={isAsync ? handlePagination : undefined}
        onSearch={shouldShowSearch ? handleOnSearch : undefined}
        onSelect={handleOnSelect}
        onClear={() => setSelectValue(undefined)}
        options={selectOptions}
        placeholder={placeholder}
        showSearch={shouldShowSearch}
        showArrow
        tokenSeparators={TOKEN_SEPARATORS}
        value={selectValue}
        suffixIcon={<SuffixIcon />}
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
