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
  forwardRef,
  ReactElement,
  RefObject,
  UIEvent,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  ClipboardEvent,
} from 'react';
import { ensureIsArray, t, usePrevious } from '@superset-ui/core';
import { LabeledValue as AntdLabeledValue } from 'antd/lib/select';
import debounce from 'lodash/debounce';
import { isEqual, uniq } from 'lodash';
import Icons from 'src/components/Icons';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { FAST_DEBOUNCE, SLOW_DEBOUNCE } from 'src/constants';
import {
  getValue,
  hasOption,
  isLabeledValue,
  renderSelectOptions,
  hasCustomLabels,
  sortSelectedFirstHelper,
  sortComparatorWithSearchHelper,
  sortComparatorForNoSearchHelper,
  getSuffixIcon,
  dropDownRenderHelper,
  handleFilterOptionHelper,
  mapOptions,
  getOption,
  isObject,
} from './utils';
import {
  AsyncSelectProps,
  AsyncSelectRef,
  SelectOptionsPagePromise,
  SelectOptionsType,
  SelectOptionsTypePage,
  SelectProps,
} from './types';
import {
  StyledCheckOutlined,
  StyledContainer,
  StyledError,
  StyledErrorMessage,
  StyledHeader,
  StyledSelect,
  StyledStopOutlined,
} from './styles';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_OPTIONS,
  MAX_TAG_COUNT,
  TOKEN_SEPARATORS,
  DEFAULT_SORT_COMPARATOR,
} from './constants';
import { customTagRender } from './CustomTag';

const Error = ({ error }: { error: string }) => (
  <StyledError>
    <Icons.ErrorSolid /> <StyledErrorMessage>{error}</StyledErrorMessage>
  </StyledError>
);

const getQueryCacheKey = (value: string, page: number, pageSize: number) =>
  `${value};${page};${pageSize}`;

/**
 * This component is a customized version of the Antdesign 4.X Select component
 * https://ant.design/components/select/.
 * The aim of the component was to combine all the instances of select components throughout the
 * project under one and to remove the react-select component entirely.
 * This Select component provides an API that is tested against all the different use cases of Superset.
 * It limits and overrides the existing Antdesign API in order to keep their usage to the minimum
 * and to enforce simplification and standardization.
 * It is divided into two macro categories, Static and Async.
 * The Static type accepts a static array of options.
 * The Async type accepts a promise that will return the options.
 * Each of the categories come with different abilities. For a comprehensive guide please refer to
 * the storybook in src/components/Select/Select.stories.tsx.
 */
const AsyncSelect = forwardRef(
  (
    {
      allowClear,
      allowNewOptions = false,
      ariaLabel,
      autoClearSearchValue = false,
      fetchOnlyOnSearch,
      filterOption = true,
      header = null,
      headerPosition = 'top',
      helperText,
      invertSelection = false,
      lazyLoading = true,
      loading,
      mode = 'single',
      name,
      notFoundContent,
      onBlur,
      onError,
      onChange,
      onClear,
      onDropdownVisibleChange,
      onDeselect,
      onSearch,
      onSelect,
      optionFilterProps = ['label', 'value'],
      options,
      pageSize = DEFAULT_PAGE_SIZE,
      placeholder = t('Select ...'),
      showSearch = true,
      sortComparator = DEFAULT_SORT_COMPARATOR,
      tokenSeparators = TOKEN_SEPARATORS,
      value,
      getPopupContainer,
      oneLine,
      maxTagCount: propsMaxTagCount,
      ...props
    }: AsyncSelectProps,
    ref: RefObject<AsyncSelectRef>,
  ) => {
    const isSingleMode = mode === 'single';
    const [selectValue, setSelectValue] = useState(value);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(loading);
    const [error, setError] = useState('');
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [loadingEnabled, setLoadingEnabled] = useState(!lazyLoading);
    const [allValuesLoaded, setAllValuesLoaded] = useState(false);
    const selectValueRef = useRef(selectValue);
    const fetchedQueries = useRef(new Map<string, number>());
    const mappedMode = isSingleMode ? undefined : 'multiple';
    const allowFetch = !fetchOnlyOnSearch || inputValue;
    const [maxTagCount, setMaxTagCount] = useState(
      propsMaxTagCount ?? MAX_TAG_COUNT,
    );
    const [onChangeCount, setOnChangeCount] = useState(0);
    const previousChangeCount = usePrevious(onChangeCount, 0);

    const fireOnChange = useCallback(
      () => setOnChangeCount(onChangeCount + 1),
      [onChangeCount],
    );

    useEffect(() => {
      if (oneLine) {
        setMaxTagCount(isDropdownVisible ? 0 : 1);
      }
    }, [isDropdownVisible, oneLine]);

    useEffect(() => {
      selectValueRef.current = selectValue;
    }, [selectValue]);

    const sortSelectedFirst = useCallback(
      (a: AntdLabeledValue, b: AntdLabeledValue) =>
        sortSelectedFirstHelper(a, b, selectValueRef.current),
      [],
    );

    const sortComparatorWithSearch = useCallback(
      (a: AntdLabeledValue, b: AntdLabeledValue) =>
        sortComparatorWithSearchHelper(
          a,
          b,
          inputValue,
          sortSelectedFirst,
          sortComparator,
        ),
      [inputValue, sortComparator, sortSelectedFirst],
    );

    const sortComparatorForNoSearch = useCallback(
      (a: AntdLabeledValue, b: AntdLabeledValue) =>
        sortComparatorForNoSearchHelper(
          a,
          b,
          sortSelectedFirst,
          sortComparator,
        ),
      [sortComparator, sortSelectedFirst],
    );

    const [selectOptions, setSelectOptions] =
      useState<SelectOptionsType>(EMPTY_OPTIONS);

    // add selected values to options list if they are not in it
    const fullSelectOptions = useMemo(() => {
      const missingValues: SelectOptionsType = ensureIsArray(selectValue)
        .filter(opt => !hasOption(getValue(opt), selectOptions))
        .map(opt =>
          isLabeledValue(opt) ? opt : { value: opt, label: String(opt) },
        );
      return missingValues.length > 0
        ? missingValues.concat(selectOptions)
        : selectOptions;
    }, [selectOptions, selectValue]);

    const handleOnSelect: SelectProps['onSelect'] = (selectedItem, option) => {
      if (isSingleMode) {
        setSelectValue(selectedItem);
      } else {
        setSelectValue(previousState => {
          const array = ensureIsArray(previousState);
          const value = getValue(selectedItem);
          // Tokenized values can contain duplicated values
          if (!hasOption(value, array)) {
            const result = [...array, selectedItem];
            return isLabeledValue(selectedItem)
              ? (result as AntdLabeledValue[])
              : (result as (string | number)[]);
          }
          return previousState;
        });
      }
      fireOnChange();
      onSelect?.(selectedItem, option);
    };

    const handleOnDeselect: SelectProps['onDeselect'] = (value, option) => {
      if (Array.isArray(selectValue)) {
        if (isLabeledValue(value)) {
          const array = selectValue as AntdLabeledValue[];
          setSelectValue(
            array.filter(element => element.value !== value.value),
          );
        } else {
          const array = selectValue as (string | number)[];
          setSelectValue(array.filter(element => element !== value));
        }
        // removes new option
        if (option.isNewOption) {
          setSelectOptions(
            fullSelectOptions.filter(
              option => getValue(option.value) !== getValue(value),
            ),
          );
        }
      }
      fireOnChange();
      onDeselect?.(value, option);
    };

    const internalOnError = useCallback(
      (response: Response) =>
        getClientErrorObject(response).then(e => {
          const { error } = e;
          setError(error);

          if (onError) {
            onError(error);
          }
        }),
      [onError],
    );

    const mergeData = useCallback(
      (data: SelectOptionsType) => {
        let mergedData: SelectOptionsType = [];
        if (data && Array.isArray(data) && data.length) {
          // unique option values should always be case sensitive so don't lowercase
          const dataValues = new Set(data.map(opt => opt.value));
          // merges with existing and creates unique options
          setSelectOptions(prevOptions => {
            mergedData = prevOptions
              .filter(previousOption => !dataValues.has(previousOption.value))
              .concat(data)
              .sort(sortComparatorForNoSearch);
            return mergedData;
          });
        }
        return mergedData;
      },
      [sortComparatorForNoSearch],
    );

    const fetchPage = useMemo(
      () => (search: string, page: number) => {
        setPage(page);
        if (allValuesLoaded) {
          setIsLoading(false);
          return;
        }
        const key = getQueryCacheKey(search, page, pageSize);
        const cachedCount = fetchedQueries.current.get(key);
        if (cachedCount !== undefined) {
          setTotalCount(cachedCount);
          setIsLoading(false);
          return;
        }
        setIsLoading(true);

        const fetchOptions = options as SelectOptionsPagePromise;
        fetchOptions(search, page, pageSize)
          .then(({ data, totalCount }: SelectOptionsTypePage) => {
            const mergedData = mergeData(data);
            fetchedQueries.current.set(key, totalCount);
            setTotalCount(totalCount);
            if (
              !fetchOnlyOnSearch &&
              search === '' &&
              mergedData.length >= totalCount
            ) {
              setAllValuesLoaded(true);
            }
          })
          .catch(internalOnError)
          .finally(() => {
            setIsLoading(false);
          });
      },
      [
        allValuesLoaded,
        fetchOnlyOnSearch,
        mergeData,
        internalOnError,
        options,
        pageSize,
      ],
    );

    const debouncedFetchPage = useMemo(
      () => debounce(fetchPage, SLOW_DEBOUNCE),
      [fetchPage],
    );

    const handleOnSearch = debounce((search: string) => {
      const searchValue = search.trim();
      if (allowNewOptions) {
        const newOption = searchValue &&
          !hasOption(searchValue, fullSelectOptions, true) && {
            label: searchValue,
            value: searchValue,
            isNewOption: true,
          };
        const cleanSelectOptions = fullSelectOptions.filter(
          opt => !opt.isNewOption || hasOption(opt.value, selectValue),
        );
        const newOptions = newOption
          ? [newOption, ...cleanSelectOptions]
          : cleanSelectOptions;
        setSelectOptions(newOptions);
      }
      if (
        !allValuesLoaded &&
        loadingEnabled &&
        !fetchedQueries.current.has(getQueryCacheKey(searchValue, 0, pageSize))
      ) {
        // if fetch only on search but search value is empty, then should not be
        // in loading state
        setIsLoading(!(fetchOnlyOnSearch && !searchValue));
      }
      setInputValue(search);
      onSearch?.(searchValue);
    }, FAST_DEBOUNCE);

    useEffect(() => () => handleOnSearch.cancel(), [handleOnSearch]);

    const handlePagination = (e: UIEvent<HTMLElement>) => {
      const vScroll = e.currentTarget;
      const thresholdReached =
        vScroll.scrollTop > (vScroll.scrollHeight - vScroll.offsetHeight) * 0.7;
      const hasMoreData = page * pageSize + pageSize < totalCount;

      if (!isLoading && hasMoreData && thresholdReached) {
        const newPage = page + 1;
        fetchPage(inputValue, newPage);
      }
    };

    const handleFilterOption = (search: string, option: AntdLabeledValue) =>
      handleFilterOptionHelper(search, option, optionFilterProps, filterOption);

    const handleOnDropdownVisibleChange = (isDropdownVisible: boolean) => {
      setIsDropdownVisible(isDropdownVisible);

      // loading is enabled when dropdown is open,
      // disabled when dropdown is closed
      if (loadingEnabled !== isDropdownVisible) {
        setLoadingEnabled(isDropdownVisible);
      }
      // when closing dropdown, always reset loading state
      if (!isDropdownVisible && isLoading) {
        // delay is for the animation of closing the dropdown
        // so the dropdown doesn't flash between "Loading..." and "No data"
        // before closing.
        setTimeout(() => {
          setIsLoading(false);
        }, 250);
      }
      // if no search input value, force sort options because it won't be sorted by
      // `filterSort`.
      if (isDropdownVisible && !inputValue && selectOptions.length > 1) {
        const sortedOptions = selectOptions
          .slice()
          .sort(sortComparatorForNoSearch);
        if (!isEqual(sortedOptions, selectOptions)) {
          setSelectOptions(sortedOptions);
        }
      }

      if (onDropdownVisibleChange) {
        onDropdownVisibleChange(isDropdownVisible);
      }
    };

    const dropdownRender = (
      originNode: ReactElement & { ref?: RefObject<HTMLElement> },
    ) =>
      dropDownRenderHelper(
        originNode,
        isDropdownVisible,
        isLoading,
        fullSelectOptions.length,
        helperText,
        error ? <Error error={error} /> : undefined,
      );

    const handleClear = () => {
      setSelectValue(undefined);
      if (onClear) {
        onClear();
      }
      fireOnChange();
    };

    const handleOnBlur = (event: React.FocusEvent<HTMLElement>) => {
      setInputValue('');
      onBlur?.(event);
    };

    useEffect(() => {
      if (onChangeCount !== previousChangeCount) {
        const array = ensureIsArray(selectValue);
        const set = new Set(array.map(getValue));
        const options = mapOptions(
          fullSelectOptions.filter(opt => set.has(opt.value)),
        );
        if (isSingleMode) {
          // @ts-ignore
          onChange?.(selectValue, options[0]);
        } else {
          // @ts-ignore
          onChange?.(array, options);
        }
      }
    }, [
      fullSelectOptions,
      isSingleMode,
      onChange,
      onChangeCount,
      previousChangeCount,
      selectValue,
    ]);

    useEffect(() => {
      // when `options` list is updated from component prop, reset states
      fetchedQueries.current.clear();
      setAllValuesLoaded(false);
      setSelectOptions(EMPTY_OPTIONS);
    }, [options]);

    useEffect(() => {
      setSelectValue(value);
    }, [value]);

    // Stop the invocation of the debounced function after unmounting
    useEffect(
      () => () => {
        debouncedFetchPage.cancel();
      },
      [debouncedFetchPage],
    );

    useEffect(() => {
      if (loadingEnabled && allowFetch) {
        // trigger fetch every time inputValue changes
        if (inputValue) {
          debouncedFetchPage(inputValue, 0);
        } else {
          fetchPage('', 0);
        }
      }
    }, [loadingEnabled, fetchPage, allowFetch, inputValue, debouncedFetchPage]);

    useEffect(() => {
      if (loading !== undefined && loading !== isLoading) {
        setIsLoading(loading);
      }
    }, [isLoading, loading]);

    const clearCache = () => fetchedQueries.current.clear();

    useImperativeHandle(
      ref,
      () => ({
        ...(ref.current as HTMLInputElement),
        clearCache,
      }),
      [ref],
    );

    const getPastedTextValue = useCallback(
      (text: string) => {
        const option = getOption(text, fullSelectOptions, true);
        const value: AntdLabeledValue = {
          label: text,
          value: text,
        };
        if (option) {
          value.label = isObject(option) ? option.label : option;
          value.value = isObject(option) ? option.value! : option;
        }
        return value;
      },
      [fullSelectOptions],
    );

    const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData('text');
      if (isSingleMode) {
        setSelectValue(getPastedTextValue(pastedText));
      } else {
        const token = tokenSeparators.find(token => pastedText.includes(token));
        const array = token ? uniq(pastedText.split(token)) : [pastedText];
        const values = array.map(item => getPastedTextValue(item));
        setSelectValue(previous => [
          ...((previous || []) as AntdLabeledValue[]),
          ...values,
        ]);
      }
      fireOnChange();
    };

    const shouldRenderChildrenOptions = useMemo(
      () => hasCustomLabels(fullSelectOptions),
      [fullSelectOptions],
    );

    return (
      <StyledContainer headerPosition={headerPosition}>
        {header && (
          <StyledHeader headerPosition={headerPosition}>{header}</StyledHeader>
        )}
        <StyledSelect
          allowClear={!isLoading && allowClear}
          aria-label={ariaLabel || name}
          autoClearSearchValue={autoClearSearchValue}
          dropdownRender={dropdownRender}
          filterOption={handleFilterOption}
          filterSort={sortComparatorWithSearch}
          getPopupContainer={
            getPopupContainer || (triggerNode => triggerNode.parentNode)
          }
          headerPosition={headerPosition}
          labelInValue
          maxTagCount={maxTagCount}
          mode={mappedMode}
          notFoundContent={isLoading ? t('Loading...') : notFoundContent}
          onBlur={handleOnBlur}
          onDeselect={handleOnDeselect}
          onDropdownVisibleChange={handleOnDropdownVisibleChange}
          // @ts-ignore
          onPaste={onPaste}
          onPopupScroll={handlePagination}
          onSearch={showSearch ? handleOnSearch : undefined}
          onSelect={handleOnSelect}
          onClear={handleClear}
          options={shouldRenderChildrenOptions ? undefined : fullSelectOptions}
          placeholder={placeholder}
          showSearch={showSearch}
          showArrow
          tokenSeparators={tokenSeparators}
          value={selectValue}
          suffixIcon={getSuffixIcon(isLoading, showSearch, isDropdownVisible)}
          menuItemSelectedIcon={
            invertSelection ? (
              <StyledStopOutlined iconSize="m" aria-label="stop" />
            ) : (
              <StyledCheckOutlined iconSize="m" aria-label="check" />
            )
          }
          oneLine={oneLine}
          tagRender={customTagRender}
          {...props}
          ref={ref}
        >
          {hasCustomLabels(fullSelectOptions) &&
            renderSelectOptions(fullSelectOptions)}
        </StyledSelect>
      </StyledContainer>
    );
  },
);

export default AsyncSelect;
