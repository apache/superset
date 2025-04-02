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
import { Icons } from 'src/components/Icons';
import Tree, { TreeProps } from './index';
import type { TreeDataNode } from './index';

const meta = {
  title: 'Components/Tree',
  component: Tree,
  argTypes: {
    autoExpandParent: {
      control: { type: 'boolean' },
      description: 'Whether to automatically expand a parent treeNode',
    },
    defaultExpandAll: {
      control: { type: 'boolean' },
      description: 'Whether to expand all treeNodes by default',
    },
    multiple: {
      control: { type: 'boolean' },
      description: 'Allows selecting multiple treeNodes',
    },
    checkable: {
      control: { type: 'boolean' },
      desciption: 'Add a Checkbox before the treeNodes',
    },
    selectable: {
      control: { type: 'boolean' },
      descrtiption: 'Whether can be selected',
    },
    draggable: {
      control: { type: 'boolean' },
      description:
        'Specifies whether this Tree or the node is draggable. Use icon: false to disable drag handler icon',
    },
    showLine: {
      control: { type: 'boolean' },
      description: 'Shows a connecting line',
    },
    blockNode: {
      control: { type: 'boolean' },
      description: 'Whether treeNode fill remaining horizontal space',
    },
    checkStrictly: {
      control: { type: 'boolean' },
      description:
        'Check treeNode precisely; parent treeNode and children treeNodes are not associated',
    },
    defaultExpandParent: {
      control: { type: 'boolean' },
      description: 'If auto expand parent treeNodes when init',
    },
    showIcon: {
      control: { type: 'boolean' },
      description:
        'Controls whether to display the icon node, no default style',
    },
    virtual: {
      control: { type: 'boolean' },
      description: 'Disable virtual scroll when set to false',
    },
    titleRender: {
      control: { type: 'text' },
      description: 'Customize the title of the treeNode',
    },
    switcherLoadingIcon: {
      control: { type: 'text' },
      description: 'Customize the loading icon',
    },
    switcherIcon: {
      control: { type: 'boolean' },
      description: 'Customize the switcher icon',
    },
    treeData: { control: { type: 'object' }, description: 'TreeNodes data' },
    loadData: {
      control: { type: 'object' },
      description: 'Load data asynchronously',
    },
    defaultExpandedKeys: {
      control: { type: 'object' },
      description: 'Default expanded treeNodes',
    },
    defaultSelectedKeys: {
      control: { type: 'object' },
      description: 'Default selected treeNodes',
    },
    parameters: {
      docs: {
        description: {
          component: 'Tree component for Multiple-level structure list.',
        },
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
    multiple: false,
    checkable: false,
    selectable: true,
    draggable: false,
    showLine: false,
    blockNode: true,
    defaultExpandAll: false,
    checkStrictly: false,
    defaultExpandParent: false,
    showIcon: false,
    autoExpandParent: true,
    defaultExpandedKeys: ['0-0-0', '0-0-1'],
    defaultSelectedKeys: ['0-0-1'],
    treeData,
  },
  render: (args: TreeProps) => <Tree {...args} />,
};
