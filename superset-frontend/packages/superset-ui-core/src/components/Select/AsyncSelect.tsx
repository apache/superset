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
import {
  forwardRef,
  ForwardedRef,
  FocusEvent,
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

import { t } from '@apache-superset/core/translation';
import {
  ensureIsArray,
  usePrevious,
  getClientErrorObject,
} from '@superset-ui/core';
import {
  BaseOptionType,
  DefaultOptionType,
  LabeledValue as AntdLabeledValue,
  RefSelectProps,
} from 'antd/es/select';
import { debounce, isEqual, uniq } from 'lodash-es';
import { Constants, Icons } from '@superset-ui/core/components';
import { Space } from '../Space';
import {
  getValue,
  hasOption,
  isLabeledValue,
  sortSelectedFirstHelper,
  sortComparatorWithSearchHelper,
  sortComparatorForNoSearchHelper,
  getSuffixIcon,
  dropDownRenderHelper,
  handleFilterOptionHelper,
  mapOptions,
  getOption,
  isObject,
  isEqual as utilsIsEqual,
} from './utils';
import {
  AsyncSelectProps,
  AsyncSelectRef,
  RawValue,
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
  DROPDOWN_BUILTIN_PLACEMENTS,
} from './constants';

const Error = ({ error }: { error: string }) => (
  <StyledError>
    <Icons.ExclamationCircleOutlined />{' '}
    <StyledErrorMessage>{error}</StyledErrorMessage>
  </StyledError>
);

const getQueryCacheKey = (value: string, page: number, pageSize: number) =>
  `${value};${page};${pageSize}`;

/**
 * This component is a customized version of the Antdesign 4.X Select component
 * https://ant.design/components/select/.
 * This Select component provides an API that is tested against all the different use cases of Superset.
 * It limits and overrides the existing Antdesign API in order to keep their usage to the minimum
 * and to enforce simplification and standardization.
 * It is divided into two macro categories, Static and Async.
 * The Static type accepts a static array of options.
 * The Async type accepts a promise that will return the options.
 * Each of the categories come with different abilities. For a comprehensive guide please refer to
 * the storybook in @superset-ui/core/components/Select/Select.stories.tsx.
 */
const AsyncSelect = forwardRef(
  (
    {
      allowClear,
      allowNewOptions = false,
      ariaLabel,
      autoClearSearchValue = true,
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
      onOpenChange,
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
    ref: ForwardedRef<AsyncSelectRef>,
  ) => {
    const isSingleMode = mode === 'single';
    const shouldShowSearch = allowNewOptions ? true : Boolean(showSearch);
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
    const initialOptionsRef = useRef<SelectOptionsType>(EMPTY_OPTIONS);
    const inputValueRef = useRef('');
    // Counts fetches whose `.finally` has not yet run. Loading is cleared only
    // when this drops to 0, so a stale response (which returns early without
    // updating selectOptions) cannot flip the spinner off while a newer
    // request is still pending.
    const inFlightFetchesRef = useRef(0);
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

    useEffect(() => {
      inputValueRef.current = inputValue;
    }, [inputValue]);

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
          isLabeledValue(opt)
            ? { value: opt.value, label: opt.label }
            : { value: opt, label: String(opt) },
        );
      return missingValues.length > 0
        ? missingValues.concat(selectOptions)
        : selectOptions;
    }, [selectOptions, selectValue]);

    const handleOnSelect: SelectProps['onSelect'] = (selectedItem, option) => {
      if (isSingleMode) {
        // on select is fired in single value mode if the same value is selected
        const valueChanged = !utilsIsEqual(
          selectedItem,
          selectValue as RawValue | AntdLabeledValue,
          'value',
        );
        setSelectValue(selectedItem);
        if (valueChanged) {
          fireOnChange();
        }
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
        fireOnChange();
      }
      if (autoClearSearchValue) {
        setInputValue('');
        if (fetchOnlyOnSearch) {
          setSelectOptions([]);
        }
      }
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
              // Forward-compat: TS 6.0 infers stricter antd option types; widen
              // the comparator to accept the broader DefaultOptionType shape.
              .sort(
                sortComparatorForNoSearch as unknown as (
                  a: BaseOptionType | DefaultOptionType,
                  b: BaseOptionType | DefaultOptionType,
                ) => number,
              );
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
        inFlightFetchesRef.current += 1;
        fetchOptions(search, page, pageSize)
          .then(({ data, totalCount }: SelectOptionsTypePage) => {
            // Drop responses whose search arg no longer matches the user's
            // current input — otherwise a slow base fetch can land after a
            // search fetch (or a stale debounced search after a clear) and
            // re-pollute the dropdown via mergeData / search-replace. Search
            // responses are never cached in fetchedQueries: the cache stores
            // only totalCount, so a cache hit would short-circuit the fetch
            // and leave selectOptions stale (e.g. after restore-on-clear).
            // Re-issuing the search is cheap and correct.
            const matchesCurrentSearch = inputValueRef.current === search;
            if (search && !matchesCurrentSearch) {
              return;
            }
            if (!search) {
              // Accumulate base pages in a ref independent of selectOptions
              // (during an active search, selectOptions holds search results
              // and is not a safe accumulator). The accumulator is kept up
              // to date even when this response landed during a search, so
              // restore-on-clear has a complete snapshot. We don't sort here
              // — restore-on-clear sorts a copy at consumption time, and the
              // live selectOptions path below goes through mergeData which
              // sorts there. Sorting here too would double the per-page sort
              // cost on large cached option sets.
              const dataValues = new Set(data.map(opt => opt.value));
              const accumulated = initialOptionsRef.current
                .filter(opt => !dataValues.has(opt.value))
                .concat(data);
              initialOptionsRef.current = accumulated;
              if (!fetchOnlyOnSearch && accumulated.length >= totalCount) {
                setAllValuesLoaded(true);
              }
              fetchedQueries.current.set(key, totalCount);
              if (matchesCurrentSearch) {
                // No active search — push to live selectOptions and update
                // totalCount. When matchesCurrentSearch is false, the user
                // is mid-search; leave the search's totalCount in place so
                // pagination math stays correct.
                mergeData(data);
                setTotalCount(totalCount);
              }
            } else if (page === 0) {
              // Replace cached options with server results; preserve
              // optimistic isNewOption entries inserted by handleOnSearch
              // so allowNewOptions users can still click the value they
              // typed when the server returns no match.
              setSelectOptions(prevOptions => {
                const dataValues = new Set(data.map(opt => opt.value));
                const preservedNew = prevOptions.filter(
                  opt => opt.isNewOption && !dataValues.has(opt.value),
                );
                return preservedNew
                  .concat(data)
                  .sort(sortComparatorForNoSearch);
              });
              setTotalCount(totalCount);
            } else {
              // page > 0 during an active search — append normally.
              mergeData(data);
              setTotalCount(totalCount);
            }
          })
          .catch(internalOnError)
          .finally(() => {
            inFlightFetchesRef.current = Math.max(
              0,
              inFlightFetchesRef.current - 1,
            );
            if (inFlightFetchesRef.current === 0) {
              setIsLoading(false);
            }
          });
      },
      [
        allValuesLoaded,
        fetchOnlyOnSearch,
        mergeData,
        internalOnError,
        options,
        pageSize,
        sortComparatorForNoSearch,
      ],
    );

    const debouncedFetchPage = useMemo(
      () => debounce(fetchPage, Constants.SLOW_DEBOUNCE),
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
    }, Constants.FAST_DEBOUNCE);

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
          // Forward-compat: see note in mergeData above.
          .sort(
            sortComparatorForNoSearch as unknown as (
              a: BaseOptionType | DefaultOptionType,
              b: BaseOptionType | DefaultOptionType,
            ) => number,
          );
        if (!isEqual(sortedOptions, selectOptions)) {
          setSelectOptions(sortedOptions);
        }
      }

      if (onOpenChange) {
        onOpenChange(isDropdownVisible);
      }
    };

    const popupRender = (
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

    const handleOnBlur = (event: FocusEvent<HTMLElement>) => {
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
          // @ts-expect-error
          onChange?.(selectValue, options[0]);
        } else {
          // @ts-expect-error
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
      initialOptionsRef.current = EMPTY_OPTIONS;
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

    const previousInputValue = usePrevious(inputValue, '');
    useEffect(() => {
      if (loadingEnabled && allowFetch) {
        // trigger fetch every time inputValue changes
        if (inputValue) {
          debouncedFetchPage(inputValue, 0);
        } else {
          // Cancel any pending debounced search fetch so it can't fire after
          // we've already restored the base list.
          debouncedFetchPage.cancel();
          // On returning to empty input after a search, restore the cached
          // base options so the dropdown shows the original page-0 list
          // instead of the stale search results.
          if (previousInputValue && initialOptionsRef.current.length > 0) {
            setSelectOptions(
              [...initialOptionsRef.current].sort(sortComparatorForNoSearch),
            );
          }
          fetchPage('', 0);
        }
      }
    }, [
      loadingEnabled,
      fetchPage,
      allowFetch,
      inputValue,
      previousInputValue,
      debouncedFetchPage,
      sortComparatorForNoSearch,
    ]);

    useEffect(() => {
      if (loading !== undefined && loading !== isLoading) {
        setIsLoading(loading);
      }
    }, [isLoading, loading]);

    const clearCache = () => {
      fetchedQueries.current.clear();
      initialOptionsRef.current = EMPTY_OPTIONS;
      setAllValuesLoaded(false);
    };

    useImperativeHandle(ref, () => {
      const current =
        ref && typeof ref !== 'function' && ref.current
          ? (ref.current as RefSelectProps)
          : ({} as RefSelectProps);
      return {
        ...current,
        clearCache,
      };
    }, [ref]);

    const getPastedTextValue = useCallback(
      async (text: string) => {
        let option = getOption(text, fullSelectOptions, true);
        if (!option && !allValuesLoaded) {
          const fetchOptions = options as SelectOptionsPagePromise;
          option = await fetchOptions(text, 0, pageSize).then(
            ({ data }: SelectOptionsTypePage) =>
              data.find(item => item.label === text),
          );
        }
        if (!option && !allowNewOptions) {
          return undefined;
        }
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
      [allValuesLoaded, allowNewOptions, fullSelectOptions, options, pageSize],
    );

    const onPaste = async (e: ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData('text');
      if (isSingleMode) {
        const value = await getPastedTextValue(pastedText);
        if (value) {
          setSelectValue(value);
        }
      } else {
        // antd v6 widened `tokenSeparators` to `string[] | (input => string[])`;
        // Superset always uses the array form.
        const separators = Array.isArray(tokenSeparators)
          ? tokenSeparators
          : [];
        const token = separators.find((token: string) =>
          pastedText.includes(token),
        );
        const array = token
          ? uniq(
              pastedText
                .split(token)
                .map(s => s.trim())
                .filter(Boolean),
            )
          : [pastedText.trim()].filter(Boolean);
        const values = (
          await Promise.all(array.map(item => getPastedTextValue(item)))
        ).filter(item => item !== undefined) as AntdLabeledValue[];
        setSelectValue(previous => [
          ...((previous || []) as AntdLabeledValue[]),
          ...values.filter(value => !hasOption(value.value, previous)),
        ]);
      }
      fireOnChange();
    };

    return (
      <StyledContainer headerPosition={headerPosition}>
        {header && (
          <StyledHeader headerPosition={headerPosition}>{header}</StyledHeader>
        )}
        <StyledSelect
          allowClear={!isLoading && allowClear}
          aria-label={
            isSingleMode &&
            isLabeledValue(selectValue) &&
            typeof selectValue.label === 'string'
              ? `${ariaLabel || name}: ${selectValue.label}`
              : ariaLabel || name
          }
          data-test={ariaLabel || name}
          autoClearSearchValue={autoClearSearchValue}
          popupRender={popupRender}
          // Forward-compat: TS 6.0 infers stricter antd option types; local
          // helpers typed against AntdLabeledValue are behaviorally compatible
          // with the broader BaseOptionType/DefaultOptionType antd expects.
          filterOption={
            handleFilterOption as unknown as (
              search: string,
              option?: BaseOptionType | DefaultOptionType,
            ) => boolean
          }
          filterSort={
            sortComparatorWithSearch as unknown as (
              a: BaseOptionType | DefaultOptionType,
              b: BaseOptionType | DefaultOptionType,
            ) => number
          }
          getPopupContainer={
            getPopupContainer ||
            ((triggerNode: HTMLElement) =>
              (triggerNode?.closest('.ant-modal-content') as HTMLElement) ||
              (triggerNode.parentNode as HTMLElement))
          }
          headerPosition={headerPosition}
          labelInValue
          maxTagCount={maxTagCount}
          mode={mappedMode}
          notFoundContent={isLoading ? t('Loading...') : notFoundContent}
          onBlur={handleOnBlur}
          // Forward-compat: TS 6.0 narrows the Select value type handed to
          // SelectHandler; our local handlers already accept the broader union.
          onDeselect={
            handleOnDeselect as unknown as (
              value: unknown,
              option: BaseOptionType | DefaultOptionType,
            ) => void
          }
          onOpenChange={handleOnDropdownVisibleChange}
          // @ts-expect-error antd Select does not declare onPaste on its prop
          // surface, but the underlying input accepts it and we rely on that.
          onPaste={onPaste}
          onPopupScroll={handlePagination}
          onSearch={shouldShowSearch ? handleOnSearch : undefined}
          onSelect={
            handleOnSelect as unknown as (
              value: unknown,
              option: BaseOptionType | DefaultOptionType,
            ) => void
          }
          onClear={handleClear}
          options={fullSelectOptions}
          optionRender={option => <Space>{option.label || option.value}</Space>}
          placeholder={placeholder}
          showSearch={shouldShowSearch}
          tokenSeparators={tokenSeparators}
          builtinPlacements={DROPDOWN_BUILTIN_PLACEMENTS}
          value={selectValue}
          suffixIcon={getSuffixIcon(
            isLoading,
            shouldShowSearch,
            isDropdownVisible,
          )}
          menuItemSelectedIcon={
            invertSelection ? (
              <StyledStopOutlined iconSize="m" aria-label="stop" />
            ) : (
              <StyledCheckOutlined iconSize="m" aria-label="check" />
            )
          }
          oneLine={oneLine}
          {...props}
          ref={ref}
        />
      </StyledContainer>
    );
  },
);

export default AsyncSelect;
