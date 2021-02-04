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
import { styled, TimeRange } from '@superset-ui/core';
import React, { useState, useEffect } from 'react';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl/DateFilterControl';
import { getRangeExtraFormData } from 'src/filters/utils';
import { AntdPluginFilterStylesProps } from '../types';
import { DEFAULT_FORM_DATA, PluginFilterTimeProps } from './types';

const Styles = styled.div<AntdPluginFilterStylesProps>`
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
  overflow-x: scroll;
`;

export default function PluginFilterTime(props: PluginFilterTimeProps) {
  const { formData, setExtraFormData, width, height } = props;
  const { defaultValue } = {
    ...DEFAULT_FORM_DATA,
    ...formData,
  };

  const firstDefault = (defaultValue?.[0] || '').toString();
  const [value, setValue] = useState<string>(firstDefault || 'Last week');

  let { groupby = [] } = formData;
  groupby = Array.isArray(groupby) ? groupby : [groupby];

  const handleTimeRangeChange = (timeRange: TimeRange) => {
    const [col] = groupby;
    const extraFormData = getRangeExtraFormData(
      col,
      timeRange.since,
      timeRange.until,
    );
    // @ts-ignore
    setExtraFormData({ extraFormData, currentState: { value: [value] } });
  };

  useEffect(() => {
    if (firstDefault) {
      setValue(firstDefault);
    }
  }, [firstDefault]);

  return (
    <Styles width={width} height={height}>
      <DateFilterControl
        value={value}
        name=""
        onChange={setValue}
        onTimeRangeChange={handleTimeRangeChange}
      />
    </Styles>
  );
}
