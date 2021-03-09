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
import { Behavior, DataMask, styled, t, tn } from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { Select } from 'src/common/components';
import { PluginFilterTimeColumnProps } from './types';
import { PluginFilterStylesProps } from '../types';

const Styles = styled.div<PluginFilterStylesProps>`
  height: ${({ height }) => height};
  width: ${({ width }) => width};
`;

const { Option } = Select;

export default function PluginFilterTimeColumn(
  props: PluginFilterTimeColumnProps,
) {
  const { behaviors, data, formData, height, width, setDataMask } = props;
  const { defaultValue, currentValue, inputRef } = formData;

  const [value, setValue] = useState<string[]>(defaultValue ?? []);

  const handleChange = (value?: string[] | string | null) => {
    let resultValue: string[];
    if (Array.isArray(value)) {
      resultValue = value;
    } else {
      resultValue = value ? [value] : [];
    }
    setValue(resultValue);

    const dataMask = {
      extraFormData: {
        override_form_data: {
          granularity_sqla: resultValue.length ? resultValue[0] : null,
        },
      },
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
    handleChange(currentValue ?? null);
  }, [JSON.stringify(currentValue)]);

  useEffect(() => {
    handleChange(defaultValue ?? null);
    // I think after Config Modal update some filter it re-creates default value for all other filters
    // so we can process it like this `JSON.stringify` or start to use `Immer`
  }, [JSON.stringify(defaultValue)]);

  const timeColumns = (data || []).filter(row => row.dtype === 2);

  const placeholderText =
    timeColumns.length === 0
      ? t('No time columns')
      : tn('%s option', '%s options', timeColumns.length, timeColumns.length);
  return (
    <Styles height={height} width={width}>
      <Select
        allowClear
        value={value}
        style={{ width: '100%' }}
        placeholder={placeholderText}
        // @ts-ignore
        onChange={handleChange}
        ref={inputRef}
      >
        {timeColumns.map(
          (row: { column_name: string; verbose_name: string | null }) => {
            const { column_name: columnName, verbose_name: verboseName } = row;
            return (
              <Option key={columnName} value={columnName}>
                {verboseName ?? columnName}
              </Option>
            );
          },
        )}
      </Select>
    </Styles>
  );
}
