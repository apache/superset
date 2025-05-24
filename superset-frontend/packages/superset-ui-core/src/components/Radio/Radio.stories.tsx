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
import { css } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { Space } from '../Space';
import { Radio, type RadioProps, type RadioGroupWrapperProps } from '.';

export default {
  title: 'Components/Radio',
  component: Radio,
  tags: ['autodocs'],
};

const RadioArgsType = {
  value: {
    control: 'text',
    description: 'The value of the radio button.',
  },
  disabled: {
    control: 'boolean',
    description: 'Whether the radio button is disabled or not.',
  },
  checked: {
    control: 'boolean',
    description: 'The checked state of the radio button.',
  },
};

const radioGroupWrapperArgsType = {
  onChange: { action: 'changed' },
  disabled: { control: 'boolean' },
  size: {
    control: 'select',
    options: ['small', 'middle', 'large'],
  },
  options: { control: 'object' },
  'spaceConfig.direction': {
    control: 'select',
    options: ['horizontal', 'vertical'],
    description: 'Direction of the Space layout',
    if: { arg: 'enableSpaceConfig', truthy: true },
  },
  'spaceConfig.size': {
    control: 'select',
    options: ['small', 'middle', 'large'],
    description: 'Layout size Space',
    if: { arg: 'enableSpaceConfig', truthy: true },
  },
  'spaceConfig.align': {
    control: 'select',
    options: ['start', 'center', 'end'],
    description: 'Alignment of the Space layout',
    if: { arg: 'enableSpaceConfig', truthy: true },
  },
  'spaceConfig.wrap': {
    control: 'boolean',
    description:
      'Controls whether the items inside the Space component should wrap to the next line when space is insufficient',
    if: { arg: 'enableSpaceConfig', truthy: true },
  },
};

export const RadioStory = {
  args: {
    value: 'radio1',
    disabled: false,
    checked: false,
    children: 'Radio',
  },
  argTypes: RadioArgsType,
};

export const RadioButtonStory = (args: RadioProps) => (
  <Radio.Button {...args}>Radio Button</Radio.Button>
);
RadioButtonStory.args = {
  value: 'button1',
  disabled: false,
  checked: false,
};
RadioButtonStory.argTypes = RadioArgsType;

export const RadioGroupWithOptionsStory = (args: RadioGroupWrapperProps) => (
  <Radio.GroupWrapper {...args} />
);
RadioGroupWithOptionsStory.args = {
  spaceConfig: {
    direction: 'vertical',
    size: 'middle',
    align: 'center',
    wrap: false,
  },
  size: 'middle',
  options: [
    {
      value: 1,
      label: (
        <Space align="center" direction="vertical">
          <Icons.LineChartOutlined
            css={css`
              font-size: 18;
            `}
          />
          LineChart
        </Space>
      ),
    },
    {
      value: 3,
      label: (
        <Space align="center" direction="vertical">
          <Icons.BarChartOutlined
            css={css`
              font-size: 18;
            `}
          />
          BarChart
        </Space>
      ),
    },
    {
      value: 4,
      label: (
        <Space align="center" direction="vertical">
          <Icons.PieChartOutlined
            css={css`
              font-size: 18;
            `}
          />
          PieChart
        </Space>
      ),
    },
  ],
  disabled: false,
};
RadioGroupWithOptionsStory.argTypes = radioGroupWrapperArgsType;
