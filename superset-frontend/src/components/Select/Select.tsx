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
  Ref,
} from 'react';

import {
  ensureIsArray,
  formatNumber,
  NumberFormats,
  t,
  usePrevious,
} from '@superset-ui/core';
import {
  LabeledValue as AntdLabeledValue,
  RefSelectProps,
} from 'antd-v5/es/select';
import { LabeledValue } from 'antd-v5/lib/select';
import {
  getValue,
  hasOption,
  isLabeledValue,
  SELECT_ALL_VALUE,
  selectAllOption,
  mapValues,
  mapOptions,
  hasCustomLabels,
  isEqual as utilsIsEqual,
  handleFilterOptionHelper,
} from './utils';
import { RawValue, SelectOptionsType, SelectProps } from './types';
import {
  StyledCheckOutlined,
  StyledContainer,
  StyledHeader,
  StyledSelect,
  StyledStopOutlined,
} from './styles';
import { MAX_TAG_COUNT, TOKEN_SEPARATORS } from './constants';
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
      header = null,
      headerPosition = 'top',
      invertSelection = false,
      labelInValue = false,
      loading,
      mode = 'single',
      name,
      notFoundContent,
      onBlur,
      onChange,
      onClear,
      onDeselect,
      onSelect,
      options,
      placeholder = t('Select ...'),
      showSearch = true,
      tokenSeparators = TOKEN_SEPARATORS,
      value,
      getPopupContainer,
      oneLine,
      ...props
    }: SelectProps,
    ref: RefObject<RefSelectProps>,
  ) => {
    const isSingleMode = mode === 'single';
    const shouldShowSearch = allowNewOptions ? true : showSearch;
    const [selectValue, setSelectValue] = useState(value);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(loading);
    const [onChangeCount, setOnChangeCount] = useState(0);
    const previousChangeCount = usePrevious(onChangeCount, 0);

    const fireOnChange = useCallback(
      () => setOnChangeCount(onChangeCount + 1),
      [onChangeCount],
    );

    const mappedMode = allowNewOptions
      ? 'tags'
      : isSingleMode
        ? undefined
        : 'multiple';

    const [selectOptions, setSelectOptions] =
      useState<SelectOptionsType>(options);

    const enabledOptions = useMemo(
      () => options.filter(option => !option.disabled),
      [options],
    );

    const selectAllEligible = useMemo(
      () =>
        options.filter(
          option => hasOption(option.value, selectValue) || !option.disabled,
        ),
      [options, selectValue],
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
            ] as unknown as AntdLabeledValue[];
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
          options
            .filter(
              option => option.disabled && hasOption(option.value, selectValue),
            )
            .map(option =>
              labelInValue
                ? ({
                    label: option.label,
                    value: option.value,
                  } as unknown as RawValue) // TODO: @msyavuz Type these properly
                : (option.value as unknown as RawValue),
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
              options.filter(
                option => getValue(option.value) !== getValue(value),
              ),
            );
          }
        }
      }
      fireOnChange();
      onDeselect?.(value, option);
    };

    const handleClear = () => {
      clear();
      if (onClear) {
        onClear();
      }
    };

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
        setSelectValue(optionsToSelect as unknown as RawValue);
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
        if (isSingleMode) {
          handleOnChange(selectValue, selectValue ? options[0] : undefined);
        } else {
          handleOnChange(array, options);
        }
      }
    }, [
      options,
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

    const getOptions = useMemo(() => {
      let opts = shouldRenderChildrenOptions ? options : [];
      if (selectAllEnabled) {
        opts = [
          {
            label: selectAllLabel(),
            className: 'select-all',
            value: SELECT_ALL_VALUE,
          },
          ...options,
        ];
      }

      return opts;
    }, [
      options,
      selectAllEnabled,
      selectAllLabel,
      shouldRenderChildrenOptions,
    ]);

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
          filterOption={(input, option) => {
            if (option?.value === SELECT_ALL_VALUE) {
              return false;
            }
            return handleFilterOptionHelper(
              input,
              option as LabeledValue,
              ['label'],
              true,
            );
          }}
          getPopupContainer={
            getPopupContainer || (triggerNode => triggerNode.parentNode)
          }
          headerPosition={headerPosition}
          labelInValue={labelInValue}
          maxTagCount={MAX_TAG_COUNT}
          mode={mappedMode}
          notFoundContent={isLoading ? t('Loading...') : notFoundContent}
          onBlur={handleOnBlur}
          onDeselect={handleOnDeselect}
          onPopupScroll={undefined}
          onSelect={handleOnSelect}
          onClear={handleClear}
          placeholder={placeholder}
          showSearch={shouldShowSearch}
          tokenSeparators={tokenSeparators}
          value={selectValue}
          menuItemSelectedIcon={
            invertSelection ? (
              <StyledStopOutlined iconSize="m" aria-label="stop" />
            ) : (
              <StyledCheckOutlined iconSize="m" aria-label="check" />
            )
          }
          options={getOptions}
          oneLine={oneLine}
          tagRender={customTagRender}
          css={props.css}
          {...props}
          ref={ref as unknown as Ref<RefSelectProps>}
        />
      </StyledContainer>
    );
  },
);

export default Select;
