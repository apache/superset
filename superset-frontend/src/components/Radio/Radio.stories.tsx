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
import { Space } from 'src/components/Space';
import {
  BarChartOutlined,
  DotChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { Radio, RadioProps, RadioGroupWrapperProps } from './index';

export default {
  title: 'Radio',
  component: Radio,
  tags: ['autodocs'],
};

const RadioArgsType = {
  onChange: { action: 'changed' },
  checked: { control: 'boolean' },
  disabled: { control: 'boolean' },
  defaultChecked: { control: 'boolean' },
};

const radioGroupWrapperArgsType = {
  onChange: { action: 'changed' },
  disabled: { control: 'boolean' },
  direction: {
    control: 'select',
    options: ['horizontal', 'vertical'],
  },
  size: {
    control: 'select',
    options: ['small', 'middle', 'large'],
  },
  spaceSize: {
    control: 'select',
    options: ['small', 'middle', 'large', 'custom'],
  },
  customSpaceSize: {
    control: 'number',
    if: { arg: 'spaceSize', eq: 'custom' },
    defaultValue: 8,
  },
  useSpace: { control: 'boolean' },
  options: { control: 'object' },
};

// Radio story
export const RadioStory = {
  args: {
    children: 'Radio',
    value: 'radio1',
    disabled: false,
    checked: false,
  },
  argTypes: RadioArgsType,
};

// Radio Button story
export const RadioButtonStory = (args: RadioProps) => (
  <Radio.Button {...args}>Radio Button</Radio.Button>
);
RadioButtonStory.args = {
  value: 'button1',
  disabled: false,
  checked: false,
};
RadioButtonStory.argTypes = RadioArgsType;

// Radio Group with Custom Radio story
export const RadioGroupWithCustomRadioStory = (
  args: RadioGroupWrapperProps,
) => (
  <Radio.GroupWrapper {...args}>
    <Radio value="option1">Custom Option 1</Radio>
    <Radio value="option2">Custom Option 2</Radio>
    <Radio value="option3">Custom Option 3</Radio>
  </Radio.GroupWrapper>
);
RadioGroupWithCustomRadioStory.args = {
  useSpace: true,
  direction: 'vertical',
  spaceSize: 'middle',
  size: 'middle',
  options: undefined,
  disabled: false,
};
RadioGroupWithCustomRadioStory.argTypes = radioGroupWrapperArgsType;

// Radio Group with Options story
export const RadioGroupWithOptionsStory = (args: RadioGroupWrapperProps) => (
  <Radio.GroupWrapper {...args} />
);
RadioGroupWithOptionsStory.args = {
  useSpace: false,
  direction: 'horizontal',
  size: 'middle',
  options: [
    {
      value: 1,
      label: (
        <Space align="center" direction="vertical">
          <LineChartOutlined style={{ fontSize: 18 }} />
          LineChart
        </Space>
      ),
    },
    {
      value: 2,
      label: (
        <Space align="center" direction="vertical">
          <DotChartOutlined style={{ fontSize: 18 }} />
          DotChart
        </Space>
      ),
    },
    {
      value: 3,
      label: (
        <Space align="center" direction="vertical">
          <BarChartOutlined style={{ fontSize: 18 }} />
          BarChart
        </Space>
      ),
    },
    {
      value: 4,
      label: (
        <Space align="center" direction="vertical">
          <PieChartOutlined style={{ fontSize: 18 }} />
          PieChart
        </Space>
      ),
    },
  ],
  disabled: false,
};
RadioGroupWithOptionsStory.argTypes = radioGroupWrapperArgsType;
