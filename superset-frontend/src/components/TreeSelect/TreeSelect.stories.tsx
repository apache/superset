import { Meta, StoryObj } from '@storybook/react';
import Icons from 'src/components/Icons';
import TreeSelect from '.';

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

export const Default: Story = {
  args: {
    value: undefined,
    treeData,
    treeCheckable: false,
    showCheckedStrategy: TreeSelect.SHOW_CHILD,
    placeholder: 'Please select',
    allowClear: false,
    autoClearSearchValue: false,
    defaultValue: undefined,
    disabled: false,
    popupClassName: '',
    popupMatchSelectWidth: true,
    dropdownRender: undefined,
    dropdownStyle: {},
    fieldNames: { label: 'title', value: 'value', children: 'children' },
    filterTreeNode: true,
    getPopupContainer: () => document.body,
    labelInValue: false,
    listHeight: 600,
    loadData: undefined,
    maxTagCount: 'responsive',
    maxCount: undefined,
    maxTagPlaceholder: undefined,
    maxTagTextLength: 20,
    multiple: false,
    notFoundContent: 'Not Found',
    placement: 'bottomLeft',
    prefix: undefined,
    searchValue: '',
    size: 'middle',
    status: undefined,
    suffixIcon: <Icons.DownOutlined iconSize="xs" />,
    switcherIcon: undefined,
    tagRender: undefined,
    treeCheckStrictly: false,
    treeDataSimpleMode: false,
    treeTitleRender: undefined,
    treeDefaultExpandAll: false,
    treeDefaultExpandedKeys: [],
    treeExpandAction: false,
    treeExpandedKeys: [],
    treeIcon: false,
    treeLoadedKeys: [],
    treeLine: false,
    treeNodeFilterProp: 'value',
    treeNodeLabelProp: 'title',
    variant: 'outlined',
    virtual: true,
    onChange: undefined,
    onDropdownVisibleChange: undefined,
    onSearch: undefined,
    onSelect: undefined,
    onTreeExpand: undefined,
    onPopupScroll: undefined,
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
