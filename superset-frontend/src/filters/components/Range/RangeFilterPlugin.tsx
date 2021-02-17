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
import React, { useEffect, useState } from 'react';
import { Slider } from 'src/common/components';
import { PluginFilterRangeProps } from './types';
import { PluginFilterStylesProps } from '../types';
import { getRangeExtraFormData } from '../../utils';

const Styles = styled.div<PluginFilterStylesProps>`
  height: ${({ height }) => height};
  width: ${({ width }) => width};
`;

export default function RangeFilterPlugin(props: PluginFilterRangeProps) {
  const { data, formData, height, width, setExtraFormData, inputRef } = props;
  const [row] = data;
  // @ts-ignore
  const { min, max }: { min: number; max: number } = row;
  const { groupby, currentValue, defaultValue } = formData;
  const [col = ''] = groupby || [];
  const [value, setValue] = useState<[number, number]>(
    defaultValue ?? [min, max],
  );

  const handleAfterChange = (value: [number, number]) => {
    const [lower, upper] = value;
    setValue(value);
    setExtraFormData({
      extraFormData: getRangeExtraFormData(col, lower, upper),
      currentState: {
        value,
      },
    });
  };

  const handleChange = (value: [number, number]) => {
    setValue(value);
  };

  useEffect(() => {
    handleChange(currentValue ?? [min, max]);
  }, [JSON.stringify(currentValue)]);

  useEffect(() => {
    handleChange(defaultValue ?? [min, max]);
    // I think after Config Modal update some filter it re-creates default value for all other filters
    // so we can process it like this `JSON.stringify` or start to use `Immer`
  }, [JSON.stringify(defaultValue)]);

  return (
    <Styles height={height} width={width}>
      {Number.isNaN(Number(min)) || Number.isNaN(Number(max)) ? (
        <h4>{t('Chosen non-numeric column')}</h4>
      ) : (
        <Slider
          range
          min={min}
          max={max}
          value={value}
          onAfterChange={handleAfterChange}
          onChange={handleChange}
          ref={inputRef}
        />
      )}
    </Styles>
  );
}
