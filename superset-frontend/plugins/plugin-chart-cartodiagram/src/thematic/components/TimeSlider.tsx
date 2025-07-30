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
import { DataRecord, styled } from '@superset-ui/core';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Slider, Button } from 'antd';
import { CaretRightOutlined, PauseOutlined } from '@ant-design/icons';

import { TimeSliderProps } from '../types';
import {
  dataRecordsToMarks,
  formatDate,
  getFirstMark,
  getLastMark,
} from '../util/timesliderUtil';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  height: 32px;
  margin-top: 12px;
`;

const StyledButton = styled(Button)`
  margin-right: 8px;
`;

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  justify-content: space-between;
`;

const StyledSlider = styled(Slider)`
  margin: 0;
  margin-left: 32px;
`;

const TimeDisplay = styled.div`
  font-size: 12px;
  text-align: left;
  line-height: 1;
  margin-left: 25px;
`;

export const TimeSlider: FC<TimeSliderProps> = props => {
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

  const markKeys = useMemo(
    () => Object.keys(marks).map(k => parseInt(k, 10)),
    [marks],
  );
  const minVal = useMemo(() => getFirstMark(marks), [marks]);
  const maxVal = useMemo(() => getLastMark(marks), [marks]);

  const [currentValue, setCurrentValue] = useState<number>(
    defaultValue && markKeys.includes(defaultValue)
      ? defaultValue
      : (markKeys[0] ?? Date.now()),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const formatter = useCallback(
    (value: number) => {
      const date = new Date(value);
      const formattedDate = formatDate(date, timesliderTooltipFormat);
      return <div>{formattedDate}</div>;
    },
    [timesliderTooltipFormat],
  );

  const advanceSlider = useCallback(() => {
    const currentIdx = markKeys.indexOf(currentValue);
    const nextIdx = (currentIdx + 1) % markKeys.length;
    const nextVal = markKeys[nextIdx];
    setCurrentValue(nextVal);
    onChange?.(nextVal);
  }, [currentValue, markKeys, onChange]);

  const togglePlay = () => setIsPlaying(prev => !prev);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(advanceSlider, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, advanceSlider]);

  useEffect(() => {
    if (defaultValue === undefined || !markKeys.includes(defaultValue)) {
      const first = markKeys[0];
      setCurrentValue(first);
      onChange?.(first);
    }
  }, [defaultValue, markKeys, onChange]);

  const handleSliderChange = (val: number) => {
    setCurrentValue(val);
    onChange?.(val);
  };

  return (
    <Wrapper>
      <StyledButton
        onClick={togglePlay}
        icon={isPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
      />
      <SliderContainer>
        <StyledSlider
          min={minVal}
          max={maxVal}
          marks={marks}
          step={null}
          tipFormatter={formatter}
          value={currentValue}
          onChange={handleSliderChange}
          {...sliderProps}
        />
        <TimeDisplay>
          {formatDate(new Date(currentValue), timesliderTooltipFormat)}
        </TimeDisplay>
      </SliderContainer>
    </Wrapper>
  );
};

export default TimeSlider;
