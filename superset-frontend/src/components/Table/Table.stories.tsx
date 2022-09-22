// Button.stories.ts|tsx

import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import { InfoCircleOutlined } from '@ant-design/icons';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import {
  Table,
  TableDataType,
  TableSize,
  Column,
  SUPERSET_TABLE_COLUMN,
} from './index';
import { numericalSort, alphabeticalSort } from './sorters';
import ButtonCell from './cell-renderers/ButtonCell';
import ActionCell from './cell-renderers/ActionCell';
import { exampleMenuOptions } from './cell-renderers/ActionCell/ActionCell.stories';
import NumericCell, {
  CurrencyCode,
  LocaleCode,
  Style,
} from './cell-renderers/NumericCell';

export default {
  title: 'Design System/Components/Table/Examples',
  component: Table,
} as ComponentMeta<typeof Table>;

// eslint-disable-next-line no-alert
const handleClick = (message: string) => alert(`I was Clicked: ${message}`);

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

function generateColumns(amount: number): Column[] {
  const newCols: Column[] = [];
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
const randomCols: Columns[] = generateColumns(columnCount);

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

const basicColumns: Columns[] = [
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
    sorter: (a: BasicData, b: BasicData) => alphabeticalSort('dataType', a, b),
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
    render: (text: string) => <ButtonCell label={text} onClick={handleClick} />,
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

function handlers(record: object, rowIndex: number) {
  return {
    onClick: (event: MouseEvent) => {
      // eslint-disable-next-line no-alert
      alert(`Double Click, row:  ${rowIndex}`);
    }, // click row
    onDoubleClick: (event: MouseEvent) => {
      // eslint-disable-next-line no-alert
      alert(`Double Click, row:  ${rowIndex}`);
    }, // double click row
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
      // eslint-disable-next-line no-alert
      alert(`Context Menu, row:  ${rowIndex}`);
    }, // right button click row
    onMouseEnter: (event: MouseEvent) => {
      // eslint-disable-next-line no-console
      console.log(
        `Mouse Enter, row:  ${rowIndex}, record: ${JSON.stringify(record)}`,
      );
    }, // mouse enter row
    onMouseLeave: (event: MouseEvent) => {
      // eslint-disable-next-line no-console
      console.log(`Mouse Leave, row:  ${rowIndex}`);
    }, // mouse leave row
  };
}

Basic.args = {
  data: basicData,
  columns: basicColumns,
  selectedRows: [1],
  handleRowSelection: (selection: React.Key[]) => {
    // eslint-disable-next-line no-alert
    alert(selection);
  },
  size: TableSize.SMALL,
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

export const ResizableColumns: ComponentStory<typeof Table> = args => (
  <ThemeProvider theme={supersetTheme}>
    <div>
      <Table {...args} />
    </div>
  </ThemeProvider>
);

ResizableColumns.args = {
  data: basicData,
  columns: basicColumns,
  selectedRows: [1],
  handleRowSelection: (selection: React.Key[]) => {
    alert(selection);
  },
  size: TableSize.SMALL,
  resizable: true,
};

const dragOver = (ev: DragEvent) => {
  ev.preventDefault();
  const element: HTMLElement | null = ev?.currentTarget as HTMLElement;
  if (element?.style) {
    element.style.border = '1px dashed green';
  }
};

const dragOut = (ev: DragEvent) => {
  ev.preventDefault();
  const element: HTMLElement | null = ev?.currentTarget as HTMLElement;
  if (element?.style) {
    element.style.border = '1px solid grey';
  }
};

const dragDrop = (ev: DragEvent) => {
  const data = ev.dataTransfer?.getData?.(SUPERSET_TABLE_COLUMN);
  const element: HTMLElement | null = ev?.currentTarget as HTMLElement;
  if (element?.style) {
    element.style.border = '1px solid grey';
  }
  // eslint-disable-next-line no-alert
  alert(data);
};

export const ReorderableColumns: ComponentStory<typeof Table> = args => (
  <ThemeProvider theme={supersetTheme}>
    <div>
      <div
        onDragOver={(ev: DragEvent) => dragOver(ev)}
        onDragLeave={(ev: DragEvent) => dragOut(ev)}
        onDrop={(ev: DragEvent) => dragDrop(ev)}
        style={{
          width: '100%',
          height: '40px',
          border: '1px solid grey',
          marginBottom: '8px',
          padding: '8px',
          borderRadius: '4px',
        }}
      >
        Drop column here...
      </div>
      <Table {...args} />
    </div>
  </ThemeProvider>
);

ReorderableColumns.args = {
  data: basicData,
  columns: basicColumns,
  selectedRows: [1],
  handleRowSelection: (selection: React.Key[]) => {
    // eslint-disable-next-line no-alert
    alert(selection);
  },
  size: TableSize.SMALL,
  reorderable: true,
};

const rendererColumns: Columns[] = [
  {
    title: 'Button Cell',
    dataIndex: 'buttonCell',
    key: 'buttonCell',
    width: 150,
    render: (text: string, data: object, index: number) => (
      <ButtonCell
        label={text}
        data={data}
        index={index}
        onClick={(data: object, index: number) =>
          // eslint-disable-next-line no-alert
          alert(`Cell was clicked: row ${index}, data: ${JSON.stringify(data)}`)
        }
      />
    ),
  },
  {
    title: 'Text Cell',
    dataIndex: 'textCell',
    key: 'textCell',
    sorter: (a: BasicData, b: BasicData) => alphabeticalSort('textCell', a, b),
  },
  {
    title: 'Euro Cell',
    dataIndex: 'euroCell',
    key: 'euroCell',
    sorter: (a: BasicData, b: BasicData) => numericalSort('euroCell', a, b),
    render: (value: number) => (
      <NumericCell
        options={{ style: Style.CURRENCY, currency: CurrencyCode.EUR }}
        value={value}
        locale={LocaleCode.en_US}
      />
    ),
  },
  {
    title: 'Dollar Cell',
    dataIndex: 'dollarCell',
    key: 'dollarCell',
    sorter: (a: BasicData, b: BasicData) => numericalSort('dollarCell', a, b),
    render: (value: number) => (
      <NumericCell
        options={{ style: Style.CURRENCY, currency: CurrencyCode.USD }}
        value={value}
        locale={LocaleCode.en_US}
      />
    ),
  },
  {
    title: 'Action Cell',
    dataIndex: 'actions',
    key: 'actions',
    render: () => <ActionCell menuOptions={exampleMenuOptions} />,
  },
];

const rendererData: BasicData[] = [
  {
    key: 1,
    buttonCell: 'Click Me',
    columnType: 'Some text',
    euroCell: 45.5,
    dollarCell: 45.5,
    actions: ['Action 1', 'Action 2'],
  },
  {
    key: 2,
    buttonCell: 'I am a button',
    textCell: 'More text',
    euroCell: 1700,
    dollarCell: 1700,
    actions: ['Action 1', 'Action 2'],
  },
  {
    key: 3,
    buttonCell: 'Button 3',
    textCell: 'The third string of text',
    euroCell: 500.567,
    dollarCell: 500.567,
    actions: ['Action 1', 'Action 2'],
  },
];

export const CellRenderers: ComponentStory<typeof Table> = args => (
  <ThemeProvider theme={supersetTheme}>
    <div>
      <Table {...args} />
    </div>
  </ThemeProvider>
);

CellRenderers.args = {
  data: rendererData,
  columns: rendererColumns,
  selectedRows: [1],
  handleRowSelection: (selection: React.Key[]) => {
    alert(selection);
  },
  size: TableSize.SMALL,
  reorderable: true,
};
