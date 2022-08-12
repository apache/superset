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
import { styled, t } from '@superset-ui/core';
import { Spin } from 'antd';
import Icons from 'src/components/Icons';
import AntdSelect, {
  SelectProps as AntdSelectProps,
  SelectValue as AntdSelectValue,
  LabeledValue as AntdLabeledValue,
} from 'antd/lib/select';
import { rankedSearchCompare } from 'src/utils/rankedSearchCompare';
import React, {
  forwardRef,
  ReactElement,
  ReactNode,
  RefObject,
  JSXElementConstructor,
} from 'react';

const { Option } = AntdSelect;

export type AntdSelectAllProps = AntdSelectProps<AntdSelectValue>;

export type PickedSelectProps = Pick<
  AntdSelectAllProps,
  | 'allowClear'
  | 'autoFocus'
  | 'disabled'
  | 'filterOption'
  | 'filterSort'
  | 'loading'
  | 'labelInValue'
  | 'maxTagCount'
  | 'notFoundContent'
  | 'onChange'
  | 'onClear'
  | 'onDeselect'
  | 'onSelect'
  | 'onFocus'
  | 'onBlur'
  | 'onPopupScroll'
  | 'onSearch'
  | 'onDropdownVisibleChange'
  | 'placeholder'
  | 'showArrow'
  | 'showSearch'
  | 'tokenSeparators'
  | 'value'
  | 'getPopupContainer'
  | 'menuItemSelectedIcon'
>;

export type SelectOptionsType = Exclude<
  AntdSelectAllProps['options'],
  undefined
>;

export type SelectOptionsTypePage = {
  data: SelectOptionsType;
  totalCount: number;
};

export type SelectOptionsPagePromise = (
  search: string,
  page: number,
  pageSize: number,
) => Promise<SelectOptionsTypePage>;

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

export const StyledSelect = styled(AntdSelect)`
  ${({ theme }) => `
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

export const StyledStopOutlined = styled(Icons.StopOutlined)`
  vertical-align: 0;
`;

export const StyledCheckOutlined = styled(Icons.CheckOutlined)`
  vertical-align: 0;
`;

export const StyledError = styled.div`
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

export const StyledErrorMessage = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const StyledSpin = styled(Spin)`
  margin-top: ${({ theme }) => -theme.gridUnit}px;
`;

export const StyledLoadingText = styled.div`
  ${({ theme }) => `
    margin-left: ${theme.gridUnit * 3}px;
    line-height: ${theme.gridUnit * 8}px;
    color: ${theme.colors.grayscale.light1};
  `}
`;

export const MAX_TAG_COUNT = 4;
export const TOKEN_SEPARATORS = [',', '\n', '\t', ';'];
export const DEFAULT_PAGE_SIZE = 100;
export const EMPTY_OPTIONS: SelectOptionsType = [];

export const DEFAULT_SORT_COMPARATOR = (
  a: AntdLabeledValue,
  b: AntdLabeledValue,
  search?: string,
) => {
  let aText: string | undefined;
  let bText: string | undefined;
  if (typeof a.label === 'string' && typeof b.label === 'string') {
    aText = a.label;
    bText = b.label;
  } else if (typeof a.value === 'string' && typeof b.value === 'string') {
    aText = a.value;
    bText = b.value;
  }
  // sort selected options first
  if (typeof aText === 'string' && typeof bText === 'string') {
    if (search) {
      return rankedSearchCompare(aText, bText, search);
    }
    return aText.localeCompare(bText);
  }
  return (a.value as number) - (b.value as number);
};

/**
 * It creates a comparator to check for a specific property.
 * Can be used with string and number property values.
 * */
export const propertyComparator =
  (property: string) => (a: AntdLabeledValue, b: AntdLabeledValue) => {
    if (typeof a[property] === 'string' && typeof b[property] === 'string') {
      return a[property].localeCompare(b[property]);
    }
    return (a[property] as number) - (b[property] as number);
  };

export interface BaseSelectProps extends PickedSelectProps {
  /**
   * It enables the user to create new options.
   * Can be used with standard or async select types.
   * Can be used with any mode, single or multiple.
   * False by default.
   * */
  allowNewOptions?: boolean;
  /**
   * It adds the aria-label tag for accessibility standards.
   * Must be plain English and localized.
   */
  ariaLabel?: string;
  /**
   * Renders the dropdown
   */
  dropdownRender?: (
    menu: ReactElement<any, string | JSXElementConstructor<any>>,
  ) => ReactElement<any, string | JSXElementConstructor<any>>;
  /**
   * It adds a header on top of the Select.
   * Can be any ReactNode.
   */
  header?: ReactNode;
  /**
   * It fires a request against the server after
   * the first interaction and not on render.
   * Works in async mode only (See the options property).
   * True by default.
   */
  lazyLoading?: boolean;
  /**
   * It allows to define which properties of the option object
   * should be looked for when searching.
   * By default label and value.
   */
  mappedMode?: 'multiple' | 'tags';
  /**
   * It allows to define which properties of the option object
   * should be looked for when searching.
   * By default label and value.
   */
  optionFilterProps?: string[];
  /**
   * It defines the options of the Select.
   * The options are async, a promise that returns
   * an array of options.
   */
  options: SelectOptionsType;
  /**
   * It defines how many results should be included
   * in the query response.
   * Works in async mode only (See the options property).
   */
  pageSize?: number;
  /**
   * It shows a stop-outlined icon at the far right of a selected
   * option instead of the default checkmark.
   * Useful to better indicate to the user that by clicking on a selected
   * option it will be de-selected.
   * False by default.
   */
  invertSelection?: boolean;
  /**
   * It fires a request against the server only after
   * searching.
   * Works in async mode only (See the options property).
   * Undefined by default.
   */
  fetchOnlyOnSearch?: boolean;
  /**
   * It provides a callback function when an error
   * is generated after a request is fired.
   * Works in async mode only (See the options property).
   */
  onError?: (error: string) => void;
  /**
   * Customize how filtered options are sorted while users search.
   * Will not apply to predefined `options` array when users are not searching.
   */
  sortComparator?: typeof DEFAULT_SORT_COMPARATOR;

  suffixIcon?: ReactNode;

  ref: RefObject<HTMLInputElement>;
}

export const BaseSelect = ({
  allowClear,
  allowNewOptions = false,
  ariaLabel,
  dropdownRender,
  fetchOnlyOnSearch,
  filterOption = true,
  filterSort,
  header = null,
  invertSelection = false,
  lazyLoading = true,
  labelInValue = false,
  loading,
  mappedMode,
  notFoundContent,
  onError,
  onChange,
  onClear,
  onDeselect,
  onSelect,
  onDropdownVisibleChange,
  onPopupScroll,
  onSearch,
  optionFilterProps = ['label', 'value'],
  options,
  pageSize = DEFAULT_PAGE_SIZE,
  placeholder = t('Select ...'),
  showSearch = true,
  sortComparator = DEFAULT_SORT_COMPARATOR,
  suffixIcon,
  tokenSeparators,
  value,
  getPopupContainer,
  menuItemSelectedIcon,
  maxTagCount,
  ref,
  ...props
}: BaseSelectProps) => {
  const hasCustomLabels = options?.some(opt => !!opt?.customLabel);

  return (
    <StyledContainer>
      {header}
      <StyledSelect
        allowClear={allowClear}
        aria-label={ariaLabel}
        dropdownRender={dropdownRender}
        filterOption={filterOption}
        filterSort={filterSort}
        getPopupContainer={getPopupContainer}
        labelInValue
        maxTagCount={maxTagCount}
        mode={mappedMode}
        notFoundContent={notFoundContent}
        onDeselect={onDeselect}
        onDropdownVisibleChange={onDropdownVisibleChange}
        onPopupScroll={onPopupScroll}
        onSearch={onSearch}
        onSelect={onSelect}
        onClear={onClear}
        onChange={onChange}
        options={hasCustomLabels ? undefined : options}
        placeholder={placeholder}
        showSearch={showSearch}
        showArrow
        tokenSeparators={tokenSeparators}
        value={value}
        suffixIcon={suffixIcon}
        menuItemSelectedIcon={menuItemSelectedIcon}
        ref={ref}
        {...props}
      >
        {hasCustomLabels &&
          options.map(opt => {
            const isOptObject = typeof opt === 'object';
            const label = isOptObject ? opt?.label || opt.value : opt;
            const value = isOptObject ? opt.value : opt;
            const { customLabel, ...optProps } = opt;
            return (
              <Option {...optProps} key={value} label={label} value={value}>
                {isOptObject && customLabel ? customLabel : label}
              </Option>
            );
          })}
      </StyledSelect>
    </StyledContainer>
  );
};

export default forwardRef(BaseSelect);
