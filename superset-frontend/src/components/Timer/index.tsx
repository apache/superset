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
import { useEffect, useRef, useState } from 'react';
import { styled, useTheme } from '@superset-ui/core';
import Label, { Type } from 'src/components/Label';
import { Icons } from 'src/components/Icons';

import { now, fDuration } from 'src/utils/dates';

export interface TimerProps {
  endTime?: number;
  isRunning: boolean;
  startTime?: number;
  status?: Type;
}

const TimerLabel = styled(Label)`
  text-align: left;
  font-family: ${({ theme }) => theme.typography.families.monospace};
`;

export default function Timer({
  endTime,
  isRunning,
  startTime,
  status = 'success',
}: TimerProps) {
  const theme = useTheme();
  const [clockStr, setClockStr] = useState('00:00:00.00');
  const timer = useRef<ReturnType<typeof setInterval>>();

  const getIconColor = (status: Type) => {
    const { colors } = theme;

    const colorMap: Record<Type, string> = {
      success: colors.success.dark2,
      warning: colors.warning.dark2,
      danger: colors.error.dark2,
      info: colors.info.dark2,
      default: colors.grayscale.dark1,
      primary: colors.primary.dark2,
      secondary: colors.secondary.dark2,
    };

    return colorMap[status] || colors.grayscale.dark1;
  };
  useEffect(() => {
    const stopTimer = () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = undefined;
      }
    };

    if (isRunning) {
      timer.current = setInterval(() => {
        if (startTime) {
          const endDttm = endTime || now();
          if (startTime < endDttm) {
            setClockStr(fDuration(startTime, endDttm));
          }
          if (!isRunning) {
            stopTimer();
          }
        }
      }, 30);
    }
    return stopTimer;
  }, [endTime, isRunning, startTime]);

  return (
    <TimerLabel
      icon={
        <Icons.ClockCircleOutlined
          iconColor={getIconColor(status)}
          iconSize="m"
        />
      }
      type={status}
      role="timer"
    >
      {clockStr}
    </TimerLabel>
  );
}
