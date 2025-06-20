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
import type { Meta, StoryObj } from '@storybook/react';
import { Input, InputNumber } from '.';
import type { InputProps, InputNumberProps, TextAreaProps } from './types';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
};

export default meta;

type Story = StoryObj<typeof Input>;
type InputNumberStory = StoryObj<typeof InputNumber>;
type TextAreaStory = StoryObj<typeof Input.TextArea>;

export const InteractiveInput: Story = {
  render: (args: InputProps) => <Input {...args} />,
  args: {
    allowClear: false,
    disabled: false,
    showCount: false,
    type: 'text',
    variant: 'outlined',
  },
  argTypes: {
    defaultValue: {
      control: { type: 'text' },
      description: 'Default input value',
      table: {
        category: 'Input',
        type: { summary: 'string' },
      },
    },
    id: {
      control: { type: 'text' },
      description: 'HTML id attribute',
      table: {
        category: 'Input',
        type: { summary: 'string' },
      },
    },
    maxLength: {
      control: { type: 'number' },
      description: 'Maximum length of input',
      table: {
        category: 'Input',
        type: { summary: 'number' },
      },
    },
    status: {
      control: { type: 'select' },
      options: ['error', 'warning'],
      description: 'Validation status',
      table: {
        category: 'Input',
        type: { summary: `'error' | 'warning'` },
      },
    },
    size: {
      control: { type: 'select' },
      options: ['large', 'middle', 'small'],
      description: 'Size of the input',
      table: {
        category: 'Input',
        type: { summary: `'large' | 'middle' | 'small'` },
        defaultValue: { summary: 'middle' },
      },
    },
    variant: {
      control: { type: 'select' },
      options: ['outlined', 'borderless', 'filled'],
      description: 'Input style variant',
      table: {
        category: 'Input',
        type: { summary: `'outlined' | 'borderless' | 'filled'` },
        defaultValue: { summary: 'outlined' },
      },
    },
  },
};

export const InteractiveInputNumber: InputNumberStory = {
  render: (args: InputNumberProps) => <InputNumber {...args} />,
  args: {
    autoFocus: false,
    disabled: false,
    keyboard: true,
    max: Number.MAX_SAFE_INTEGER,
    min: Number.MIN_SAFE_INTEGER,
    step: 1,
    stringMode: false,
  },
  argTypes: {
    controls: {
      control: false,
      description: 'Enable or disable controls',
      table: {
        category: 'InputNumber',
        type: { summary: 'boolean' },
      },
    },
    placeholder: {
      control: { type: 'text' },
      description: 'Placeholder text',
      table: {
        category: 'InputNumber',
        type: { summary: 'string' },
      },
    },
    defaultValue: {
      control: { type: 'number' },
      description: 'Default numeric value',
      table: {
        category: 'InputNumber',
        type: { summary: 'number' },
      },
    },
    precision: {
      control: { type: 'number' },
      description: 'Number of decimal places',
      table: {
        category: 'InputNumber',
        type: { summary: 'number' },
      },
    },
    status: {
      ...InteractiveInput.argTypes?.status,
      table: {
        ...InteractiveInput.argTypes?.status?.table,
        category: 'InputNumber',
      },
    },
    size: {
      ...InteractiveInput.argTypes?.size,
      table: {
        ...InteractiveInput.argTypes?.size?.table,
        category: 'InputNumber',
      },
    },
    variant: {
      ...InteractiveInput.argTypes?.variant,
      table: {
        ...InteractiveInput.argTypes?.variant?.table,
        category: 'InputNumber',
      },
    },
  },
};

export const InteractiveTextArea: TextAreaStory = {
  render: (args: TextAreaProps) => <Input.TextArea {...args} />,
  args: {
    allowClear: false,
    disabled: false,
    showCount: false,
    variant: 'outlined',
    autoSize: false,
    prefix: undefined,
  },
  argTypes: InteractiveInput.argTypes,
};
