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
import React, { useState, useEffect } from 'react';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl/DateFilterControl';
import { AntdPluginFilterStylesProps } from '../types';
import { AntdPluginFilterTimeProps } from './types';

const DEFAULT_VALUE = 'Last week';

const Styles = styled.div<AntdPluginFilterStylesProps>`
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow-x: scroll;
`;

export default function AntdTimeFilter(props: AntdPluginFilterTimeProps) {
  const { formData, setExtraFormData, width } = props;
  const { defaultValue, currentValue } = formData;

  const [value, setValue] = useState<string>(defaultValue ?? DEFAULT_VALUE);

  const handleTimeRangeChange = (timeRange: string): void => {
    setExtraFormData({
      // @ts-ignore
      extraFormData: {
        override_form_data: {
          time_range: timeRange,
        },
      },
      currentState: { value: timeRange },
    });
    setValue(timeRange);
  };

  useEffect(() => {
    handleTimeRangeChange(currentValue ?? DEFAULT_VALUE);
  }, [currentValue]);

  useEffect(() => {
    handleTimeRangeChange(defaultValue ?? DEFAULT_VALUE);
  }, [defaultValue]);

  return (
    // @ts-ignore
    <Styles width={width}>
      <DateFilterControl
        value={value}
        name="time_range"
        onChange={handleTimeRangeChange}
      />
    </Styles>
  );
}
