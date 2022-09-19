// Button.stories.ts|tsx

import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import type { ColumnsType } from 'antd/es/table';
import { InfoCircleOutlined } from '@ant-design/icons';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { Table, TableDataType, TableSize, Column } from './index';
import { numericalSort, alphabeticalSort } from './sorters';
import ButtonCell from './cell-renderers/ButtonCell';

const themeDecorator = Story => (
  <ThemeProvider theme={supersetTheme}>
    <Story />
  </ThemeProvider>
);

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/react/configure/overview#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Components/Table/Examples',
  component: Table,
  decorators: [themeDecorator],
} as ComponentMeta<typeof Table>;

const clikerit = (message: string) => alert(`I was Clicked: ${message}`);

export interface BasicData extends TableDataType {
  columnName: string;
  columnType: string;
  dataType: string;
  actions?: string[];
}

export interface ExampleData extends TableDataType {
  name: string;
  age: number;
  address: string;
  tags?: string[];
  title?: string;
}

function generateValues(amount: number): object {
  const cells = {};
  for (let i = 0; i < amount; i += 1) {
    cells[`col-${i}`] = `Text ${i}`;
  }
  return cells;
}

function generateColumns(amount: number): ColumnsType[] {
  const newCols: ColumnsType<ExampleData>[] = [];
  for (let i = 0; i < amount; i += 1) {
    newCols.push({
      title: `Column Header ${i}`,
      dataIndex: `col-${i}`,
      key: `col-${i}`,
    });
  }
  return newCols;
}
const recordCount = 200;
const columnCount = 12;
const randomCols: ColumnsType[] = generateColumns(columnCount);

const basicData: BasicData[] = [
  {
    key: 1,
    columnName: 'Column Name 1',
    columnType: 'Physical',
    dataType: 'string',
    actions: ['Action 1', 'Action 2'],
  },
  {
    key: 2,
    columnName: { name: 'Column Name 2' },
    columnType: 'Physical',
    dataType: 'int',
    actions: ['Action 1', 'Action 2'],
  },
  {
    key: 3,
    columnName: 'Column Name 3',
    columnType: 'Virtual',
    dataType: 'date',
    actions: ['Action 1', 'Action 2'],
  },
];

const basicColumns: ColumnsType[] = [
  {
    title: 'Column Name',
    dataIndex: 'columnName',
    key: 'columnName',
    width: 150,
    sorter: (a: BasicData, b: BasicData) =>
      alphabeticalSort('columnName', a, b),
  },
  {
    title: 'Column Type',
    dataIndex: 'columnType',
    key: 'columnType',
    sorter: (a: BasicData, b: BasicData) =>
      alphabeticalSort('columnType', a, b),
  },
  {
    title: 'Data Type',
    dataIndex: 'dataType',
    key: 'dataType',
    sorter: (a: BasicData, b: BasicData) => numericalSort('dataType', a, b),
  },
  {
    title: 'Actions',
    dataIndex: 'actions',
    key: 'actions',
  },
];

const bigColumns: Column[] = [
  {
    title: () => {
      const fruitcake = Date.now();
      return (
        <div style={{ color: 'red' }}>
          <InfoCircleOutlined />
          Name {fruitcake}
        </div>
      );
    },
    dataIndex: 'name',
    key: 'name',
    render: (text: string) => (
      <ButtonCell label={text} handleClick={clikerit} />
    ),
    width: 150,
  },
  {
    title: 'Age',
    dataIndex: 'age',
    key: 'age',
    sorter: (a: object, b: object) => a.age - b.age,
  },
  {
    title: 'Address',
    dataIndex: 'address',
    key: 'address',
  },
  ...randomCols,
];

const baseData: ExampleData[] = [
  {
    key: 1,
    name: 'John Brown',
    age: 32,
    address: 'New York No. 1 Lake Park',
    tags: ['nice', 'developer'],
    ...generateValues(columnCount),
  },
  {
    key: 2,
    name: 'Jim Green',
    age: 42,
    address: 'London No. 1 Lake Park',
    tags: ['loser'],
    ...generateValues(columnCount),
  },
  {
    key: 3,
    name: 'Joe Black',
    age: 32,
    address: 'Sidney No. 1 Lake Park',
    tags: ['cool', 'teacher'],
    ...generateValues(columnCount),
  },
];

const bigdata: ExampleData[] = [];
for (let i = 0; i < recordCount; i += 1) {
  bigdata.push({
    key: i + baseData.length,
    name: `Dynamic record ${i}`,
    age: 32 + i,
    address: `DynamoCity, Dynamic Lane no. ${i}`,
    ...generateValues(columnCount),
  });
}

export const Basic: ComponentStory<typeof Table> = args => (
  <ThemeProvider theme={supersetTheme}>
    <div>
      <Table {...args} />
    </div>
  </ThemeProvider>
);

function handlers(record, rowIndex) {
  return {
    onClick: event => {
      alert('Click', rowIndex);
    }, // click row
    onDoubleClick: event => {
      alert('Double Click', rowIndex);
    }, // double click row
    onContextMenu: event => {
      event.preventDefault();
      alert('Context Menu', rowIndex);
    }, // right button click row
    onMouseEnter: event => {}, // mouse enter row
    onMouseLeave: event => {}, // mouse leave row
  };
}

Basic.args = {
  data: basicData,
  columns: basicColumns,
  selectedRows: [1],
  handleRowSelection: (selection: React.Key[]) => {
    alert(selection);
  },
  size: TableSize.SMALL,
  showSorterTooltip: false,
  reorderable: true,
  onRow: handlers,
  pageSizeOptions: [5, 10, 15, 20, 25],
  defaultPageSize: 10,
};

export const ManyColumns: ComponentStory<typeof Table> = args => (
  <ThemeProvider theme={supersetTheme}>
    <div>
      <Table {...args} />
    </div>
  </ThemeProvider>
);

ManyColumns.args = {
  data: bigdata,
  columns: bigColumns,
  selectedRows: [1],
  handleRowSelection: (selection: React.Key[]) => {
    alert(selection);
  },
  size: TableSize.SMALL,
};
