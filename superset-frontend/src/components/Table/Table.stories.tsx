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
import React, { useState } from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { Table, TableSize, SUPERSET_TABLE_COLUMN, ColumnsType } from './index';
import { numericalSort, alphabeticalSort } from './sorters';
import ButtonCell from './cell-renderers/ButtonCell';
import ActionCell from './cell-renderers/ActionCell';
import { exampleMenuOptions } from './cell-renderers/ActionCell/fixtures';
import NumericCell, {
  CurrencyCode,
  LocaleCode,
  Style,
} from './cell-renderers/NumericCell';

export default {
  title: 'Design System/Components/Table/Examples',
  component: Table,
  argTypes: { onClick: { action: 'clicked' } },
} as ComponentMeta<typeof Table>;

export interface BasicData {
  name: string;
  category: string;
  price: number;
  description?: string;
  key: number;
}

export interface RendererData {
  key: number;
  buttonCell: string;
  textCell: string;
  euroCell: number;
  dollarCell: number;
}

export interface ExampleData {
  title: string;
  name: string;
  age: number;
  address: string;
  tags?: string[];
  key: number;
}

function generateValues(amount: number): object {
  const cells = {};
  for (let i = 0; i < amount; i += 1) {
    cells[`col-${i}`] = `Text ${i}`;
  }
  return cells;
}

function generateColumns(amount: number): ColumnsType<ExampleData>[] {
  const newCols: any[] = [];
  for (let i = 0; i < amount; i += 1) {
    newCols.push({
      title: `Column Header ${i}`,
      dataIndex: `col-${i}`,
      key: `col-${i}`,
    });
  }
  return newCols as ColumnsType<ExampleData>[];
}
const recordCount = 200;
const columnCount = 12;
const randomCols: ColumnsType<ExampleData>[] = generateColumns(columnCount);

const basicData: BasicData[] = [
  {
    key: 1,
    name: 'Floppy Disk 10 pack',
    category: 'Disk Storage',
    price: 9.99,
    description: 'A real blast from the past',
  },
  {
    key: 2,
    name: 'DVD 100 pack',
    category: 'Optical Storage',
    price: 27.99,
    description: 'Still pretty ancient',
  },
  {
    key: 3,
    name: '128 GB SSD',
    category: 'Hardrive',
    price: 49.99,
    description: 'Reliable and fast data storage',
  },
];

const basicColumns: ColumnsType<BasicData> = [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    width: 150,
    sorter: (a: BasicData, b: BasicData) => alphabeticalSort('name', a, b),
  },
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
    sorter: (a: BasicData, b: BasicData) => alphabeticalSort('category', a, b),
  },
  {
    title: 'Price',
    dataIndex: 'price',
    key: 'price',
    sorter: (a: BasicData, b: BasicData) => numericalSort('price', a, b),
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
  },
];

const bigColumns: ColumnsType<ExampleData> = [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    render: (text: string, row: object, index: number) => (
      <ButtonCell
        label={text}
        onClick={action('button-cell-click')}
        row={row}
        index={index}
      />
    ),
    width: 150,
  },
  {
    title: 'Age',
    dataIndex: 'age',
    key: 'age',
  },
  {
    title: 'Address',
    dataIndex: 'address',
    key: 'address',
  },
  ...(randomCols as ColumnsType<ExampleData>),
];

const rendererColumns: ColumnsType<RendererData> = [
  {
    title: 'Button Cell',
    dataIndex: 'buttonCell',
    key: 'buttonCell',
    width: 150,
    render: (text: string, data: object, index: number) => (
      <ButtonCell
        label={text}
        row={data}
        index={index}
        onClick={action('button-cell-click')}
      />
    ),
  },
  {
    title: 'Text Cell',
    dataIndex: 'textCell',
    key: 'textCell',
  },
  {
    title: 'Euro Cell',
    dataIndex: 'euroCell',
    key: 'euroCell',
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
    render: (value: number) => (
      <NumericCell
        options={{ style: Style.CURRENCY, currency: CurrencyCode.USD }}
        value={value}
        locale={LocaleCode.en_US}
      />
    ),
  },
  {
    dataIndex: 'actions',
    key: 'actions',
    render: (text: string, row: object) => (
      <ActionCell row={row} menuOptions={exampleMenuOptions} />
    ),
    width: 32,
    fixed: 'right',
  },
];

const baseData: any[] = [
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

const bigdata: any[] = [];
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
    onClick: action(
      `row onClick, row:  ${rowIndex}, record: ${JSON.stringify(record)}`,
    ), // click row
    onDoubleClick: action(
      `row onDoubleClick, row:  ${rowIndex}, record: ${JSON.stringify(record)}`,
    ), // double click row
    onContextMenu: action(
      `row onContextMenu, row:  ${rowIndex}, record: ${JSON.stringify(record)}`,
    ), // right button click row
    onMouseEnter: action(`Mouse Enter, row:  ${rowIndex}`), // mouse enter row
    onMouseLeave: action(`Mouse Leave, row:  ${rowIndex}`), // mouse leave row
  };
}

Basic.args = {
  data: basicData,
  columns: basicColumns,
  size: TableSize.SMALL,
  onRow: handlers,
  pageSizeOptions: ['5', '10', '15', '20', '25'],
  defaultPageSize: 10,
};

export const ManyColumns: ComponentStory<typeof Table> = args => (
  <ThemeProvider theme={supersetTheme}>
    <div style={{ height: '350px' }}>
      <Table {...args} />
    </div>
  </ThemeProvider>
);

ManyColumns.args = {
  data: bigdata,
  columns: bigColumns,
  size: TableSize.SMALL,
  resizable: true,
  reorderable: true,
  height: 350,
};

export const Loading: ComponentStory<typeof Table> = args => (
  <ThemeProvider theme={supersetTheme}>
    <Table {...args} />
  </ThemeProvider>
);

Loading.args = {
  data: basicData,
  columns: basicColumns,
  size: TableSize.SMALL,
  loading: true,
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
  size: TableSize.SMALL,
  resizable: true,
};

export const ReorderableColumns: ComponentStory<typeof Table> = args => {
  const [droppedItem, setDroppedItem] = useState<string | undefined>();
  const dragOver = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const element: HTMLElement | null = ev?.currentTarget as HTMLElement;
    if (element?.style) {
      element.style.border = '1px dashed green';
    }
  };

  const dragOut = (ev: React.DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const element: HTMLElement | null = ev?.currentTarget as HTMLElement;
    if (element?.style) {
      element.style.border = '1px solid grey';
    }
  };

  const dragDrop = (ev: React.DragEvent<HTMLDivElement>) => {
    const data = ev.dataTransfer?.getData?.(SUPERSET_TABLE_COLUMN);
    const element: HTMLElement | null = ev?.currentTarget as HTMLElement;
    if (element?.style) {
      element.style.border = '1px solid grey';
    }
    setDroppedItem(data);
  };
  return (
    <ThemeProvider theme={supersetTheme}>
      <div>
        <div
          onDragOver={(ev: React.DragEvent<HTMLDivElement>) => dragOver(ev)}
          onDragLeave={(ev: React.DragEvent<HTMLDivElement>) => dragOut(ev)}
          onDrop={(ev: React.DragEvent<HTMLDivElement>) => dragDrop(ev)}
          style={{
            width: '100%',
            height: '40px',
            border: '1px solid grey',
            marginBottom: '8px',
            padding: '8px',
            borderRadius: '4px',
          }}
        >
          {droppedItem ?? 'Drop column here...'}
        </div>
        <Table {...args} />
      </div>
    </ThemeProvider>
  );
};

ReorderableColumns.args = {
  data: basicData,
  columns: basicColumns,
  size: TableSize.SMALL,
  reorderable: true,
};

const rendererData: RendererData[] = [
  {
    key: 1,
    buttonCell: 'Click Me',
    textCell: 'Some text',
    euroCell: 45.5,
    dollarCell: 45.5,
  },
  {
    key: 2,
    buttonCell: 'I am a button',
    textCell: 'More text',
    euroCell: 1700,
    dollarCell: 1700,
  },
  {
    key: 3,
    buttonCell: 'Button 3',
    textCell: 'The third string of text',
    euroCell: 500.567,
    dollarCell: 500.567,
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
  size: TableSize.SMALL,
  reorderable: true,
};
