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
import { StoryObj } from '@storybook/react';
import { Icons } from '@superset-ui/core/components/Icons';
import Tree, { TreeProps, type TreeDataNode } from './index';

export default {
  title: 'Components/Tree',
  component: Tree,
  parameters: {
    docs: {
      description: {
        component:
          'The Tree component is used to display hierarchical data in a tree structure. ' +
          'It allows for features such as selection, expansion, and drag-and-drop functionality.',
      },
    },
  },
};

const treeData: TreeDataNode[] = [
  {
    title: 'parent 1',
    key: '0-0',
    children: [
      {
        title: 'parent 1-0',
        key: '0-0-0',
        icon: <Icons.FileImageOutlined />,
        children: [
          {
            title: 'leaf',
            key: '0-0-0-0',
          },
          {
            title: 'leaf',
            key: '0-0-0-1',
          },
          {
            title: 'leaf',
            key: '0-0-0-2',
          },
        ],
      },
      {
        title: 'parent 1-1',
        key: '0-0-1',
        icon: <Icons.FileImageOutlined />,
        children: [
          {
            title: 'leaf',
            key: '0-0-1-0',
          },
        ],
      },
      {
        title: 'parent 1-2',
        key: '0-0-2',
        icon: <Icons.FileImageOutlined />,
        children: [
          {
            title: 'leaf',
            key: '0-0-2-0',
          },
          {
            title: 'leaf',
            key: '0-0-2-1',
          },
        ],
      },
    ],
  },
];

type Story = StoryObj<typeof Tree>;

export const TreeStory: Story = {
  args: {
    defaultExpandedKeys: ['0-0-0', '0-0-1'],
    defaultSelectedKeys: ['0-0-1'],
    treeData,
  },
  render: (args: TreeProps) => <Tree {...args} />,
};

// Interactive story with primitive args for documentation
export const InteractiveTree = (args: TreeProps) => <Tree {...args} treeData={treeData} />;

InteractiveTree.args = {
  checkable: false,
  defaultExpandAll: false,
  disabled: false,
  draggable: false,
  multiple: false,
  selectable: true,
  showIcon: false,
  showLine: false,
};

InteractiveTree.argTypes = {
  checkable: {
    description: 'Add a Checkbox before the treeNodes',
    control: { type: 'boolean' },
  },
  defaultExpandAll: {
    description: 'Whether to expand all treeNodes by default',
    control: { type: 'boolean' },
  },
  disabled: {
    description: 'Whether disabled the tree',
    control: { type: 'boolean' },
  },
  draggable: {
    description: 'Specifies whether this Tree or the node is draggable',
    control: { type: 'boolean' },
  },
  multiple: {
    description: 'Allows selecting multiple treeNodes',
    control: { type: 'boolean' },
  },
  selectable: {
    description: 'Whether can be selected',
    control: { type: 'boolean' },
  },
  showIcon: {
    description: 'Controls whether to display the icon node',
    control: { type: 'boolean' },
  },
  showLine: {
    description: 'Shows a connecting line',
    control: { type: 'boolean' },
  },
};

InteractiveTree.parameters = {
  docs: {
    staticProps: {
      treeData: [
        {
          title: 'parent 1',
          key: '0-0',
          children: [
            {
              title: 'parent 1-0',
              key: '0-0-0',
              children: [
                { title: 'leaf', key: '0-0-0-0' },
                { title: 'leaf', key: '0-0-0-1' },
                { title: 'leaf', key: '0-0-0-2' },
              ],
            },
            {
              title: 'parent 1-1',
              key: '0-0-1',
              children: [{ title: 'leaf', key: '0-0-1-0' }],
            },
            {
              title: 'parent 1-2',
              key: '0-0-2',
              children: [
                { title: 'leaf', key: '0-0-2-0' },
                { title: 'leaf', key: '0-0-2-1' },
              ],
            },
          ],
        },
      ],
      defaultExpandedKeys: ['0-0', '0-0-0'],
    },
    liveExample: `function Demo() {
  const treeData = [
    {
      title: 'Databases',
      key: 'databases',
      children: [
        { title: 'PostgreSQL', key: 'postgres' },
        { title: 'MySQL', key: 'mysql' },
        { title: 'SQLite', key: 'sqlite' },
      ],
    },
    {
      title: 'Charts',
      key: 'charts',
      children: [
        { title: 'Bar Chart', key: 'bar' },
        { title: 'Line Chart', key: 'line' },
        { title: 'Pie Chart', key: 'pie' },
      ],
    },
  ];
  return <Tree treeData={treeData} defaultExpandAll />;
}`,
    examples: [
      {
        title: 'Checkable Tree',
        code: `function CheckableTree() {
  const [checkedKeys, setCheckedKeys] = React.useState(['postgres']);
  const treeData = [
    {
      title: 'Databases',
      key: 'databases',
      children: [
        { title: 'PostgreSQL', key: 'postgres' },
        { title: 'MySQL', key: 'mysql' },
      ],
    },
    {
      title: 'Charts',
      key: 'charts',
      children: [
        { title: 'Bar Chart', key: 'bar' },
        { title: 'Line Chart', key: 'line' },
      ],
    },
  ];
  return (
    <Tree
      treeData={treeData}
      checkable
      defaultExpandAll
      checkedKeys={checkedKeys}
      onCheck={setCheckedKeys}
    />
  );
}`,
      },
      {
        title: 'With Lines and Icons',
        code: `function LinesAndIcons() {
  const treeData = [
    {
      title: 'Dashboards',
      key: 'dashboards',
      children: [
        { title: 'Sales Dashboard', key: 'sales' },
        { title: 'Marketing Dashboard', key: 'marketing' },
      ],
    },
    {
      title: 'Reports',
      key: 'reports',
      children: [
        { title: 'Weekly Report', key: 'weekly' },
        { title: 'Monthly Report', key: 'monthly' },
      ],
    },
  ];
  return <Tree treeData={treeData} showLine showIcon defaultExpandAll />;
}`,
      },
    ],
  },
};
