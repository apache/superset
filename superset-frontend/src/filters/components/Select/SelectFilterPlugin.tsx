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
import { Behavior, DataMask, t, tn, ensureIsArray } from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { Select } from 'src/common/components';
import { PluginFilterSelectProps } from './types';
import { Styles, StyledSelect } from '../common';
import { getSelectExtraFormData } from '../../utils';

const { Option } = Select;

export default function PluginFilterSelect(props: PluginFilterSelectProps) {
  const { data, formData, height, width, behaviors, setDataMask } = props;
  const {
    defaultValue,
    enableEmptyFilter,
    multiSelect,
    showSearch,
    currentValue,
    inverseSelection,
    inputRef,
  } = formData;

  const [values, setValues] = useState<(string | number)[]>(defaultValue ?? []);

  let { groupby = [] } = formData;
  groupby = Array.isArray(groupby) ? groupby : [groupby];

  const handleChange = (
    value?: (number | string)[] | number | string | null,
  ) => {
    const resultValue: (number | string)[] = ensureIsArray<number | string>(
      value,
    );
    setValues(resultValue);

    const [col] = groupby;
    const emptyFilter =
      enableEmptyFilter && !inverseSelection && resultValue?.length === 0;

    const dataMask = {
      extraFormData: getSelectExtraFormData(
        col,
        resultValue,
        emptyFilter,
        inverseSelection,
      ),
      currentState: {
        value: resultValue.length ? resultValue : null,
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
    handleChange(currentValue ?? []);
  }, [
    JSON.stringify(currentValue),
    multiSelect,
    enableEmptyFilter,
    inverseSelection,
  ]);

  useEffect(() => {
    handleChange(defaultValue ?? []);
  }, [
    JSON.stringify(defaultValue),
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
        value={values}
        showSearch={showSearch}
        mode={multiSelect ? 'multiple' : undefined}
        placeholder={placeholderText}
        // @ts-ignore
        onChange={handleChange}
        ref={inputRef}
      >
        {(data || []).map(row => {
          const option = `${groupby.map(col => row[col])[0]}`;
          return (
            <Option key={option} value={option}>
              {option}
            </Option>
          );
        })}
      </StyledSelect>
    </Styles>
  );
}
