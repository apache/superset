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
import { ReactNode } from 'react';
import { ensureIsArray } from '@superset-ui/core';
import {
  OptionTypeBase,
  ValueType,
  OptionsType,
  GroupedOptionsType,
} from 'react-select';
import { LabeledValue as AntdLabeledValue } from 'antd/lib/select';

export function isObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray(value) === false
  );
}

/**
 * Find Option value that matches a possibly string value.
 *
 * Translate possible string values to `OptionType` objects, fallback to value
 * itself if cannot be found in the options list.
 *
 * Always returns an array.
 */
export function findValue<OptionType extends OptionTypeBase>(
  value: ValueType<OptionType> | string,
  options: GroupedOptionsType<OptionType> | OptionsType<OptionType> = [],
  valueKey = 'value',
): OptionType[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }
  const isGroup = Array.isArray((options[0] || {}).options);
  const flatOptions = isGroup
    ? (options as GroupedOptionsType<OptionType>).flatMap(x => x.options || [])
    : (options as OptionsType<OptionType>);

  const find = (val: OptionType) => {
    const realVal = (value || {}).hasOwnProperty(valueKey)
      ? val[valueKey]
      : val;
    return (
      flatOptions.find(x => x === realVal || x[valueKey] === realVal) || val
    );
  };

  // If value is a single string, must return an Array so `cleanValue` won't be
  // empty: https://github.com/JedWatson/react-select/blob/32ad5c040bdd96cd1ca71010c2558842d684629c/packages/react-select/src/utils.js#L64
  return (Array.isArray(value) ? value : [value]).map(find);
}

export function isLabeledValue(value: unknown): value is AntdLabeledValue {
  return isObject(value) && 'value' in value && 'label' in value;
}

export function getValue(
  option: string | number | AntdLabeledValue | null | undefined,
) {
  return isLabeledValue(option) ? option.value : option;
}

type LabeledValue<V> = { label?: ReactNode; value?: V };

export function hasOption<V>(
  value: V,
  options?: V | LabeledValue<V> | (V | LabeledValue<V>)[],
  checkLabel = false,
): boolean {
  const optionsArray = ensureIsArray(options);
  return (
    optionsArray.find(
      x =>
        x === value ||
        (isObject(x) &&
          (('value' in x && x.value === value) ||
            (checkLabel && 'label' in x && x.label === value))),
    ) !== undefined
  );
}
