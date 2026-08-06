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
import { t, tn } from '@apache-superset/core/translation';
import {
  ensureIsArray,
  ExtraFormData,
  TimeGranularity,
} from '@superset-ui/core';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ReactReduxContext } from 'react-redux';
import {
  FormItem,
  type FormItemProps,
  Select,
} from '@superset-ui/core/components';
import { FilterPluginStyle, StatusMessage } from '../common';
import { PluginFilterTimeGrainProps } from './types';

export default function PluginFilterTimegrain(
  props: PluginFilterTimeGrainProps,
) {
  const {
    data,
    formData,
    height,
    width,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    filterState,
    inputRef,
  } = props;
  const { defaultValue } = formData;

  const reduxContext = useContext(ReactReduxContext);
  const dashboardTimeGrainAllowlist: string[] | undefined =
    reduxContext?.store?.getState?.()?.dashboardInfo?.metadata
      ?.time_grain_allowlist;

  const [value, setValue] = useState<string[]>(defaultValue ?? []);
  const durationMap = useMemo(
    () =>
      data.reduce(
        (agg, { duration, name }: { duration: string; name: string }) => ({
          ...agg,
          [duration]: name,
        }),
        {} as { [key in string]: string },
      ),
    [JSON.stringify(data)],
  );

  const handleChange = useCallback(
    (values: string[] | string | undefined | null) => {
      const resultValue: string[] = ensureIsArray<string>(values);
      const [timeGrain] = resultValue;
      const label = timeGrain ? durationMap[timeGrain] : undefined;

      const extraFormData: ExtraFormData = {};
      if (timeGrain) {
        extraFormData.time_grain_sqla = timeGrain as TimeGranularity;
      }
      setValue(resultValue);
      setDataMask({
        extraFormData,
        filterState: {
          label,
          value: resultValue.length ? resultValue : null,
        },
      });
    },
    [durationMap, setDataMask],
  );

  const formItemData: FormItemProps = {};
  if (filterState.validateMessage) {
    formItemData.extra = (
      <StatusMessage status={filterState.validateStatus}>
        {filterState.validateMessage}
      </StatusMessage>
    );
  }

  const options = useMemo(() => {
    const allOptions = (data || [])
      .map((row: { name: string; duration: string }) => {
        const { name, duration } = row;
        return {
          label: name,
          value: duration,
        };
      });

    const allowlist =
      dashboardTimeGrainAllowlist?.length > 0
        ? dashboardTimeGrainAllowlist
        : formData.timeGrains;

    if (!allowlist || allowlist.length === 0) {
      return allOptions;
    }

    const allowedSet = new Set(allowlist);
    return allOptions.filter(option => allowedSet.has(option.value) || value.includes(option.value));
  }, [data, dashboardTimeGrainAllowlist, formData.timeGrains, JSON.stringify(value)]);

  const validValue = useMemo(() => {
    if (options.length === 0) return [];
    const optionValues = new Set(options.map(o => o.value));
    return value.filter(v => optionValues.has(v));
  }, [value, options]);

  const hasInitRef = useRef(false);
  useEffect(() => {
    if (hasInitRef.current) return;
    if (options.length === 0) return;

    const optionValues = new Set(options.map(o => o.value));
    const target = ensureIsArray<string>(defaultValue).filter(v =>
      optionValues.has(v),
    );

    hasInitRef.current = true;

    if (value.length > 0) return;
    if (target.length > 0) {
      handleChange(target);
    }
  }, [options, defaultValue, handleChange]);

  const placeholderText =
    options.length === 0
      ? t('No data')
      : tn('%s option', '%s options', options.length, options.length);

  return (
    <FilterPluginStyle height={height} width={width}>
      <FormItem validateStatus={filterState.validateStatus} {...formItemData}>
        <Select
          name={formData.nativeFilterId}
          allowClear
          value={validValue}
          placeholder={placeholderText}
          // @ts-expect-error
          onChange={handleChange}
          onBlur={unsetFocusedFilter}
          onFocus={setFocusedFilter}
          onMouseEnter={setHoveredFilter}
          onMouseLeave={unsetHoveredFilter}
          ref={inputRef}
          options={options}
          onOpenChange={setFilterActive}
          sortComparator={() => 0} // Disable frontend sorting to preserve backend order
        />
      </FormItem>
    </FilterPluginStyle>
  );
}
