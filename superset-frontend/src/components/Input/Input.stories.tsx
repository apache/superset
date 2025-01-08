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

import { InputProps, TextAreaProps } from 'antd-v5/lib/input';
import { InputNumberProps } from 'antd-v5/lib/input-number';
import { AntdThemeProvider } from 'src/components/AntdThemeProvider';
import { Input, TextArea, InputNumber } from '.';

export default {
  title: 'Input',
  component: Input,
};

export const InteractiveInput = (args: InputProps) => (
  <AntdThemeProvider>
    <Input {...args} />
  </AntdThemeProvider>
);

export const InteractiveInputNumber = (args: InputNumberProps) => (
  <AntdThemeProvider>
    <InputNumber {...args} />
  </AntdThemeProvider>
);

export const InteractiveTextArea = (args: TextAreaProps) => (
  <AntdThemeProvider>
    <TextArea {...args} />
  </AntdThemeProvider>
);

InteractiveInput.args = {
  allowClear: false,
  disabled: false,
  showCount: false,
  type: 'text',
  variant: 'outlined',
};

InteractiveInput.argTypes = {
  defaultValue: {
    control: {
      type: 'text',
    },
  },

  id: {
    control: {
      type: 'text',
    },
  },

  maxLength: {
    control: {
      type: 'number',
    },
  },

  status: {
    control: {
      type: 'select',
    },
    options: ['error', 'warning'],
  },

  size: {
    control: {
      type: 'select',
    },
    options: ['large', 'middle', 'small'],
  },
  variant: {
    control: {
      type: 'select',
    },
    options: ['outlined', 'borderless', 'filled'],
  },
};

InteractiveTextArea.args = {
  ...InteractiveInput.args,
  autoSize: false,
};

InteractiveTextArea.argTypes = InteractiveInput.argTypes;

InteractiveInputNumber.args = {
  autoFocus: false,
  disabled: false,
  keyboard: true,
  max: Number.MAX_SAFE_INTEGER,
  min: Number.MIN_SAFE_INTEGER,
  readonly: false,
  step: 1,
  stringMode: false,
};

InteractiveInputNumber.argTypes = {
  controls: {
    control: { type: 'boolean' },
  },

  decimalSeperator: {
    control: { type: 'text' },
  },

  placeholder: {
    control: { type: 'text' },
  },

  defaultValue: {
    control: { type: 'number' },
  },

  precision: {
    control: { type: 'number' },
  },

  status: InteractiveInput.argTypes.status,
  size: InteractiveInput.argTypes.size,
  variant: InteractiveInput.argTypes.variant,
};
