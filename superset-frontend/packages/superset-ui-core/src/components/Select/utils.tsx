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
import { ensureIsArray, t } from '@superset-ui/core';
import { ReactElement, RefObject } from 'react';
import { Icons } from '@superset-ui/core/components/Icons';
import { LabeledValue as AntdLabeledValue, SELECT_ALL_VALUE } from '.';
import { StyledHelperText, StyledLoadingText, StyledSpin } from './styles';
import { CustomLabeledValue, RawValue, SelectOptionsType, V } from './types';

export function isObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray(value) === false
  );
}

export function isLabeledValue(value: unknown): value is AntdLabeledValue {
  return isObject(value) && 'value' in value && 'label' in value;
}

export function getValue(
  option: string | number | AntdLabeledValue | null | undefined,
) {
  return isLabeledValue(option) ? option.value : option;
}

export function isEqual(
  a: V | CustomLabeledValue,
  b: V | CustomLabeledValue,
  key: string,
) {
  const actualA =
    isObject(a) && key in a ? a[key as keyof CustomLabeledValue] : a;
  const actualB =
    isObject(b) && key in b ? b[key as keyof CustomLabeledValue] : b;
  // When comparing the values we use the equality
  // operator to automatically convert different types
  // eslint-disable-next-line eqeqeq
  return actualA == actualB;
}

export function getOption(
  value: V,
  options?: V | CustomLabeledValue | (V | CustomLabeledValue)[],
  checkLabel = false,
): V | CustomLabeledValue {
  const optionsArray = ensureIsArray(options);
  return optionsArray.find(
    x =>
      isEqual(x, value, 'value') || (checkLabel && isEqual(x, value, 'label')),
  );
}

export function hasOption(
  value: V,
  options?: V | CustomLabeledValue | (V | CustomLabeledValue)[],
  checkLabel = false,
): boolean {
  return getOption(value, options, checkLabel) !== undefined;
}

/**
 * It creates a comparator to check for a specific property.
 * Can be used with string and number property values.
 * */
export const propertyComparator =
  (property: string) => (a: AntdLabeledValue, b: AntdLabeledValue) => {
    const propertyA = a[property as keyof CustomLabeledValue];
    const propertyB = b[property as keyof CustomLabeledValue];
    if (typeof propertyA === 'string' && typeof propertyB === 'string') {
      return propertyA.localeCompare(propertyB);
    }
    if (typeof propertyA === 'number' && typeof propertyB === 'number') {
      return propertyA - propertyB;
    }
    return String(propertyA).localeCompare(String(propertyB)); // fallback to string comparison
  };

export const sortSelectedFirstHelper = (
  a: AntdLabeledValue,
  b: AntdLabeledValue,
  selectValue:
    | string
    | number
    | RawValue[]
    | AntdLabeledValue
    | AntdLabeledValue[]
    | undefined
    | null,
) => {
  if (a.value === SELECT_ALL_VALUE) return -1;
  if (b.value === SELECT_ALL_VALUE) return 1;
  return selectValue && a.value !== undefined && b.value !== undefined
    ? Number(hasOption(b.value, selectValue)) -
        Number(hasOption(a.value, selectValue))
    : 0;
};

export const sortComparatorWithSearchHelper = (
  a: AntdLabeledValue,
  b: AntdLabeledValue,
  inputValue: string,
  sortCallback: (a: AntdLabeledValue, b: AntdLabeledValue) => number,
  sortComparator: (
    a: AntdLabeledValue,
    b: AntdLabeledValue,
    search?: string | undefined,
  ) => number,
) => sortCallback(a, b) || sortComparator(a, b, inputValue);

export const sortComparatorForNoSearchHelper = (
  a: AntdLabeledValue,
  b: AntdLabeledValue,
  sortCallback: (a: AntdLabeledValue, b: AntdLabeledValue) => number,
  sortComparator: (
    a: AntdLabeledValue,
    b: AntdLabeledValue,
    search?: string | undefined,
  ) => number,
) => sortCallback(a, b) || sortComparator(a, b, '');

// use a function instead of component since every rerender of the
// Select component will create a new component
export const getSuffixIcon = (
  isLoading: boolean | undefined,
  showSearch: boolean,
  isDropdownVisible: boolean,
) => {
  if (isLoading) {
    return <StyledSpin size="small" />;
  }
  if (showSearch && isDropdownVisible) {
    return <Icons.SearchOutlined iconSize="s" />;
  }
  return <Icons.DownOutlined iconSize="s" aria-label="down" />;
};

export const dropDownRenderHelper = (
  originNode: ReactElement & { ref?: RefObject<HTMLElement> },
  isDropdownVisible: boolean,
  isLoading: boolean | undefined,
  optionsLength: number,
  helperText: string | undefined,
  errorComponent?: JSX.Element,
  bulkSelectComponents?: JSX.Element,
) => {
  if (!isDropdownVisible) {
    originNode.ref?.current?.scrollTo({ top: 0 });
  }
  if (isLoading && optionsLength === 0) {
    return <StyledLoadingText>{t('Loading...')}</StyledLoadingText>;
  }
  if (errorComponent) {
    return errorComponent;
  }

  // remap for accessibility for proper item count
  const accessibilityNode = {
    ...originNode,
    props: {
      ...originNode.props,
      flattenOptions: ensureIsArray(originNode.props.flattenOptions).map(
        (opt: Record<string, any>, idx: number) => ({
          ...opt,
          data: {
            ...opt.data,
            'aria-setsize': originNode.props.flattenOptions?.length || 0,
            'aria-posinset': idx + 1,
          },
        }),
      ),
    },
  };

  return (
    <>
      {helperText && (
        <StyledHelperText role="note">{helperText}</StyledHelperText>
      )}
      {accessibilityNode}
      {bulkSelectComponents}
    </>
  );
};

export const handleFilterOptionHelper = (
  search: string,
  option: AntdLabeledValue,
  optionFilterProps: string[],
  filterOption: boolean | Function,
) => {
  if (typeof filterOption === 'function') {
    return filterOption(search, option);
  }

  if (filterOption) {
    const searchValue = search.trim().toLowerCase();
    if (optionFilterProps?.length) {
      return optionFilterProps.some(prop => {
        const optionProp = option?.[prop as keyof CustomLabeledValue]
          ? String(option[prop as keyof CustomLabeledValue])
              .trim()
              .toLowerCase()
          : '';
        return optionProp.includes(searchValue);
      });
    }
  }

  return false;
};

export const mapValues = (
  values: SelectOptionsType,
  labelInValue: boolean,
): (Record<string, any> | any)[] =>
  labelInValue
    ? values.map(opt => ({
        key: opt.value,
        value: opt.value,
        label: opt.label,
      }))
    : values.map(opt => opt.value);

export const mapOptions = (values: SelectOptionsType): Record<string, any>[] =>
  values.map(opt => ({
    children: opt.label,
    key: opt.value,
    ...opt,
  }));
