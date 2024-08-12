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
import { DatePickerProps, RangePickerProps } from 'antd/lib/date-picker';
import { DatePicker, RangePicker } from '.';

export default {
  title: 'DatePicker',
  component: DatePicker,
};

const commonArgs = {
  allowClear: true,
  autoFocus: true,
  bordered: true,
  disabled: false,
  inputReadOnly: false,
  size: 'middle',
  format: 'YYYY-MM-DD hh:mm a',
  showTime: { format: 'hh:mm a' },
};

const interactiveTypes = {
  mode: { disabled: true },
  picker: {
    control: {
      type: 'select',
    },
    options: ['', 'date', 'week', 'month', 'quarter', 'year'],
  },
  size: {
    control: {
      type: 'select',
    },
    options: ['large', 'middle', 'small'],
  },
};

export const InteractiveDatePicker = (args: DatePickerProps) => (
  <DatePicker {...args} />
);

InteractiveDatePicker.args = {
  ...commonArgs,
  picker: 'date',
  placeholder: 'Placeholder',
  showToday: true,
};

InteractiveDatePicker.argTypes = interactiveTypes;

export const InteractiveRangePicker = (args: RangePickerProps) => (
  <RangePicker {...args} />
);

InteractiveRangePicker.args = {
  ...commonArgs,
  allowEmpty: true,
  showNow: true,
  separator: '-',
};

InteractiveRangePicker.argTypes = interactiveTypes;
