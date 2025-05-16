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
import { Meta, StoryObj } from '@storybook/react';
import { TreeSelect, type TreeSelectProps } from '.';

export default {
  title: 'Components/TreeSelect',
  component: TreeSelect,
  argTypes: {
    allowClear: {
      control: { type: 'boolean' },
      description: 'Whether to allow clearing the selected value.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    autoClearSearchValue: {
      control: { type: 'boolean' },
      description: 'Whether to clear the search value automatically.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the component is disabled.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    labelInValue: {
      control: { type: 'boolean' },
      description: 'Whether to use label in value.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
      },
    },
    listHeight: {
      control: { type: 'number' },
      description: 'Height of the dropdown list.',
      defaultValue: 256,
      table: {
        category: 'TreeSelect',
        type: { summary: 'number' },
        defaultValue: { summary: '256' },
      },
    },
    maxTagCount: {
      control: { type: 'number' },
      description: 'Maximum number of tags to display.',
      table: {
        category: 'TreeSelect',
        type: { summary: 'number' },
      },
    },
    maxTagTextLength: {
      control: { type: 'number' },
      description: 'Maximum length of tag text.',
      defaultValue: 20,
      table: {
        category: 'TreeSelect',
        type: { summary: 'number' },
      },
    },
    multiple: {
      control: { type: 'boolean' },
      description: 'Whether to allow multiple selections.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    placeholder: {
      control: { type: 'text' },
      description: 'Placeholder text for the input field.',
      defaultValue: 'Please select',
      table: {
        category: 'TreeSelect',
        type: { summary: 'string' },
      },
    },
    placement: {
      control: { type: 'select' },
      options: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
      description: 'Placement of the dropdown menu.',
      defaultValue: 'bottomLeft',
      table: {
        category: 'TreeSelect',
        type: { summary: 'string' },
        defaultValue: { summary: 'bottomLeft' },
      },
    },
    showSearch: {
      control: { type: 'boolean' },
      description: 'Whether to show the search input.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
      },
    },
    size: {
      control: { type: 'select' },
      options: ['large', 'middle', 'small'],
      description: 'Size of the component.',
      defaultValue: 'middle',
      table: {
        category: 'TreeSelect',
        type: { summary: 'string' },
      },
    },
    status: {
      control: { type: 'select' },
      options: ['error', 'warning'],
      description: 'Status of the component.',
      defaultValue: 'error',
      table: {
        category: 'TreeSelect',
        type: { summary: 'string' },
      },
    },
    treeCheckable: {
      control: { type: 'boolean' },
      description: 'Whether to show checkable tree nodes.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    treeDefaultExpandAll: {
      control: { type: 'boolean' },
      description: 'Whether to expand all tree nodes by default.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    treeIcon: {
      control: { type: 'boolean' },
      description: 'Whether to show tree icons.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    treeLine: {
      control: { type: 'boolean' },
      description: 'Whether to show tree lines.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    variant: {
      control: { type: 'select' },
      options: ['outlined', 'borderless', 'filled', 'underlined'],
      description: 'Variant of the component.',
      defaultValue: 'outlined',
      table: {
        category: 'TreeSelect',
        type: { summary: 'string' },
        defaultValue: { summary: 'outlined' },
      },
    },
    virtual: {
      control: { type: 'boolean' },
      description: 'Whether to use virtual scrolling.',
      defaultValue: false,
      table: {
        category: 'TreeSelect',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    treeData: {
      table: {
        disable: true,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'TreeSelect is a select component that allows users to select from a tree structure.',
      },
    },
  },
} as Meta<typeof TreeSelect>;

type Story = StoryObj<typeof TreeSelect>;

const treeData = [
  {
    title: 'Node1',
    value: '0-0',
    children: [
      {
        title: 'Child Node1',
        value: '0-0-0',
      },
      {
        title: 'Child Node2',
        value: '0-0-1',
      },
    ],
  },
  {
    title: 'Node2',
    value: '0-1',
    children: [
      {
        title: 'Child Node3',
        value: '0-1-0',
      },
    ],
  },
];

export const Default: Story = {
  args: {
    treeData,
  },
  render: (args: TreeSelectProps) => <TreeSelect {...args} />,
};
