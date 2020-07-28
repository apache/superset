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
import React, { useEffect, useRef, useState } from 'react';
import { Label } from 'react-bootstrap';

import { now, fDuration } from '../modules/dates';

interface TimerProps {
  endTime?: number;
  isRunning: boolean;
  startTime?: number;
  status?: string;
  style?: object;
}

export default function Timer({
  endTime,
  isRunning,
  startTime,
  status = 'success',
  style,
}: TimerProps) {
  const [clockStr, setClockStr] = useState<string>('');
  const timer = useRef<NodeJS.Timeout>();
  const stopwatch = () => {
    if (startTime) {
      const endDttm = endTime || now();
      if (startTime < endDttm) {
        setClockStr(fDuration(startTime, endDttm));
      }
      if (!isRunning) {
        clearTimeout(timer.current!);
      }
    }
  };

  useEffect(() => {
    if (isRunning) {
      timer.current = setInterval(stopwatch, 30);
    }
    return () => {
      clearInterval(timer.current!);
    };
  });

  return (
    <Label className="m-r-5" style={style} bsStyle={status}>
      {clockStr}
    </Label>
  );
}
