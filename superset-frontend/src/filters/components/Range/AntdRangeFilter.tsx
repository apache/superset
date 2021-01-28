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
import React from 'react';
import { Slider } from 'src/common/components';
import { AntdPluginFilterRangeProps } from './types';
import { AntdPluginFilterStylesProps } from '../types';
import { getRangeExtraFormData } from '../../utils';

const Styles = styled.div<AntdPluginFilterStylesProps>`
  height: ${({ height }) => height};
  width: ${({ width }) => width};
`;

export default function AntdRangeFilter(props: AntdPluginFilterRangeProps) {
  const { data, formData, height, width, setExtraFormData, inputRef } = props;
  const [row] = data;
  // @ts-ignore
  const { min, max }: { min: number; max: number } = row;
  const { groupby } = formData;
  const [col] = groupby || [];

  const handleChange = (value: [number, number]) => {
    const [lower, upper] = value;

    setExtraFormData(getRangeExtraFormData(col, lower, upper));
  };

  return (
    <Styles height={height} width={width}>
      <Slider
        range
        min={min}
        max={max}
        defaultValue={[min, max]}
        onChange={handleChange}
        ref={inputRef}
      />
    </Styles>
  );
}
