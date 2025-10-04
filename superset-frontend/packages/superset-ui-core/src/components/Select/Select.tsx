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
  FocusEvent,
  RefObject,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  ClipboardEvent,
  Ref,
  ReactElement,
} from 'react';

import { ensureIsArray, t, usePrevious } from '@superset-ui/core';
import { Constants } from '@superset-ui/core/components';
import {
  LabeledValue as AntdLabeledValue,
  RefSelectProps,
} from 'antd/es/select';
import { debounce, isEqual, uniq } from 'lodash';
import {
  dropDownRenderHelper,
  getOption,
  getSuffixIcon,
  getValue,
  handleFilterOptionHelper,
  hasOption,
  isLabeledValue,
  isObject,
  mapOptions,
  mapValues,
  sortComparatorWithSearchHelper,
  sortSelectedFirstHelper,
  isEqual as utilsIsEqual,
} from './utils';
import { RawValue, SelectOptionsType, SelectProps } from './types';
import {
  StyledBulkActionsContainer,
  StyledCheckOutlined,
  StyledContainer,
  StyledHeader,
  StyledSelect,
  StyledStopOutlined,
} from './styles';
import {
  DEFAULT_SORT_COMPARATOR,
  EMPTY_OPTIONS,
  MAX_TAG_COUNT,
  TOKEN_SEPARATORS,
  VIRTUAL_THRESHOLD,
} from './constants';
import { Space } from '../Space';
import { Button } from '../Button';

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
const Select = forwardRef(
  (
    {
      className,
      allowClear,
      allowNewOptions = false,
      allowSelectAll = true,
      ariaLabel,
      autoClearSearchValue = false,
      filterOption = true,
      header = null,
      headerPosition = 'top',
      helperText,
      invertSelection = false,
      labelInValue = false,
      loading,
      mode = 'single',
      name,
      notFoundContent,
      onBlur,
      onChange,
      onClear,
      onOpenChange,
      onDeselect,
      onSearch,
      onSelect,
      optionFilterProps = ['label', 'value'],
      options,
      placeholder = t('Select ...'),
      showSearch = true,
      sortComparator = DEFAULT_SORT_COMPARATOR,
      tokenSeparators = TOKEN_SEPARATORS,
      value,
      getPopupContainer,
      oneLine,
      maxTagCount: propsMaxTagCount,
      virtual = undefined,
      ...props
    }: SelectProps,
    ref: Ref<RefSelectProps>,
  ) => {
    const isSingleMode = mode === 'single';
    const shouldShowSearch = allowNewOptions ? true : showSearch;
    const [selectValue, setSelectValue] = useState(value);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(loading);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [visibleOptions, setVisibleOptions] = useState<SelectOptionsType>([]);
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

    // Prevent maxTagCount change during click events to avoid click target disappearing
    const [stableMaxTagCount, setStableMaxTagCount] = useState(maxTagCount);
    const isOpeningRef = useRef(false);

    useEffect(() => {
      if (oneLine) {
        if (isDropdownVisible && !isOpeningRef.current) {
          // Mark that we're in the opening process
          isOpeningRef.current = true;
          // Use requestAnimationFrame to ensure DOM has settled after the click
          requestAnimationFrame(() => {
            setStableMaxTagCount(0);
            isOpeningRef.current = false;
          });
          return;
        }
        if (!isDropdownVisible) {
          // When closing, immediately show the first tag
          setStableMaxTagCount(1);
          isOpeningRef.current = false;
        }
        return;
      }
      setStableMaxTagCount(maxTagCount);
    }, [maxTagCount, isDropdownVisible, oneLine]);

    const mappedMode = isSingleMode ? undefined : 'multiple';

    const sortSelectedFirst = useCallback(
      (a: AntdLabeledValue, b: AntdLabeledValue) =>
        sortSelectedFirstHelper(a, b, selectValue),
      [selectValue],
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
      [inputValue, sortComparator, isDropdownVisible],
    );

    const initialOptions = useMemo(
      () => (Array.isArray(options) ? options.slice() : EMPTY_OPTIONS),
      [options],
    );

    const initialOptionsSorted = useMemo(
      () => initialOptions.slice().sort(sortSelectedFirst),
      [initialOptions, sortSelectedFirst],
    );

    const [selectOptions, setSelectOptions] =
      useState<SelectOptionsType>(initialOptionsSorted);

    // add selected values to options list if they are not in it
    const fullSelectOptions = useMemo(() => {
      // check to see if selectOptions are grouped
      let groupedOptions: SelectOptionsType;
      if (selectOptions.some(opt => opt.options)) {
        groupedOptions = selectOptions.reduce(
          (acc, group) => [...acc, ...(group.options as SelectOptionsType)],
          [] as SelectOptionsType,
        );
      }
      const missingValues: SelectOptionsType = ensureIsArray(selectValue)
        .filter(
          opt => !hasOption(getValue(opt), groupedOptions || selectOptions),
        )
        .map(opt =>
          isLabeledValue(opt) ? opt : { value: opt, label: String(opt) },
        );
      const result =
        missingValues.length > 0
          ? missingValues.concat(selectOptions)
          : selectOptions;
      return result.slice().sort(sortSelectedFirst);
    }, [selectOptions, selectValue, sortSelectedFirst]);

    const enabledOptions = useMemo(
      () => visibleOptions.filter(option => !option.disabled),
      [visibleOptions],
    );

    const selectAllEligible = useMemo(
      () =>
        visibleOptions.filter(
          option =>
            (hasOption(option.value, selectValue) || !option.disabled) &&
            !option.isNewOption,
        ),
      [visibleOptions, selectValue],
    );

    const selectAllEnabled = useMemo(
      () =>
        !isSingleMode &&
        allowSelectAll &&
        selectOptions.length > 0 &&
        enabledOptions.length > 1,
      [
        isSingleMode,
        allowSelectAll,
        selectOptions.length,
        enabledOptions.length,
      ],
    );

    const selectAllMode = useMemo(
      () => ensureIsArray(selectValue).length === selectAllEligible.length + 1,
      [selectValue, selectAllEligible],
    );

    const bulkSelectCounts = useMemo(() => {
      const selectedValuesSet = new Set(
        ensureIsArray(selectValue).map(getValue),
      );
      return visibleOptions.reduce(
        (acc, option) => {
          const isSelected = selectedValuesSet.has(option.value);
          const isDisabled = option.disabled;
          const isNew = option.isNewOption;

          if (
            (!isDisabled || isSelected) &&
            ((isNew && isSelected) || !isNew)
          ) {
            acc.selectable += 1;
          }
          if (isSelected && !isDisabled) {
            acc.deselectable += 1;
          }
          return acc;
        },
        { selectable: 0, deselectable: 0 },
      );
    }, [visibleOptions, selectValue]);

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
          if (!hasOption(value, array)) {
            const result = [...array, selectedItem];
            if (
              result.length === selectAllEligible.length &&
              selectAllEnabled
            ) {
              return isLabeledValue(selectedItem)
                ? ([...result] as AntdLabeledValue[])
                : ([...result] as (string | number)[]);
            }
            return result as AntdLabeledValue[];
          }
          return previousState;
        });
        fireOnChange();
      }
      onSelect?.(selectedItem, option);
    };

    const clear = () => {
      if (isSingleMode) {
        setSelectValue(undefined);
      } else {
        setSelectValue(
          fullSelectOptions
            .filter(
              option => option.disabled && hasOption(option.value, selectValue),
            )
            .map(option =>
              labelInValue
                ? {
                    label: option.label,
                    value: option.value,
                  }
                : option.value,
            )
            .filter(
              (val): val is RawValue => val !== null && val !== undefined,
            ),
        );
      }
      fireOnChange();
    };

    const handleOnDeselect: SelectProps['onDeselect'] = (value, option) => {
      if (Array.isArray(selectValue)) {
        const array = (selectValue as AntdLabeledValue[]).filter(
          element => getValue(element) !== getValue(value),
        );
        setSelectValue(array);

        // removes new option
        if (option.isNewOption) {
          const updatedOptions = fullSelectOptions.filter(
            option => getValue(option.value) !== getValue(value),
          );
          setSelectOptions(updatedOptions);
          setVisibleOptions(updatedOptions);
        }
      }
      fireOnChange();
      onDeselect?.(value, option);
    };

    const handleFilterOption = (search: string, option: AntdLabeledValue) =>
      handleFilterOptionHelper(search, option, optionFilterProps, filterOption);

    const handleOnSearch = debounce((search: string) => {
      const searchValue = search.trim();
      setIsSearching(!!searchValue);

      let updatedOptions = selectOptions;

      if (allowNewOptions) {
        const optionsWithoutTemporary = ensureIsArray(fullSelectOptions).filter(
          opt => !opt.isNewOption,
        );
        const shouldCreateNewOption =
          searchValue && !hasOption(searchValue, optionsWithoutTemporary, true);

        const newOption = shouldCreateNewOption && {
          label: searchValue,
          value: searchValue,
          isNewOption: true,
        };
        const cleanSelectOptions = ensureIsArray(fullSelectOptions).filter(
          opt => !opt.isNewOption || hasOption(opt.value, selectValue),
        );
        updatedOptions = newOption
          ? [newOption, ...cleanSelectOptions]
          : cleanSelectOptions;
        setSelectOptions(updatedOptions);
      }

      const filteredOptions = updatedOptions
        .map((option: any) => {
          /*
          If it's a group, filter its nested options and only return it
          if it has matching options
          */
          if ('options' in option && Array.isArray(option.options)) {
            const filteredGroupOptions = option.options.filter(
              (subOption: AntdLabeledValue) =>
                handleFilterOption(search, subOption),
            );
            return filteredGroupOptions.length > 0
              ? { ...option, options: filteredGroupOptions }
              : null;
          }

          return handleFilterOption(search, option as AntdLabeledValue)
            ? option
            : null;
        })
        .filter((option): option is AntdLabeledValue => option !== null);

      setVisibleOptions(filteredOptions);
      setInputValue(searchValue);
      onSearch?.(searchValue);
    }, Constants.FAST_DEBOUNCE);

    useEffect(() => () => handleOnSearch.cancel(), [handleOnSearch]);

    const handleOnDropdownVisibleChange = (isDropdownVisible: boolean) => {
      setIsDropdownVisible(isDropdownVisible);

      setVisibleOptions(fullSelectOptions);
      // if no search input value, force sort options because it won't be sorted by
      // `filterSort`.
      if (isDropdownVisible && !inputValue && selectOptions.length > 1) {
        if (!isEqual(initialOptionsSorted, selectOptions)) {
          setSelectOptions(initialOptionsSorted);
        }
      }
      if (!isDropdownVisible) {
        setSelectOptions(initialOptionsSorted);
      }
      if (onOpenChange) {
        onOpenChange(isDropdownVisible);
      }
    };

    const handleSelectAll = useCallback(() => {
      if (isSingleMode) return;

      const optionsToSelect = isSearching
        ? visibleOptions.filter(option => !option.isNewOption)
        : enabledOptions;

      const currentValues = ensureIsArray(selectValue);
      const currentValuesSet = new Set(currentValues.map(getValue));

      const newValues = [...currentValues] as RawValue[];
      optionsToSelect.forEach(option => {
        if (
          option.value &&
          !option.disabled &&
          !currentValuesSet.has(option.value)
        ) {
          newValues.push(option.value);
        }
      });

      setSelectValue(newValues);
      fireOnChange();
    }, [
      isSingleMode,
      isSearching,
      visibleOptions,
      enabledOptions,
      selectValue,
      fireOnChange,
    ]);

    const handleDeselectAll = useCallback(() => {
      if (isSingleMode) return;

      const deselectionValues = new Set(enabledOptions.map(opt => opt.value));

      const newValues = ensureIsArray(selectValue).filter(item => {
        const itemValue = getValue(item);
        return !deselectionValues.has(itemValue);
      }) as AntdLabeledValue[];

      setSelectValue(newValues);
      fireOnChange();
    }, [isSingleMode, enabledOptions, selectValue, fireOnChange]);

    const bulkSelectComponent = useMemo(
      () => (
        <StyledBulkActionsContainer justify="center">
          <Button
            type="link"
            buttonStyle="link"
            buttonSize="xsmall"
            disabled={bulkSelectCounts.selectable === 0}
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              handleSelectAll();
            }}
          >
            {`${t('Select all')} (${bulkSelectCounts.selectable})`}
          </Button>
          <Button
            type="link"
            buttonStyle="link"
            buttonSize="xsmall"
            disabled={bulkSelectCounts.deselectable === 0}
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              handleDeselectAll();
            }}
          >
            {`${t('Deselect all')} (${bulkSelectCounts.deselectable})`}
          </Button>
        </StyledBulkActionsContainer>
      ),
      [
        handleSelectAll,
        handleDeselectAll,
        bulkSelectCounts.selectable,
        bulkSelectCounts.deselectable,
      ],
    );

    const popupRender = (
      originNode: ReactElement & { ref?: RefObject<HTMLElement> },
    ) =>
      dropDownRenderHelper(
        originNode,
        isDropdownVisible,
        isLoading,
        fullSelectOptions.length,
        helperText,
        undefined,
        selectAllEnabled ? bulkSelectComponent : undefined,
      );

    const handleClear = () => {
      clear();
      if (onClear) {
        onClear();
      }
    };

    useEffect(() => {
      // when `options` list is updated from component prop, reset states
      setSelectOptions(initialOptions);
      setVisibleOptions(initialOptions);
    }, [initialOptions]);

    useEffect(() => {
      if (loading !== undefined && loading !== isLoading) {
        setIsLoading(loading);
      }
    }, [isLoading, loading]);

    useEffect(() => {
      setSelectValue(value);
    }, [value]);

    const handleOnBlur = (event: FocusEvent<HTMLElement>) => {
      setInputValue('');
      onBlur?.(event);
    };

    const handleOnChange = useCallback(
      (values: any, options: any) => {
        // intercept onChange call to handle the select all case
        // if the "select all" option is selected, we want to send all options to the onChange,
        // otherwise we want to remove
        let newValues = values;
        let newOptions = options;
        if (!isSingleMode) {
          if (
            ensureIsArray(values).length === selectAllEligible.length &&
            selectAllMode
          ) {
            const array = selectAllEligible.filter(
              option => hasOption(option.value, selectValue) && option.disabled,
            );
            newValues = mapValues(array, labelInValue);
            newOptions = mapOptions(array);
          }
        }
        onChange?.(newValues, newOptions);
      },
      [
        isSingleMode,
        labelInValue,
        onChange,
        selectAllEligible,
        selectAllMode,
        selectValue,
      ],
    );

    useEffect(() => {
      if (onChangeCount !== previousChangeCount) {
        const array = ensureIsArray(selectValue);
        const set = new Set(array.map(getValue));
        const options = mapOptions(
          fullSelectOptions.filter(opt => set.has(opt.value)),
        );
        if (isSingleMode) {
          handleOnChange(selectValue, selectValue ? options[0] : undefined);
        } else {
          handleOnChange(array, options);
        }
      }
    }, [
      fullSelectOptions,
      handleOnChange,
      isSingleMode,
      onChange,
      onChangeCount,
      previousChangeCount,
      selectValue,
    ]);

    const omittedCount = useMemo(() => {
      const num_selected = ensureIsArray(selectValue).length;
      const num_shown = stableMaxTagCount as number;
      return num_selected - num_shown - (selectAllMode ? 1 : 0);
    }, [stableMaxTagCount, selectAllMode, selectValue]);

    const customMaxTagPlaceholder = () =>
      `+ ${omittedCount > 0 ? omittedCount : 1} ...`;

    // We can't remove the + tag so when Select All
    // is the only item omitted, we subtract one from maxTagCount
    let actualMaxTagCount = stableMaxTagCount;
    if (
      actualMaxTagCount !== 'responsive' &&
      omittedCount === 0 &&
      selectAllMode
    ) {
      actualMaxTagCount -= 1;
    }

    const getPastedTextValue = useCallback(
      (text: string) => {
        const option = getOption(text, fullSelectOptions, true);
        if (!option && !allowNewOptions) {
          return undefined;
        }
        if (labelInValue) {
          const value: AntdLabeledValue = {
            label: text,
            value: text,
          };
          if (option) {
            value.label = isObject(option) ? option.label : option;
            value.value = isObject(option) ? option.value! : option;
          }
          return value;
        }
        return option ? (isObject(option) ? option.value! : option) : text;
      },
      [allowNewOptions, fullSelectOptions, labelInValue],
    );

    const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData('text');
      if (isSingleMode) {
        const value = getPastedTextValue(pastedText);
        if (value) {
          setSelectValue(value);
        }
      } else {
        const token = tokenSeparators.find(token => pastedText.includes(token));
        const array = token ? uniq(pastedText.split(token)) : [pastedText];

        const newOptions: SelectOptionsType = [];

        const values = array
          .map(item => {
            const option = getOption(item, fullSelectOptions, true);
            if (!option && allowNewOptions) {
              const newOption = {
                label: item,
                value: item,
                isNewOption: true,
              };
              newOptions.push(newOption);
            }
            return getPastedTextValue(item);
          })
          .filter(item => item !== undefined);

        if (newOptions.length > 0) {
          const updatedOptions = [...fullSelectOptions, ...newOptions];
          setSelectOptions(updatedOptions);
          setVisibleOptions(updatedOptions);
        }
        if (labelInValue) {
          setSelectValue(previous => [
            ...((previous || []) as AntdLabeledValue[]),
            ...(values as AntdLabeledValue[]),
          ]);
        } else {
          setSelectValue(previous => [
            ...((previous || []) as string[]),
            ...(values as string[]),
          ]);
        }
      }
      fireOnChange();
    };

    return (
      <StyledContainer className={className} headerPosition={headerPosition}>
        {header && (
          <StyledHeader headerPosition={headerPosition}>{header}</StyledHeader>
        )}
        <StyledSelect
          id={name}
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
          filterOption={handleFilterOption}
          filterSort={sortComparatorWithSearch}
          getPopupContainer={
            getPopupContainer || (triggerNode => triggerNode.parentNode)
          }
          headerPosition={headerPosition}
          labelInValue={labelInValue}
          maxTagCount={actualMaxTagCount}
          maxTagPlaceholder={customMaxTagPlaceholder}
          mode={mappedMode}
          notFoundContent={isLoading ? t('Loading...') : notFoundContent}
          onBlur={handleOnBlur}
          onDeselect={handleOnDeselect}
          onOpenChange={handleOnDropdownVisibleChange}
          // @ts-ignore
          onPaste={onPaste}
          onPopupScroll={undefined}
          onSearch={shouldShowSearch ? handleOnSearch : undefined}
          onSelect={handleOnSelect}
          onClear={handleClear}
          placeholder={placeholder}
          tokenSeparators={tokenSeparators}
          value={selectValue}
          virtual={
            virtual !== undefined
              ? virtual
              : fullSelectOptions.length > VIRTUAL_THRESHOLD
          }
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
          options={visibleOptions}
          optionRender={option => <Space>{option.label || option.value}</Space>}
          oneLine={oneLine}
          css={props.css}
          {...props}
          showSearch={shouldShowSearch}
          ref={ref}
        />
      </StyledContainer>
    );
  },
);

export default Select;
