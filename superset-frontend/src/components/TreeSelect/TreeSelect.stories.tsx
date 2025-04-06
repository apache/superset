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
import TreeSelect from '.';

const meta: Meta<typeof TreeSelect> = {
  title: 'Components/TreeSelect',
  component: TreeSelect,
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'text' },
    treeData: { control: 'object' },
    treeCheckable: { control: 'boolean' },
    showCheckedStrategy: {
      control: 'select',
      options: ['SHOW_CHILD', 'SHOW_PARENT', 'SHOW_ALL'],
    },
    placeholder: { control: 'text' },
    allowClear: { control: 'boolean' },
    autoClearSearchValue: { control: 'boolean' },
    defaultValue: { control: 'text' },
    disabled: { control: 'boolean' },
    popupClassName: { control: 'text' },
    popupMatchSelectWidth: { control: 'boolean' },
    dropdownRender: { control: 'text' },
    dropdownStyle: { control: 'object' },
    fieldNames: { control: 'object' },
    filterTreeNode: { control: 'boolean' },
    labelInValue: { control: 'boolean' },
    listHeight: { control: 'number' },
    maxTagCount: { control: 'number' },
    maxCount: { control: 'number' },
    maxTagPlaceholder: { control: 'text' },
    maxTagTextLength: { control: 'number' },
    multiple: { control: 'boolean' },
    notFoundContent: { control: 'text' },
    placement: {
      control: 'select',
      options: ['bottomLeft', 'bottomRight', 'topLeft', 'topRight'],
    },
    prefix: { control: 'text' },
    searchValue: { control: 'text' },
    size: { control: 'select', options: ['large', 'middle', 'small'] },
    status: { control: 'select', options: ['error', 'warning'] },
    suffixIcon: { control: 'text' },
    switcherIcon: { control: 'text' },
    treeCheckStrictly: { control: 'boolean' },
    treeDataSimpleMode: { control: 'boolean' },
    treeDefaultExpandAll: { control: 'boolean' },
    treeExpandAction: {
      control: 'select',
      options: [false, 'click', 'doubleClick'],
    },
    treeIcon: { control: 'boolean' },
    treeLine: { control: 'boolean' },
    treeNodeFilterProp: { control: 'text' },
    treeNodeLabelProp: { control: 'text' },
    variant: {
      control: 'select',
      options: ['outlined', 'borderless', 'filled', 'underlined'],
    },
    virtual: { control: 'boolean' },
    onChange: { action: 'onChange' },
    onDropdownVisibleChange: { action: 'onDropdownVisibleChange' },
    onSearch: { action: 'onSearch' },
    onSelect: { action: 'onSelect' },
    onTreeExpand: { action: 'onTreeExpand' },
    onPopupScroll: { action: 'onPopupScroll' },
  },
};

export default meta;

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
};

export const PreselectedValues: Story = {
  args: {
    value: ['0-0'],
    treeData,
    treeCheckable: true,
    showCheckedStrategy: TreeSelect.SHOW_PARENT,
    placeholder: 'Please select',
    disabled: false,
  },
};
