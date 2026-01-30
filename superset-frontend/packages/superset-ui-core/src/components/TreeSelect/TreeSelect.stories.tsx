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

export const InteractiveTreeSelect = (args: TreeSelectProps) => (
  <div style={{ width: 300 }}>
    <TreeSelect {...args} treeData={treeData} style={{ width: '100%' }} />
  </div>
);

InteractiveTreeSelect.args = {
  allowClear: true,
  disabled: false,
  multiple: false,
  placeholder: 'Please select',
  showSearch: true,
  size: 'middle',
  treeCheckable: false,
  treeDefaultExpandAll: true,
  treeLine: false,
  variant: 'outlined',
};

InteractiveTreeSelect.argTypes = {
  allowClear: {
    control: { type: 'boolean' },
    description: 'Whether to allow clearing the selected value.',
  },
  disabled: {
    control: { type: 'boolean' },
    description: 'Whether the component is disabled.',
  },
  multiple: {
    control: { type: 'boolean' },
    description: 'Whether to allow multiple selections.',
  },
  placeholder: {
    control: { type: 'text' },
    description: 'Placeholder text for the input field.',
  },
  showSearch: {
    control: { type: 'boolean' },
    description: 'Whether to show the search input.',
  },
  size: {
    control: { type: 'select' },
    options: ['large', 'middle', 'small'],
    description: 'Size of the component.',
  },
  treeCheckable: {
    control: { type: 'boolean' },
    description: 'Whether to show checkable tree nodes.',
  },
  treeDefaultExpandAll: {
    control: { type: 'boolean' },
    description: 'Whether to expand all tree nodes by default.',
  },
  treeLine: {
    control: { type: 'boolean' },
    description: 'Whether to show tree lines.',
  },
  variant: {
    control: { type: 'select' },
    options: ['outlined', 'borderless', 'filled'],
    description: 'Variant of the component.',
  },
  treeData: {
    table: { disable: true },
  },
};

InteractiveTreeSelect.parameters = {
  docs: {
    staticProps: {
      treeData: [
        {
          title: 'Node1',
          value: '0-0',
          children: [
            { title: 'Child Node1', value: '0-0-0' },
            { title: 'Child Node2', value: '0-0-1' },
          ],
        },
        {
          title: 'Node2',
          value: '0-1',
          children: [{ title: 'Child Node3', value: '0-1-0' }],
        },
      ],
    },
    liveExample: `function Demo() {
  const [value, setValue] = React.useState(undefined);
  const treeData = [
    {
      title: 'Databases',
      value: 'databases',
      children: [
        { title: 'PostgreSQL', value: 'postgres' },
        { title: 'MySQL', value: 'mysql' },
      ],
    },
    {
      title: 'Charts',
      value: 'charts',
      children: [
        { title: 'Bar Chart', value: 'bar' },
        { title: 'Line Chart', value: 'line' },
      ],
    },
  ];
  return (
    <TreeSelect
      style={{ width: 300 }}
      value={value}
      onChange={setValue}
      treeData={treeData}
      placeholder="Select an item"
      allowClear
      treeDefaultExpandAll
    />
  );
}`,
    examples: [
      {
        title: 'Multiple Selection with Checkboxes',
        code: `function MultiSelectTree() {
  const [value, setValue] = React.useState([]);
  const treeData = [
    {
      title: 'Databases',
      value: 'databases',
      children: [
        { title: 'PostgreSQL', value: 'postgres' },
        { title: 'MySQL', value: 'mysql' },
        { title: 'SQLite', value: 'sqlite' },
      ],
    },
    {
      title: 'File Formats',
      value: 'formats',
      children: [
        { title: 'CSV', value: 'csv' },
        { title: 'Excel', value: 'excel' },
      ],
    },
  ];
  return (
    <TreeSelect
      style={{ width: 300 }}
      value={value}
      onChange={setValue}
      treeData={treeData}
      treeCheckable
      placeholder="Select data sources"
      treeDefaultExpandAll
      allowClear
    />
  );
}`,
      },
      {
        title: 'With Tree Lines',
        code: `function TreeLinesDemo() {
  const treeData = [
    {
      title: 'Dashboards',
      value: 'dashboards',
      children: [
        { title: 'Sales Dashboard', value: 'sales' },
        { title: 'Marketing Dashboard', value: 'marketing' },
      ],
    },
    {
      title: 'Charts',
      value: 'charts',
      children: [
        { title: 'Revenue Chart', value: 'revenue' },
        { title: 'User Growth', value: 'growth' },
      ],
    },
  ];
  return (
    <TreeSelect
      style={{ width: 300 }}
      treeData={treeData}
      treeLine
      treeDefaultExpandAll
      placeholder="Browse items"
    />
  );
}`,
      },
    ],
  },
};

// Keep original for backwards compatibility
export const Default: Story = {
  args: {
    treeData,
  },
  render: (args: TreeSelectProps) => <TreeSelect {...args} />,
};
