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
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { isEqualArray } from '@superset-ui/core';
import { t } from '@apache-superset/core';
import { css } from '@apache-superset/core/ui';
import { Select } from '@superset-ui/core/components';
import ControlHeader from 'src/explore/components/ControlHeader';

type SelectValue = string | number | (string | number)[] | null | undefined;

interface SelectOption {
  value: string | number;
  label: string;
  [key: string]: unknown;
}

export interface SelectControlProps {
  ariaLabel?: string;
  autoFocus?: boolean;
  choices?: [string | number, string][];
  clearable?: boolean;
  description?: string | ReactNode;
  disabled?: boolean;
  freeForm?: boolean;
  isLoading?: boolean;
  mode?: string;
  multi?: boolean;
  isMulti?: boolean;
  name: string;
  onChange?: (value: SelectValue, options?: unknown[]) => void;
  onFocus?: () => void;
  onSelect?: (value: SelectValue) => void;
  onDeselect?: (value: SelectValue) => void;
  value?: SelectValue;
  default?: SelectValue;
  showHeader?: boolean;
  optionRenderer?: (option: unknown) => ReactNode;
  valueKey?: string;
  options?: { value: string | number; label: string; [key: string]: unknown }[];
  placeholder?: string;
  filterOption?: (input: unknown, option: unknown) => boolean;
  tokenSeparators?: string[];
  notFoundContent?: ReactNode;
  label?: string;
  renderTrigger?: boolean;
  validationErrors?: string[];
  rightNode?: ReactNode;
  leftNode?: ReactNode;
  onClick?: () => void;
  hovered?: boolean;
  tooltipOnClick?: () => void;
  warning?: string;
  danger?: string;
  sortComparator?: (a: SelectOption, b: SelectOption) => number;
}

const numberComparator = (a: SelectOption, b: SelectOption): number =>
  (a.value as number) - (b.value as number);

export const areAllValuesNumbers = (
  items: unknown[],
  valueKey = 'value',
): boolean => {
  if (!items || items.length === 0) {
    return false;
  }
  return items.every(item => {
    if (Array.isArray(item)) {
      const [value] = item;
      return typeof value === 'number';
    }
    if (typeof item === 'object' && item !== null) {
      return typeof (item as Record<string, unknown>)[valueKey] === 'number';
    }
    return typeof item === 'number';
  });
};

type SortComparator =
  | ((a: SelectOption, b: SelectOption) => number)
  | undefined;

export const getSortComparator = (
  choices: unknown[] | undefined,
  options: unknown[] | undefined,
  valueKey: string | undefined,
  explicitComparator: SortComparator,
): SortComparator => {
  if (explicitComparator) {
    return explicitComparator;
  }

  if (
    (options && areAllValuesNumbers(options, valueKey)) ||
    (choices && areAllValuesNumbers(choices, valueKey))
  ) {
    return numberComparator;
  }

  return undefined;
};

export const innerGetOptions = (props: SelectControlProps): SelectOption[] => {
  const { choices, optionRenderer, valueKey = 'value' } = props;
  let selectOptions: SelectOption[] = [];
  if (props.options) {
    selectOptions = props.options.map(o => ({
      ...o,
      value: o[valueKey] as string | number,
      label: optionRenderer
        ? (optionRenderer(o) as string)
        : ((o.label || o[valueKey]) as string),
    }));
  } else if (choices) {
    // Accepts different formats of input
    selectOptions = choices.map(c => {
      if (Array.isArray(c)) {
        const [value, label] = c.length > 1 ? c : [c[0], c[0]];
        return {
          value,
          label: String(label),
        };
      }
      // This branch handles object-like choices, but choices are typed as tuples
      return { value: c as unknown as string | number, label: String(c) };
    });
  }
  return selectOptions;
};

function SelectControl({
  ariaLabel,
  autoFocus = false,
  choices = [],
  clearable = true,
  description = null,
  disabled = false,
  freeForm = false,
  isLoading = false,
  mode,
  multi = false,
  isMulti,
  name,
  onChange = () => {},
  onFocus = () => {},
  onSelect,
  onDeselect,
  value,
  default: defaultValue,
  showHeader = true,
  optionRenderer,
  valueKey = 'value',
  options: optionsProp,
  placeholder,
  filterOption,
  tokenSeparators,
  notFoundContent,
  label = undefined,
  renderTrigger,
  validationErrors,
  rightNode,
  leftNode,
  onClick,
  hovered,
  tooltipOnClick,
  warning,
  danger,
  sortComparator,
}: SelectControlProps) {
  const [options, setOptions] = useState<SelectOption[]>(() =>
    innerGetOptions({
      choices,
      optionRenderer,
      valueKey,
      options: optionsProp,
      name,
    }),
  );

  // Track previous choices/options for comparison
  const prevChoicesRef = useRef(choices);
  const prevOptionsRef = useRef(optionsProp);

  useEffect(() => {
    if (
      !isEqualArray(choices, prevChoicesRef.current) ||
      !isEqualArray(optionsProp, prevOptionsRef.current)
    ) {
      const newOptions = innerGetOptions({
        choices,
        optionRenderer,
        valueKey,
        options: optionsProp,
        name,
      });
      setOptions(newOptions);
      prevChoicesRef.current = choices;
      prevOptionsRef.current = optionsProp;
    }
  }, [choices, optionsProp, optionRenderer, valueKey, name]);

  // Beware: This is acting like an on-click instead of an on-change
  // (firing every time user chooses vs firing only if a new option is chosen).
  const handleChange = useCallback(
    (val: SelectValue | SelectOption | SelectOption[]) => {
      // will eventually call `exploreReducer`: SET_FIELD_VALUE
      let onChangeVal: SelectValue = val as SelectValue;

      if (Array.isArray(val)) {
        const values = val.map(v =>
          typeof v === 'object' &&
          v !== null &&
          (v as SelectOption)[valueKey] !== undefined
            ? (v as SelectOption)[valueKey]
            : v,
        );
        onChangeVal = values as (string | number)[];
      }
      if (
        typeof val === 'object' &&
        val !== null &&
        !Array.isArray(val) &&
        (val as SelectOption)[valueKey] !== undefined
      ) {
        onChangeVal = (val as SelectOption)[valueKey] as string | number;
      }
      onChange?.(onChangeVal, []);
    },
    [onChange, valueKey],
  );

  const handleFilterOptions = useCallback(
    (text: string, option: SelectOption) =>
      filterOption?.({ data: option }, text) ?? true,
    [filterOption],
  );

  const headerProps = useMemo(
    () => ({
      name,
      label,
      description,
      renderTrigger,
      rightNode,
      leftNode,
      validationErrors,
      onClick,
      hovered,
      tooltipOnClick,
      warning,
      danger,
    }),
    [
      name,
      label,
      description,
      renderTrigger,
      rightNode,
      leftNode,
      validationErrors,
      onClick,
      hovered,
      tooltipOnClick,
      warning,
      danger,
    ],
  );

  const getValue = useCallback(() => {
    const currentValue =
      value ?? (defaultValue !== undefined ? defaultValue : undefined);

    // safety check - the value is intended to be undefined but null was used
    if (currentValue === null && !options.find(o => o.value === null)) {
      return undefined;
    }
    return currentValue;
  }, [value, defaultValue, options]);

  const computedSortComparator = useMemo(
    () => getSortComparator(choices, optionsProp, valueKey, sortComparator),
    [choices, optionsProp, valueKey, sortComparator],
  );

  const selectProps = useMemo(
    () => ({
      allowNewOptions: freeForm,
      autoFocus,
      ariaLabel:
        ariaLabel || (typeof label === 'string' ? label : t('Select ...')),
      allowClear: clearable,
      disabled,
      filterOption:
        filterOption && typeof filterOption === 'function'
          ? handleFilterOptions
          : true,
      header: showHeader && <ControlHeader {...headerProps} />,
      loading: isLoading,
      mode: mode || (isMulti || multi ? 'multiple' : 'single'),
      name: `select-${name}`,
      onChange: handleChange,
      onFocus,
      onSelect,
      onDeselect,
      options,
      placeholder,
      sortComparator: computedSortComparator,
      value: getValue(),
      tokenSeparators,
      notFoundContent,
    }),
    [
      freeForm,
      autoFocus,
      ariaLabel,
      label,
      clearable,
      disabled,
      filterOption,
      handleFilterOptions,
      showHeader,
      headerProps,
      isLoading,
      mode,
      isMulti,
      multi,
      name,
      handleChange,
      onFocus,
      onSelect,
      onDeselect,
      options,
      placeholder,
      computedSortComparator,
      getValue,
      tokenSeparators,
      notFoundContent,
    ],
  );

  return (
    <div
      css={theme => css`
        .type-label {
          margin-right: ${theme.sizeUnit * 2}px;
        }
        .Select__multi-value__label > span,
        .Select__option > span,
        .Select__single-value > span {
          display: flex;
          align-items: center;
        }
      `}
    >
      <Select {...(selectProps as Parameters<typeof Select>[0])} />
    </div>
  );
}

export default SelectControl;
