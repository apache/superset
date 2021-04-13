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
  AppSection,
  Behavior,
  DataMask,
  ensureIsArray,
  GenericDataType,
  smartDateDetailedFormatter,
  t,
  tn,
} from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { Select } from 'src/common/components';
import { FIRST_VALUE, PluginFilterSelectProps, SelectValue } from './types';
import { StyledSelect, Styles } from '../common';
import { getDataRecordFormatter, getSelectExtraFormData } from '../../utils';

const { Option } = Select;

export default function PluginFilterSelect(props: PluginFilterSelectProps) {
  const {
    coltypeMap,
    data,
    formData,
    height,
    width,
    behaviors,
    setDataMask,
    appSection,
  } = props;
  const {
    defaultValue,
    enableEmptyFilter,
    multiSelect,
    showSearch,
    currentValue,
    inverseSelection,
    inputRef,
    defaultToFirstItem,
  } = formData;

  const forceFirstValue =
    appSection === AppSection.FILTER_CONFIG_MODAL && defaultToFirstItem;

  const groupby = ensureIsArray<string>(formData.groupby);
  // Correct initial value for Ant Select
  const initSelectValue: SelectValue =
    // `defaultValue` can be `FIRST_VALUE` if `defaultToFirstItem` is checked, so need convert it to correct value for Select
    defaultValue === FIRST_VALUE ? [] : defaultValue ?? [];

  const firstItem: SelectValue = data[0]
    ? (groupby.map(col => data[0][col]) as string[]) ?? initSelectValue
    : initSelectValue;

  // If we are in config modal we always need show empty select for `defaultToFirstItem`
  const [values, setValues] = useState<SelectValue>(
    defaultToFirstItem && appSection !== AppSection.FILTER_CONFIG_MODAL
      ? firstItem
      : initSelectValue,
  );

  const [col] = groupby;
  const datatype: GenericDataType = coltypeMap[col];
  const labelFormatter = getDataRecordFormatter({
    timeFormatter: smartDateDetailedFormatter,
  });

  const handleChange = (value?: SelectValue | number | string) => {
    let selectValue: (number | string)[] = ensureIsArray<number | string>(
      value,
    );
    let stateValue: SelectValue | typeof FIRST_VALUE = selectValue.length
      ? selectValue
      : null;

    if (value === FIRST_VALUE) {
      selectValue = forceFirstValue ? [] : firstItem;
      stateValue = FIRST_VALUE;
    }

    setValues(selectValue);

    const emptyFilter =
      enableEmptyFilter && !inverseSelection && selectValue?.length === 0;

    const dataMask = {
      extraFormData: getSelectExtraFormData(
        col,
        selectValue,
        emptyFilter,
        inverseSelection,
      ),
      currentState: {
        // We need to save in state `FIRST_VALUE` as some const and not as REAL value,
        // because when FiltersBar check if all filters initialized it compares `defaultValue` with this value
        // and because REAL value can be unpredictable for users that have different data for same dashboard we use `FIRST_VALUE`
        value: stateValue,
      },
    };

    const dataMaskObject: DataMask = {};
    if (behaviors.includes(Behavior.NATIVE_FILTER)) {
      dataMaskObject.nativeFilters = dataMask;
    }

    if (behaviors.includes(Behavior.CROSS_FILTER)) {
      dataMaskObject.crossFilters = dataMask;
    }

    setDataMask(dataMaskObject);
  };

  useEffect(() => {
    // For currentValue we need set always `FIRST_VALUE` only if we in config modal for `defaultToFirstItem` mode
    handleChange(forceFirstValue ? FIRST_VALUE : currentValue ?? []);
  }, [
    JSON.stringify(currentValue),
    defaultToFirstItem,
    multiSelect,
    enableEmptyFilter,
    inverseSelection,
  ]);

  useEffect(() => {
    // If we have `defaultToFirstItem` mode it means that default value always `FIRST_VALUE`
    handleChange(defaultToFirstItem ? FIRST_VALUE : defaultValue);
  }, [
    JSON.stringify(defaultValue),
    JSON.stringify(firstItem),
    defaultToFirstItem,
    multiSelect,
    enableEmptyFilter,
    inverseSelection,
  ]);

  const placeholderText =
    (data || []).length === 0
      ? t('No data')
      : tn('%s option', '%s options', data.length, data.length);
  return (
    <Styles height={height} width={width}>
      <StyledSelect
        allowClear
        // @ts-ignore
        value={values}
        disabled={forceFirstValue}
        showSearch={showSearch}
        mode={multiSelect ? 'multiple' : undefined}
        placeholder={placeholderText}
        // @ts-ignore
        onChange={handleChange}
        ref={inputRef}
      >
        {(data || []).map(row => {
          const [value] = groupby.map(col => row[col]);
          return (
            // @ts-ignore
            <Option key={`${value}`} value={value}>
              {labelFormatter(value, datatype)}
            </Option>
          );
        })}
      </StyledSelect>
    </Styles>
  );
}
