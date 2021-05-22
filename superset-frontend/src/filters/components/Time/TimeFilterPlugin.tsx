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
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import { PluginFilterTimeProps } from './types';
import { Styles } from '../common';

const DEFAULT_VALUE = 'Last week';

const TimeFilterStyles = styled(Styles)`
  overflow-x: scroll;
`;

const ControlContainer = styled.div`
  display: inline-block;
`;

export default function TimeFilterPlugin(props: PluginFilterTimeProps) {
  const {
    formData,
    setDataMask,
    setFocusedFilter,
    unsetFocusedFilter,
    width,
    filterState,
  } = props;
  const { defaultValue } = formData;

  const [value, setValue] = useState<string>(defaultValue ?? DEFAULT_VALUE);

  const handleTimeRangeChange = (timeRange: string): void => {
    setValue(timeRange);

    setDataMask({
      extraFormData: {
        time_range: timeRange,
      },
      filterState: { value: timeRange },
    });
  };

  useEffect(() => {
    handleTimeRangeChange(filterState.value ?? DEFAULT_VALUE);
  }, [filterState.value]);

  useEffect(() => {
    handleTimeRangeChange(defaultValue ?? DEFAULT_VALUE);
  }, [defaultValue]);

  return (
    // @ts-ignore
    <TimeFilterStyles width={width}>
      <ControlContainer
        onMouseEnter={setFocusedFilter}
        onMouseLeave={unsetFocusedFilter}
      >
        <DateFilterControl
          value={value}
          name="time_range"
          onChange={handleTimeRangeChange}
        />
      </ControlContainer>
    </TimeFilterStyles>
  );
}
