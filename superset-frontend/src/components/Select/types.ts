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
  JSXElementConstructor,
  ReactElement,
  ReactNode,
  RefObject,
} from 'react';
import {
  SelectProps as AntdSelectProps,
  SelectValue as AntdSelectValue,
  LabeledValue as AntdLabeledValue,
} from 'antd/lib/select';
import { TagProps } from 'antd/lib/tag';

export type RawValue = string | number;

export type V = string | number | null | undefined;

export type LabeledValue = { label?: ReactNode; value?: V };

export type AntdProps = AntdSelectProps<AntdSelectValue>;

export type AntdExposedProps = Pick<
  AntdProps,
  | 'allowClear'
  | 'autoClearSearchValue'
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

export type SelectOptionsType = Exclude<AntdProps['options'], undefined>;

export interface BaseSelectProps extends AntdExposedProps {
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
   * It changes the position of the header.
   */
  headerPosition?: 'top' | 'left';
  /**
   * It adds a helper text on top of the Select options
   * with additional context to help with the interaction.
   */
  helperText?: string;
  /**
   * It allows to define which properties of the option object
   * should be looked for when searching.
   * By default label and value.
   */
  mappedMode?: 'multiple' | 'tags';
  /**
   * It defines whether the Select should allow for the
   * selection of multiple options or single.
   * Single by default.
   */
  mode?: 'single' | 'multiple';
  /**
   * Deprecated.
   * Prefer ariaLabel instead.
   */
  name?: string; // discourage usage
  /**
   * It allows to define which properties of the option object
   * should be looked for when searching.
   * By default label and value.
   */
  optionFilterProps?: string[];
  /**
   * It shows a stop-outlined icon at the far right of a selected
   * option instead of the default checkmark.
   * Useful to better indicate to the user that by clicking on a selected
   * option it will be de-selected.
   * False by default.
   */
  invertSelection?: boolean;
  /**
   * Customize how filtered options are sorted while users search.
   * Will not apply to predefined `options` array when users are not searching.
   */
  sortComparator?: (
    a: AntdLabeledValue,
    b: AntdLabeledValue,
    search?: string,
  ) => number;
  /**
   * Sets maxTagCount to 1. The overflow tag is always displayed in
   * the same line, line wrapping is disabled.
   * When the dropdown is open, sets maxTagCount to 0,
   * displays only the overflow tag.
   */
  oneLine?: boolean;

  suffixIcon?: ReactNode;

  ref: RefObject<HTMLInputElement>;
}

export interface SelectProps extends BaseSelectProps {
  /**
   * It enables the user to select all options.
   * True by default.
   * */
  allowSelectAll?: boolean;
  /**
   * It defines the options of the Select.
   * The options can be static, an array of options.
   */
  options: SelectOptionsType;
}

export type AsyncSelectRef = HTMLInputElement & { clearCache: () => void };

export type SelectOptionsTypePage = {
  data: SelectOptionsType;
  totalCount: number;
};

export type SelectOptionsPagePromise = (
  search: string,
  page: number,
  pageSize: number,
) => Promise<SelectOptionsTypePage>;

export interface AsyncSelectProps extends BaseSelectProps {
  /**
   * It fires a request against the server after
   * the first interaction and not on render.
   * Works in async mode only (See the options property).
   * True by default.
   */
  lazyLoading?: boolean;
  /**
   * It defines the options of the Select.
   * The options are async, a promise that returns
   * an array of options.
   */
  options: SelectOptionsPagePromise;
  /**
   * It defines how many results should be included
   * in the query response.
   * Works in async mode only (See the options property).
   */
  pageSize?: number;
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
}

export type CustomTagProps = HTMLSpanElement &
  TagProps & {
    label: ReactNode;
    value: string;
  };
