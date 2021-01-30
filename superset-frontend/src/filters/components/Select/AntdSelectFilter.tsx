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
import { styled } from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { Select } from 'src/common/components';
import { DEFAULT_FORM_DATA, AntdPluginFilterSelectProps } from './types';
import { AntdPluginFilterStylesProps } from '../types';
import { getSelectExtraFormData } from '../../utils';

const Styles = styled.div<AntdPluginFilterStylesProps>`
  height: ${({ height }) => height};
  width: ${({ width }) => width};
`;

const { Option } = Select;

export default function AntdPluginFilterSelect(
  props: AntdPluginFilterSelectProps,
) {
  const [values, setValues] = useState<(string | number)[]>([]);
  const { data, formData, height, width, setExtraFormData } = props;
  const {
    defaultValues,
    enableEmptyFilter,
    multiSelect,
    showSearch,
    inverseSelection,
    inputRef,
  } = {
    ...DEFAULT_FORM_DATA,
    ...formData,
  };

  useEffect(() => {
    setValues(defaultValues || []);
  }, [defaultValues]);

  let { groupby = [] } = formData;
  groupby = Array.isArray(groupby) ? groupby : [groupby];

  function handleChange(value?: number[] | string[] | null) {
    setValues(value || []);
    const [col] = groupby;
    const emptyFilter =
      enableEmptyFilter &&
      !inverseSelection &&
      (value === undefined || value === null || value.length === 0);
    setExtraFormData(
      getSelectExtraFormData(col, value, emptyFilter, inverseSelection),
    );
  }
  const placeholderText =
    (data || []).length === 0
      ? 'No data'
      : `${data.length} option${data.length > 1 ? 's' : 0}`;
  return (
    <Styles height={height} width={width}>
      <Select
        allowClear
        value={values}
        showSearch={showSearch}
        style={{ width: '100%' }}
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
      </Select>
    </Styles>
  );
}
