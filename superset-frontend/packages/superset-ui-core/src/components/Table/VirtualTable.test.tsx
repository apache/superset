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
import { render, screen, waitFor } from '@superset-ui/core/spec';
import type { ColumnsType } from 'antd/es/table';
import { Table } from './index';

// jsdom never measures the container, so tests that need a width set this one.
let mockTableWidth: number | undefined;
jest.mock('react-resize-detector', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useResizeDetector: ({
      onResize,
    }: {
      onResize?: (width?: number) => void;
    }) => {
      useEffect(() => {
        if (mockTableWidth !== undefined) onResize?.(mockTableWidth);
      }, [onResize]);
      return { ref: () => undefined };
    },
  };
});

afterEach(() => {
  mockTableWidth = undefined;
});

// These tests exercise VirtualTable's react-window v2 `Grid` wiring
// (`cellComponent`/`cellProps`/`gridRef`), which previously had no direct
// coverage - `Table.test.tsx` only exercises the non-virtualized code path.

interface BasicData {
  columnName: string;
  columnType: string;
}

const testData: BasicData[] = [
  { columnName: 'Number', columnType: 'Numerical' },
  { columnName: 'String', columnType: 'Physical' },
  { columnName: 'Date', columnType: 'Virtual' },
];

const testColumns: ColumnsType<BasicData> = [
  {
    title: 'Column Name',
    dataIndex: 'columnName',
    key: 'columnName',
    width: 150,
  },
  {
    title: 'Column Type',
    dataIndex: 'columnType',
    key: 'columnType',
    width: 150,
  },
];

test('virtualized table renders headers and row content through the react-window Grid', async () => {
  render(
    <Table
      columns={testColumns}
      data={testData}
      virtualize
      height={200}
      usePagination={false}
    />,
  );

  await waitFor(() =>
    testColumns.forEach(column =>
      expect(
        screen
          .getAllByText(column.title as string)
          .find(el => el.closest('th')),
      ).toBeInTheDocument(),
    ),
  );

  testData.forEach(row => {
    expect(screen.getByText(row.columnName)).toBeInTheDocument();
  });
});

test('virtualized table cells keep the DOM hooks other code (cypress, downloadAsImage) relies on', async () => {
  const { container } = render(
    <Table
      columns={testColumns}
      data={testData}
      virtualize
      height={200}
      usePagination={false}
    />,
  );

  await waitFor(() => {
    expect(container.querySelector('.virtual-grid')).toBeInTheDocument();
    expect(
      container.querySelectorAll('.virtual-table-cell').length,
    ).toBeGreaterThan(0);
  });
});

test('cell render functions receive their row data via cellProps rather than a stale closure', async () => {
  const columnsWithRender: ColumnsType<BasicData> = [
    {
      title: 'Column Name',
      dataIndex: 'columnName',
      key: 'columnName',
      width: 150,
      render: (value: string) => `rendered:${value}`,
    },
  ];

  render(
    <Table
      columns={columnsWithRender}
      data={testData}
      virtualize
      height={200}
      usePagination={false}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText('rendered:Number')).toBeInTheDocument();
  });
});

// The header is antd's own <table>; the body Grid is sized to the columns.
const virtualHeaderWidth = (columns: ColumnsType<BasicData>) => {
  const { container } = render(
    <Table
      columns={columns}
      data={testData}
      virtualize
      height={200}
      usePagination={false}
    />,
  );
  return () =>
    container
      .querySelector<HTMLTableElement>('.virtual-table thead')
      ?.closest('table')?.style.width;
};

test('virtualized table header is as wide as its columns, not the viewport', async () => {
  const width = virtualHeaderWidth(testColumns);
  await waitFor(() => expect(width()).toBe('300px'));
});

test('virtualized table header width ignores non-numeric column widths', async () => {
  const width = virtualHeaderWidth([
    testColumns[0],
    { ...testColumns[1], width: '20%' },
  ]);
  await waitFor(() => expect(width()).toBe('150px'));
});

test('virtualized table header width survives a non-numeric width beside an unsized column', async () => {
  const width = virtualHeaderWidth([
    { ...testColumns[0], width: '20%' },
    { title: 'Column Type', dataIndex: 'columnType', key: 'columnType' },
  ]);
  // The unsized column gets the 50px minimum; the '20%' one adds nothing.
  await waitFor(() => expect(width()).toBe('50px'));
});

test('virtualized table header includes the stretched last column', async () => {
  mockTableWidth = 400;
  const width = virtualHeaderWidth(testColumns);
  await waitFor(() => expect(width()).toBe('400px'));
});

test('virtualized table does not stretch a non-numeric last column', async () => {
  mockTableWidth = 400;
  const width = virtualHeaderWidth([
    testColumns[0],
    { ...testColumns[1], width: '20%' },
  ]);
  await waitFor(() => expect(width()).toBe('150px'));
});

test('virtualized table header falls back to the given scroll.x when no width is numeric', async () => {
  const width = virtualHeaderWidth(
    testColumns.map(column => ({ ...column, width: '50%' })),
  );
  await waitFor(() => expect(width()).toBe('100vw'));
});
