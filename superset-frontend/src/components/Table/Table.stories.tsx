// Button.stories.ts|tsx

import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import type { ColumnsType } from 'antd/es/table';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { Table, TableDataType, TableSize } from './index';
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

const columns: ColumnsType[] = [
  {
    title: 'Name',
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

const exampleString = `
export interface ExampleData extends TableDataType {
  name: string;
  age: number;
  address: string;
  tags?: string[];
  title?: string;
}

const randomCols: ColumnsType[] = generateColumns(columnCount);

const columns: ColumnsType[] = [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    render: (text: string) => (
      <ButtonCell label={text} handleClick={clikerit} />
    ),
    width: 50,
  },
  {
    title: 'Age of Ultron',
    dataIndex: 'age',
    key: 'age',
    width: 150,
    sorter: (a: object, b: object) => a.age - b.age,
  },
  {
    title: 'Address',
    dataIndex: 'address',
    key: 'address',
  },
  {
    title: 'Tags',
    key: 'tags',
    dataIndex: 'tags',
    render: TagRenderer,
  },
];

const baseData: ExampleData[] = [
  {
    key: 1,
    name: 'John Brown',
    age: 32,
    address: 'New York No. 1 Lake Park',
    tags: ['nice', 'developer'],
  },
  {
    key: 2,
    name: 'Jim Green',
    age: 42,
    address: 'London No. 1 Lake Park',
    tags: ['loser'],
  },
  {
    key: 3,
    name: 'Joe Black',
    age: 32,
    address: 'Sidney No. 1 Lake Park',
    tags: ['cool', 'teacher'],
  },
];

<Table data={baseData} columns />
`;

export const Basic: ComponentStory<typeof Table> = args => (
  <ThemeProvider theme={supersetTheme}>
    <div>
      <Table {...args} />
    </div>
  </ThemeProvider>
);

Basic.args = {
  data: bigdata,
  columns,
  selectedRows: [1],
  handleRowSelection: (selection: React.Key[]) => {
    alert(selection);
  },
  size: TableSize.SMALL,
};
