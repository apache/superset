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
  ReactElement,
  RefObject,
  useEffect,
  useMemo,
  useState,
  useCallback,
  ClipboardEvent,
} from 'react';

import {
  ensureIsArray,
  formatNumber,
  NumberFormats,
  t,
  usePrevious,
} from '@superset-ui/core';
import AntdSelect, { LabeledValue as AntdLabeledValue } from 'antd/lib/select';
import { debounce, isEqual, uniq } from 'lodash';
import { FAST_DEBOUNCE } from 'src/constants';
import {
  getValue,
  hasOption,
  isLabeledValue,
  renderSelectOptions,
  sortSelectedFirstHelper,
  sortComparatorWithSearchHelper,
  handleFilterOptionHelper,
  dropDownRenderHelper,
  getSuffixIcon,
  SELECT_ALL_VALUE,
  selectAllOption,
  mapValues,
  mapOptions,
  hasCustomLabels,
  getOption,
  isObject,
  isEqual as utilsIsEqual,
} from './utils';
import { RawValue, SelectOptionsType, SelectProps } from './types';
import {
  StyledCheckOutlined,
  StyledContainer,
  StyledHeader,
  StyledSelect,
  StyledStopOutlined,
} from './styles';
import {
  EMPTY_OPTIONS,
  MAX_TAG_COUNT,
  TOKEN_SEPARATORS,
  DEFAULT_SORT_COMPARATOR,
} from './constants';
import { customTagRender } from './CustomTag';

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
 * the storybook in src/components/Select/Select.stories.tsx.
 */
const Select = forwardRef(
  (
    {
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
      onDropdownVisibleChange,
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
      ...props
    }: SelectProps,
    ref: RefObject<HTMLInputElement>,
  ) => {
    const isSingleMode = mode === 'single';
    const shouldShowSearch = allowNewOptions ? true : showSearch;
    const [selectValue, setSelectValue] = useState(value);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(loading);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
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

    const mappedMode = isSingleMode ? undefined : 'multiple';

    const { Option } = AntdSelect;

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
      [inputValue, sortComparator, sortSelectedFirst],
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
          (acc, group) => [...acc, ...group.options],
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
      return result.filter(opt => opt.value !== SELECT_ALL_VALUE);
    }, [selectOptions, selectValue]);

    const enabledOptions = useMemo(
      () => fullSelectOptions.filter(option => !option.disabled),
      [fullSelectOptions],
    );

    const selectAllEligible = useMemo(
      () =>
        fullSelectOptions.filter(
          option => hasOption(option.value, selectValue) || !option.disabled,
        ),
      [fullSelectOptions, selectValue],
    );

    const selectAllEnabled = useMemo(
      () =>
        !isSingleMode &&
        allowSelectAll &&
        selectOptions.length > 0 &&
        enabledOptions.length > 1 &&
        !inputValue,
      [
        isSingleMode,
        allowSelectAll,
        selectOptions.length,
        enabledOptions.length,
        inputValue,
      ],
    );

    const selectAllMode = useMemo(
      () => ensureIsArray(selectValue).length === selectAllEligible.length + 1,
      [selectValue, selectAllEligible],
    );

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
          if (value === getValue(SELECT_ALL_VALUE)) {
            if (isLabeledValue(selectedItem)) {
              return [
                ...selectAllEligible,
                selectAllOption,
              ] as AntdLabeledValue[];
            }
            return [
              SELECT_ALL_VALUE,
              ...selectAllEligible.map(opt => opt.value),
            ] as AntdLabeledValue[];
          }
          if (!hasOption(value, array)) {
            const result = [...array, selectedItem];
            if (
              result.length === selectAllEligible.length &&
              selectAllEnabled
            ) {
              return isLabeledValue(selectedItem)
                ? ([...result, selectAllOption] as AntdLabeledValue[])
                : ([...result, SELECT_ALL_VALUE] as (string | number)[]);
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
                ? { label: option.label, value: option.value }
                : option.value,
            ),
        );
      }
      fireOnChange();
    };

    const handleOnDeselect: SelectProps['onDeselect'] = (value, option) => {
      if (Array.isArray(selectValue)) {
        if (getValue(value) === getValue(SELECT_ALL_VALUE)) {
          clear();
        } else {
          let array = selectValue as AntdLabeledValue[];
          array = array.filter(
            element => getValue(element) !== getValue(value),
          );
          // if this was not a new item, deselect select all option
          if (selectAllMode && !option.isNewOption) {
            array = array.filter(
              element => getValue(element) !== SELECT_ALL_VALUE,
            );
          }
          setSelectValue(array);

          // removes new option
          if (option.isNewOption) {
            setSelectOptions(
              fullSelectOptions.filter(
                option => getValue(option.value) !== getValue(value),
              ),
            );
          }
        }
      }
      fireOnChange();
      onDeselect?.(value, option);
    };

    const handleOnSearch = debounce((search: string) => {
      const searchValue = search.trim();
      if (allowNewOptions) {
        const newOption = searchValue &&
          !hasOption(searchValue, fullSelectOptions, true) && {
            label: searchValue,
            value: searchValue,
            isNewOption: true,
          };
        const cleanSelectOptions = ensureIsArray(fullSelectOptions).filter(
          opt => !opt.isNewOption || hasOption(opt.value, selectValue),
        );
        const newOptions = newOption
          ? [newOption, ...cleanSelectOptions]
          : cleanSelectOptions;
        setSelectOptions(newOptions);
      }
      setInputValue(searchValue);
      onSearch?.(searchValue);
    }, FAST_DEBOUNCE);

    useEffect(() => () => handleOnSearch.cancel(), [handleOnSearch]);

    const handleFilterOption = (search: string, option: AntdLabeledValue) =>
      handleFilterOptionHelper(search, option, optionFilterProps, filterOption);

    const handleOnDropdownVisibleChange = (isDropdownVisible: boolean) => {
      setIsDropdownVisible(isDropdownVisible);

      // if no search input value, force sort options because it won't be sorted by
      // `filterSort`.
      if (isDropdownVisible && !inputValue && selectOptions.length > 1) {
        if (!isEqual(initialOptionsSorted, selectOptions)) {
          setSelectOptions(initialOptionsSorted);
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
    }, [initialOptions]);

    useEffect(() => {
      if (loading !== undefined && loading !== isLoading) {
        setIsLoading(loading);
      }
    }, [isLoading, loading]);

    useEffect(() => {
      setSelectValue(value);
    }, [value]);

    useEffect(() => {
      // if all values are selected, add select all to value
      if (
        selectAllEnabled &&
        ensureIsArray(value).length === selectAllEligible.length
      ) {
        setSelectValue(
          labelInValue
            ? ([...ensureIsArray(value), selectAllOption] as AntdLabeledValue[])
            : ([...ensureIsArray(value), SELECT_ALL_VALUE] as RawValue[]),
        );
      }
    }, [labelInValue, selectAllEligible.length, selectAllEnabled, value]);

    useEffect(() => {
      const checkSelectAll = ensureIsArray(selectValue).some(
        v => getValue(v) === SELECT_ALL_VALUE,
      );
      if (checkSelectAll && !selectAllMode) {
        const optionsToSelect = selectAllEligible.map(option =>
          labelInValue ? option : option.value,
        );
        optionsToSelect.push(labelInValue ? selectAllOption : SELECT_ALL_VALUE);
        setSelectValue(optionsToSelect);
        fireOnChange();
      }
    }, [
      selectValue,
      selectAllMode,
      labelInValue,
      selectAllEligible,
      fireOnChange,
    ]);

    const selectAllLabel = useMemo(
      () => () =>
        // TODO: localize
        `${SELECT_ALL_VALUE} (${formatNumber(
          NumberFormats.INTEGER,
          selectAllEligible.length,
        )})`,
      [selectAllEligible],
    );

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
            ensureIsArray(newValues).some(
              val => getValue(val) === SELECT_ALL_VALUE,
            )
          ) {
            // send all options to onchange if all are not currently there
            if (!selectAllMode) {
              newValues = mapValues(selectAllEligible, labelInValue);
              newOptions = mapOptions(selectAllEligible);
            } else {
              newValues = ensureIsArray(values).filter(
                (val: any) => getValue(val) !== SELECT_ALL_VALUE,
              );
            }
          } else if (
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

    const shouldRenderChildrenOptions = useMemo(
      () => selectAllEnabled || hasCustomLabels(options),
      [selectAllEnabled, options],
    );

    const omittedCount = useMemo(() => {
      const num_selected = ensureIsArray(selectValue).length;
      const num_shown = maxTagCount as number;
      return num_selected - num_shown - (selectAllMode ? 1 : 0);
    }, [maxTagCount, selectAllMode, selectValue]);

    const customMaxTagPlaceholder = () =>
      `+ ${omittedCount > 0 ? omittedCount : 1} ...`;

    // We can't remove the + tag so when Select All
    // is the only item omitted, we subtract one from maxTagCount
    let actualMaxTagCount = maxTagCount;
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
        const values = array
          .map(item => getPastedTextValue(item))
          .filter(item => item !== undefined);
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
      <StyledContainer headerPosition={headerPosition}>
        {header && (
          <StyledHeader headerPosition={headerPosition}>{header}</StyledHeader>
        )}
        <StyledSelect
          id={name}
          allowClear={!isLoading && allowClear}
          aria-label={ariaLabel}
          autoClearSearchValue={autoClearSearchValue}
          dropdownRender={dropdownRender}
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
          onDropdownVisibleChange={handleOnDropdownVisibleChange}
          // @ts-ignore
          onPaste={onPaste}
          onPopupScroll={undefined}
          onSearch={shouldShowSearch ? handleOnSearch : undefined}
          onSelect={handleOnSelect}
          onClear={handleClear}
          placeholder={placeholder}
          showSearch={shouldShowSearch}
          showArrow
          tokenSeparators={tokenSeparators}
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
          options={shouldRenderChildrenOptions ? undefined : fullSelectOptions}
          oneLine={oneLine}
          tagRender={customTagRender}
          {...props}
          ref={ref}
        >
          {selectAllEnabled && (
            <Option
              id="select-all"
              className="select-all"
              key={SELECT_ALL_VALUE}
              value={SELECT_ALL_VALUE}
            >
              {selectAllLabel()}
            </Option>
          )}
          {shouldRenderChildrenOptions &&
            renderSelectOptions(fullSelectOptions)}
        </StyledSelect>
      </StyledContainer>
    );
  },
);

export default Select;
