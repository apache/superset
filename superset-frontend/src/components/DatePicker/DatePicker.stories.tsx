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
import { DatePickerProps } from 'antd-v5';
import { RangePickerProps } from 'antd-v5/es/date-picker';
import { DatePicker, RangePicker } from '.';

export default {
  title: 'DatePicker',
  component: DatePicker,
};

const commonArgs: DatePickerProps = {
  allowClear: false,
  autoFocus: true,
  disabled: false,
  format: 'YYYY-MM-DD hh:mm a',
  inputReadOnly: false,
  order: true,
  picker: 'date',
  placement: 'bottomLeft',
  size: 'middle',
  showNow: true,
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
  placement: {
    control: {
      type: 'select',
    },
    options: ['bottomLeft', 'bottomRight', 'topLeft', 'topRight'],
  },
  status: {
    control: {
      type: 'select',
    },
    options: ['error', 'warning'],
  },

  variant: {
    control: {
      type: 'select',
    },
    options: ['outlined', 'borderless', 'filled'],
  },
};

export const InteractiveDatePicker: any = (args: DatePickerProps) => (
  <DatePicker {...args} />
);

InteractiveDatePicker.args = {
  ...commonArgs,
  placeholder: 'Placeholder',
  showToday: true,
  showTime: { format: 'hh:mm a', needConfirm: false },
};

InteractiveDatePicker.argTypes = interactiveTypes;

export const InteractiveRangePicker: any = (args: RangePickerProps) => (
  <RangePicker {...args} />
);

InteractiveRangePicker.args = {
  ...commonArgs,
  separator: '-',
  showTime: { format: 'hh:mm a', needConfirm: false },
};

InteractiveRangePicker.argTypes = interactiveTypes;
