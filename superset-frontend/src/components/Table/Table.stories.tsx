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
import { useState, DragEvent } from 'react';

import type { Meta, StoryFn } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import {
  ColumnsType,
  ETableAction,
  OnChangeFunction,
  SUPERSET_TABLE_COLUMN,
  Table,
  TableSize,
} from './index';
import { alphabeticalSort, numericalSort } from './sorters';
import ButtonCell from './cell-renderers/ButtonCell';
import ActionCell from './cell-renderers/ActionCell';
import { exampleMenuOptions } from './cell-renderers/ActionCell/fixtures';
import NumericCell, {
  CurrencyCode,
  LocaleCode,
  Style,
} from './cell-renderers/NumericCell';
import HeaderWithRadioGroup from './header-renderers/HeaderWithRadioGroup';
import TimeCell from './cell-renderers/TimeCell';

export default {
  title: 'Design System/Components/Table/Examples',
  component: Table,
  argTypes: { onClick: { action: 'clicked' } },
} as Meta<typeof Table>;

interface BasicData {
  name: string;
  category: string;
  price: number;
  description?: string;
  key: number;
}

interface RendererData {
  key: number;
  buttonCell: string;
  textCell: string;
  euroCell: number;
  dollarCell: number;
}

interface ExampleData {
  title: string;
  name: string;
  age: number;
  address: string;
  tags?: string[];
  key: number;
}

function generateValues(amount: number, row = 0): Record<string, number> {
  const cells: Record<string, number> = {};
  for (let i = 0; i < amount; i += 1) {
    cells[`col-${i}`] = i * row * 0.75;
  }
  return cells;
}

function generateColumns(amount: number): ColumnsType<ExampleData>[] {
  const newCols: any[] = [];
  for (let i = 0; i < amount; i += 1) {
    newCols.push({
      title: `C${i}`,
      dataIndex: `col-${i}`,
      key: `col-${i}`,
      width: 90,
      render: (value: number) => (
        <NumericCell
          options={{ style: Style.Currency, currency: CurrencyCode.EUR }}
          value={value}
          locale={LocaleCode.en_US}
        />
      ),
      sorter: (a: BasicData, b: BasicData) =>
        numericalSort(
          `col-${i}`,
          a as Record<PropertyKey, any>,
          b as Record<PropertyKey, any>,
        ),
    });
  }
  return newCols as ColumnsType<ExampleData>[];
}
const recordCount = 500;
const columnCount = 500;
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
    category: 'Harddrive',
    price: 49.99,
    description: 'Reliable and fast data storage',
  },
  {
    key: 4,
    name: '128 GB SSD',
    category: 'Harddrive',
    price: 49.99,
    description: 'Reliable and fast data storage',
  },
  {
    key: 5,
    name: '4GB 144mhz',
    category: 'Memory',
    price: 19.99,
    description: 'Laptop memory',
  },
  {
    key: 6,
    name: '1GB USB Flash Drive',
    category: 'Portable Storage',
    price: 9.99,
    description: 'USB Flash Drive portal data storage',
  },
  {
    key: 7,
    name: '256 GB SSD',
    category: 'Harddrive',
    price: 175,
    description: 'Reliable and fast data storage',
  },
  {
    key: 8,
    name: '1 TB SSD',
    category: 'Harddrive',
    price: 349.99,
    description: 'Reliable and fast data storage',
  },
];

const basicColumns: ColumnsType<BasicData> = [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    width: 100,
    sorter: (a: BasicData, b: BasicData) =>
      alphabeticalSort(
        'name',
        a as Record<PropertyKey, any>,
        b as Record<PropertyKey, any>,
      ),
  },
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
    sorter: (a: BasicData, b: BasicData) =>
      alphabeticalSort(
        'category',
        a as Record<PropertyKey, any>,
        b as Record<PropertyKey, any>,
      ),
  },
  {
    title: 'Price',
    dataIndex: 'price',
    key: 'price',
    sorter: (a: BasicData, b: BasicData) =>
      numericalSort(
        'price',
        a as Record<PropertyKey, any>,
        b as Record<PropertyKey, any>,
      ),
    width: 100,
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
    width: 150,
  },
  {
    title: 'Age',
    dataIndex: 'age',
    key: 'age',
    sorter: (a: ExampleData, b: ExampleData) =>
      numericalSort(
        'age',
        a as Record<PropertyKey, any>,
        b as Record<PropertyKey, any>,
      ),
    width: 75,
  },
  {
    title: 'Address',
    dataIndex: 'address',
    key: 'address',
    width: 100,
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
        options={{ style: Style.Currency, currency: CurrencyCode.EUR }}
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
        options={{ style: Style.Currency, currency: CurrencyCode.USD }}
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
    ...generateValues(columnCount, i),
  });
}

export const Basic: StoryFn<typeof Table> = args => <Table {...args} />;

function handlers(record: object, rowIndex: number) {
  return {
    onClick: action(
      `row onClick, row: ${rowIndex}, record: ${JSON.stringify(record)}`,
    ), // click row
    onDoubleClick: action(
      `row onDoubleClick, row: ${rowIndex}, record: ${JSON.stringify(record)}`,
    ), // double click row
    onContextMenu: action(
      `row onContextMenu, row: ${rowIndex}, record: ${JSON.stringify(record)}`,
    ), // right button click row
    onMouseEnter: action(`Mouse Enter, row: ${rowIndex}`), // mouse enter row
    onMouseLeave: action(`Mouse Leave, row: ${rowIndex}`), // mouse leave row
  };
}

Basic.args = {
  data: basicData,
  columns: basicColumns,
  size: TableSize.Small,
  onRow: handlers,
  usePagination: false,
};

export const Pagination: StoryFn<typeof Table> = args => <Table {...args} />;

Pagination.args = {
  data: basicData,
  columns: basicColumns,
  size: TableSize.Small,
  pageSizeOptions: ['5', '10', '15', '20', '25'],
  defaultPageSize: 5,
};

const generateData = (startIndex: number, pageSize: number): BasicData[] => {
  const data: BasicData[] = [];
  for (let i = 0; i < pageSize; i += 1) {
    const recordIndex = startIndex + i;
    data.push({
      key: recordIndex,
      name: `Dynamic Record ${recordIndex}`,
      category: 'Disk Storage',
      price: recordIndex * 2.59,
      description: 'A random description',
    });
  }
  return data;
};

const paginationColumns: ColumnsType<BasicData> = [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    width: 100,
  },
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
  },
  {
    title: 'Price',
    dataIndex: 'price',
    key: 'price',
    width: 100,
    render: (value: number) => (
      <NumericCell
        options={{ style: Style.Currency, currency: CurrencyCode.EUR }}
        value={value}
        locale={LocaleCode.en_US}
      />
    ),
    sorter: (a: BasicData, b: BasicData) =>
      numericalSort(
        'price',
        a as Record<PropertyKey, any>,
        b as Record<PropertyKey, any>,
      ),
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
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

export const ServerPagination: StoryFn<typeof Table> = args => {
  const [data, setData] = useState(generateData(0, 5));
  const [loading, setLoading] = useState(false);

  const handleChange: OnChangeFunction<BasicData> = (
    pagination,
    filters,
    sorter,
    extra,
  ) => {
    const pageSize = pagination?.pageSize ?? 5;
    const current = pagination?.current ?? 0;
    switch (extra?.action) {
      case ETableAction.Paginate: {
        setLoading(true);
        // simulate a fetch
        setTimeout(() => {
          setData(generateData(current * pageSize, pageSize));
          setLoading(false);
        }, 1000);
        break;
      }
      case ETableAction.Sort: {
        action(`table-sort-change: ${JSON.stringify(sorter)}`);
        break;
      }
      case ETableAction.Filter: {
        action(`table-sort-change: ${JSON.stringify(filters)}`);
        break;
      }
      default: {
        action('table action unknown');
        break;
      }
    }
  };

  return (
    <Table
      {...args}
      data={data}
      recordCount={5000}
      onChange={handleChange}
      loading={loading}
    />
  );
};

ServerPagination.args = {
  columns: paginationColumns,
  size: TableSize.Small,
  pageSizeOptions: ['5', '20', '50'],
  defaultPageSize: 5,
};

export const VirtualizedPerformance: StoryFn<typeof Table> = args => (
  <Table {...args} />
);

VirtualizedPerformance.args = {
  data: bigdata,
  columns: bigColumns,
  size: TableSize.Small,
  resizable: true,
  reorderable: true,
  height: 350,
  virtualize: true,
  usePagination: false,
};

export const Loading: StoryFn<typeof Table> = args => <Table {...args} />;

Loading.args = {
  data: basicData,
  columns: basicColumns,
  size: TableSize.Small,
  loading: true,
};

export const ResizableColumns: StoryFn<typeof Table> = args => (
  <Table {...args} />
);

ResizableColumns.args = {
  data: basicData,
  columns: basicColumns,
  size: TableSize.Small,
  resizable: true,
};

export const ReorderableColumns: StoryFn<typeof Table> = args => {
  const [droppedItem, setDroppedItem] = useState<string | undefined>();
  const dragOver = (ev: DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const element: HTMLElement | null = ev?.currentTarget as HTMLElement;
    if (element?.style) {
      element.style.border = '1px dashed green';
    }
  };

  const dragOut = (ev: DragEvent<HTMLDivElement>) => {
    ev.preventDefault();
    const element: HTMLElement | null = ev?.currentTarget as HTMLElement;
    if (element?.style) {
      element.style.border = '1px solid grey';
    }
  };

  const dragDrop = (ev: DragEvent<HTMLDivElement>) => {
    const data = ev.dataTransfer?.getData?.(SUPERSET_TABLE_COLUMN);
    const element: HTMLElement | null = ev?.currentTarget as HTMLElement;
    if (element?.style) {
      element.style.border = '1px solid grey';
    }
    setDroppedItem(data);
  };
  return (
    <div>
      <div
        onDragOver={(ev: DragEvent<HTMLDivElement>) => dragOver(ev)}
        onDragLeave={(ev: DragEvent<HTMLDivElement>) => dragOut(ev)}
        onDrop={(ev: DragEvent<HTMLDivElement>) => dragDrop(ev)}
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
  );
};

ReorderableColumns.args = {
  data: basicData,
  columns: basicColumns,
  size: TableSize.Small,
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

export const CellRenderers: StoryFn<typeof Table> = args => <Table {...args} />;

CellRenderers.args = {
  data: rendererData,
  columns: rendererColumns,
  size: TableSize.Small,
  reorderable: true,
};

export interface ShoppingData {
  key: number;
  item: string;
  orderDate: number;
  price: number;
}

const shoppingData: ShoppingData[] = [
  {
    key: 1,
    item: 'Floppy Disk 10 pack',
    orderDate: new Date('2015-07-02T16:16:00Z').getTime(),
    price: 9.99,
  },
  {
    key: 2,
    item: 'DVD 100 pack',
    orderDate: new Date('2015-07-02T16:16:00Z').getTime(),
    price: 7.99,
  },
  {
    key: 3,
    item: '128 GB SSD',
    orderDate: new Date('2015-07-02T16:16:00Z').getTime(),
    price: 3.99,
  },
];

export const HeaderRenderers: StoryFn<typeof Table> = () => {
  const [orderDateFormatting, setOrderDateFormatting] = useState('formatted');
  const [priceLocale, setPriceLocale] = useState(LocaleCode.en_US);
  const shoppingColumns: ColumnsType<ShoppingData> = [
    {
      title: 'Item',
      dataIndex: 'item',
      key: 'item',
      width: 200,
    },
    {
      title: () => (
        <HeaderWithRadioGroup
          headerTitle="Order date"
          groupTitle="Formatting"
          groupOptions={[
            { label: 'Original value', value: 'original' },
            { label: 'Formatted value', value: 'formatted' },
          ]}
          value={orderDateFormatting}
          onChange={value => setOrderDateFormatting(value)}
        />
      ),
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 200,
      render: value =>
        orderDateFormatting === 'original' ? value : <TimeCell value={value} />,
    },
    {
      title: () => (
        <HeaderWithRadioGroup
          headerTitle="Price"
          groupTitle="Currency"
          groupOptions={[
            { label: 'US Dollar', value: LocaleCode.en_US },
            { label: 'Brazilian Real', value: LocaleCode.pt_BR },
          ]}
          value={priceLocale}
          onChange={value => setPriceLocale(value as LocaleCode)}
        />
      ),
      dataIndex: 'price',
      key: 'price',
      width: 200,
      render: value => (
        <NumericCell
          value={value}
          options={{
            style: Style.Currency,
            currency:
              priceLocale === LocaleCode.en_US
                ? CurrencyCode.USD
                : CurrencyCode.BRL,
          }}
          locale={priceLocale}
        />
      ),
    },
  ];

  return (
    <Table<ShoppingData>
      data={shoppingData}
      columns={shoppingColumns}
      size={TableSize.Small}
      resizable
    />
  );
};
