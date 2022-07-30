// Button.stories.ts|tsx

import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import { Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { TableDataType, TableSize } from 'src/components/Table';
import ButtonCell from 'src/components/Table/cell-renderers/ButtonCell';
import TableCard from './index';

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
  title: 'Design System/Pattterns/Table Card',
  component: TableCard,
  parameters: {
    backgrounds: {
      values: [
        { name: 'red', value: '#f00' },
        { name: 'green', value: '#0f0' },
        { name: 'blue', value: '#00f' },
      ],
    },
  },
  decorators: [themeDecorator],
} as ComponentMeta<typeof TableCard>;

const clikerit = (message: string) => alert(`I waz Clicekd: ${message}`);

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
    cells[`col-${i}`] = `Col Value ${i}`;
  }
  return cells;
}

function generateColumns(amount: number): ColumnsType[] {
  const newCols: ColumnsType<ExampleData>[] = [];
  for (let i = 0; i < amount; i += 1) {
    newCols.push({
      title: `Col ${i}`,
      dataIndex: `col-${i}`,
      key: `col-${i}`,
      width: 75,
    });
  }
  return newCols;
}
const recordCount = 2000;
const columnCount = 35;
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
  },
  ...randomCols,
];

const baseData: ExampleData[] = [
  {
    key: 1,
    name: 'John Brown',
    age: 32,
    address: 'New York No. 1 Lake Park',
    ...generateValues(columnCount),
  },
  {
    key: 2,
    name: 'Jim Green',
    age: 42,
    address: 'London No. 1 Lake Park',
    ...generateValues(columnCount),
  },
  {
    key: 3,
    name: 'Joe Black',
    age: 32,
    address: 'Sidney No. 1 Lake Park',
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

export const Examples: ComponentStory<typeof TableCard> = args => (
  <ThemeProvider theme={supersetTheme}>
    <div>
      {/* <div style={{ width: '500px', height: '400px', overflow: 'scroll' }}> */}
      <TableCard {...args} />
      {/* </div> */}
    </div>
  </ThemeProvider>
);

Examples.args = {
  tableProps: {
    data: bigdata,
    columns,
    selectedRows: [1],
    handleRowSelection: (selection: React.Key[]) => {
      alert(selection);
    },
    size: TableSize.SMALL,
  },
  title: 'Example Table Card',
};
