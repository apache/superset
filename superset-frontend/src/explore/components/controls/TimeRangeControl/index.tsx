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
import dayjs from 'dayjs';
import { TimeRangePicker } from 'src/components/TimePicker';
import ControlHeader, { ControlHeaderProps } from '../../ControlHeader';

type TimeRangeValueType = [string, string];

export interface TimeRangeControlProps extends ControlHeaderProps {
  value?: TimeRangeValueType;
  onChange?: (value: TimeRangeValueType, errors: any) => void;
  allowClear?: boolean;
  showNow?: boolean;
  allowEmpty?: [boolean, boolean];
}

export default function TimeRangeControl({
  value: stringValue,
  onChange,
  allowClear,
  showNow,
  allowEmpty,
  ...rest
}: TimeRangeControlProps) {
  const dayjsValue: [dayjs.Dayjs | null, dayjs.Dayjs | null] = [
    stringValue?.[0] ? dayjs.utc(stringValue[0], 'HH:mm:ss') : null,
    stringValue?.[1] ? dayjs.utc(stringValue[1], 'HH:mm:ss') : null,
  ];

  return (
    <div>
      <ControlHeader {...rest} />
      <TimeRangePicker
        value={dayjsValue}
        onChange={(_, stringValue) => onChange?.(stringValue, null)}
        allowClear={allowClear}
        showNow={showNow}
        allowEmpty={allowEmpty}
      />
    </div>
  );
}
