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
import { DataRecord } from '@superset-ui/core';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Slider } from 'antd';

import { TimeSliderProps } from '../types';
import {
  dataRecordsToMarks,
  formatDate,
  getFirstMark,
  getLastMark,
} from '../util/timesliderUtil';

export const TimeSlider: React.FC<TimeSliderProps> = props => {
  const {
    data,
    defaultValue,
    timesliderTooltipFormat,
    onChange,
    timeColumn,
    ...sliderProps
  } = props;

  const marks = useMemo(
    () => dataRecordsToMarks(data as DataRecord[], timeColumn),
    [data, timeColumn],
  );

  const minVal = useMemo(() => getFirstMark(marks), [marks]);
  const maxVal = useMemo(() => getLastMark(marks), [marks]);

  const formatter = useCallback(
    (value: number) => {
      const date = new Date(value);
      const formattedDate = formatDate(date, timesliderTooltipFormat);
      return <div>{formattedDate}</div>;
    },
    [timesliderTooltipFormat],
  );

  useEffect(() => {
    if (!marks || !onChange) {
      return;
    }
    const markKeys = Object.keys(marks);
    if (
      defaultValue === undefined ||
      !markKeys.includes(defaultValue.toString())
    ) {
      onChange(parseInt(markKeys[0], 10));
    }
  }, [defaultValue, marks, onChange]);

  return (
    <Slider
      min={minVal}
      max={maxVal}
      marks={marks}
      step={null}
      tipFormatter={formatter}
      defaultValue={defaultValue}
      onChange={onChange}
      {...sliderProps}
    />
  );
};

export default TimeSlider;
