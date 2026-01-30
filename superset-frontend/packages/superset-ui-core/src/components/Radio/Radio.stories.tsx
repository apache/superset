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
import type { StoryObj } from '@storybook/react';
import { css } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import { Space } from '../Space';
import { Radio, type RadioProps, type RadioGroupWrapperProps } from '.';

export default {
  title: 'Components/Radio',
  component: Radio,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Radio button component for selecting one option from a set. Supports standalone radio buttons, radio buttons styled as buttons, and grouped radio buttons with layout configuration.',
      },
    },
  },
};

const RadioArgsType = {
  value: {
    control: 'text',
    description: 'The value associated with this radio button.',
  },
  disabled: {
    control: 'boolean',
    description: 'Whether the radio button is disabled.',
  },
  checked: {
    control: 'boolean',
    description: 'Whether the radio button is checked (controlled mode).',
  },
  children: {
    control: 'text',
    description: 'Label text displayed next to the radio button.',
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

export const RadioStory: StoryObj<typeof Radio> = {
  args: {
    value: 'radio1',
    disabled: false,
    checked: false,
    children: 'Radio',
  },
  argTypes: {
    value: {
      control: 'text',
      description: 'The value associated with this radio button.',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the radio button is disabled.',
    },
    checked: {
      control: 'boolean',
      description: 'Whether the radio button is checked (controlled mode).',
    },
    children: {
      control: 'text',
      description: 'Label text displayed next to the radio button.',
    },
  },
};

RadioStory.parameters = {
  docs: {
    examples: [
      {
        title: 'Radio Button Variants',
        code: `function RadioButtonDemo() {
  const [value, setValue] = React.useState('line');
  return (
    <Radio.Group value={value} onChange={e => setValue(e.target.value)}>
      <Radio.Button value="line">Line Chart</Radio.Button>
      <Radio.Button value="bar">Bar Chart</Radio.Button>
      <Radio.Button value="pie">Pie Chart</Radio.Button>
    </Radio.Group>
  );
}`,
      },
      {
        title: 'Vertical Radio Group',
        code: `function VerticalDemo() {
  const [value, setValue] = React.useState('option1');
  return (
    <Radio.Group value={value} onChange={e => setValue(e.target.value)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Radio value="option1">First option</Radio>
        <Radio value="option2">Second option</Radio>
        <Radio value="option3">Third option</Radio>
      </div>
    </Radio.Group>
  );
}`,
      },
    ],
  },
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
