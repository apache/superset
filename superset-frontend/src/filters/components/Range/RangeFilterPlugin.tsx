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
import { t } from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { Slider } from 'src/common/components';
import { PluginFilterRangeProps } from './types';
import { Styles } from '../common';
import { getRangeExtraFormData } from '../../utils';

export default function RangeFilterPlugin(props: PluginFilterRangeProps) {
  const {
    data,
    formData,
    height,
    width,
    setDataMask,
    setFocusedFilter,
    unsetFocusedFilter,
    inputRef,
    filterState,
  } = props;
  const [row] = data;
  // @ts-ignore
  const { min, max }: { min: number; max: number } = row;
  const { groupby, defaultValue } = formData;
  const [col = ''] = groupby || [];
  const [value, setValue] = useState<[number, number]>(
    defaultValue ?? [min, max],
  );

  const handleAfterChange = (value: [number, number]) => {
    const [lower, upper] = value;
    setValue(value);

    setDataMask({
      extraFormData: getRangeExtraFormData(col, lower, upper),
      filterState: {
        value,
      },
    });
  };

  const handleChange = (value: [number, number]) => {
    setValue(value);
  };

  useEffect(() => {
    handleAfterChange(filterState.value ?? [min, max]);
  }, [JSON.stringify(filterState.value)]);

  useEffect(() => {
    handleAfterChange(defaultValue ?? [min, max]);
    // I think after Config Modal update some filter it re-creates default value for all other filters
    // so we can process it like this `JSON.stringify` or start to use `Immer`
  }, [JSON.stringify(defaultValue)]);

  return (
    <Styles height={height} width={width}>
      {Number.isNaN(Number(min)) || Number.isNaN(Number(max)) ? (
        <h4>{t('Chosen non-numeric column')}</h4>
      ) : (
        <div onMouseEnter={setFocusedFilter} onMouseLeave={unsetFocusedFilter}>
          <Slider
            range
            min={min}
            max={max}
            value={value}
            onAfterChange={handleAfterChange}
            onChange={handleChange}
            ref={inputRef}
          />
        </div>
      )}
    </Styles>
  );
}
