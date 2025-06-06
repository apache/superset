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
import { Icons } from '@superset-ui/core/components/Icons';
import Tree, { TreeProps, type TreeDataNode } from './index';

const meta = {
  title: 'Components/Tree',
  component: Tree,
  argTypes: {
    autoExpandParent: {
      control: 'boolean',
      description: 'Whether to automatically expand a parent treeNode	',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    checkable: {
      control: 'boolean',
      description: 'Add a Checkbox before the treeNodes',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    checkStrictly: {
      control: 'boolean',
      description:
        'Check treeNode precisely; parent treeNode and children treeNodes are not associated',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    defaultExpandAll: {
      control: 'boolean',
      description: 'Whether to expand all treeNodes by default',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    defaultExpandParent: {
      control: 'boolean',
      description: 'If auto expand parent treeNodes when init	',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Whether disabled the tree',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    draggable: {
      control: 'boolean',
      description:
        'Specifies whether this Tree or the node is draggable. Use icon: false to disable drag handler icon',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    height: {
      control: 'number',
      description:
        'Config virtual scroll height. Will not support horizontal scroll when enable this',
      table: {
        category: 'Tree',
        type: { summary: 'number' },
      },
    },
    multiple: {
      control: 'boolean',
      description: 'Allows selecting multiple treeNodes	',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    selectable: {
      control: 'boolean',
      description: 'Whether can be selected',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    showIcon: {
      control: 'boolean',
      description:
        'Controls whether to display the icon node, no default style',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    showLine: {
      control: 'boolean',
      description: 'Shows a connecting line',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    virtual: {
      control: 'boolean',
      description: 'Disable virtual scroll when set to false',
      table: {
        category: 'Tree',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // Exclude unwanted properties
    defaultExpandedKeys: {
      table: {
        disable: true,
      },
    },
    defaultSelectedKeys: {
      table: {
        disable: true,
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
          'The Tree component is used to display hierarchical data in a tree structure. It allows for features such as selection, expansion, and drag-and-drop functionality.',
      },
    },
  },
} as Meta<typeof Tree>;

export default meta;

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
