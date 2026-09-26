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
import * as resizeDetector from 'react-resize-detector';
import type { ColumnsType } from 'antd/es/table';
import { Table } from './index';
import getScrollBarSize from './utils/getScrollBarSize';

jest.mock('./utils/getScrollBarSize');

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

test('reserves space for the body Grid vertical scrollbar when sizing header columns', async () => {
  const resizeSpy = jest.spyOn(resizeDetector, 'useResizeDetector');
  let resized = false;
  resizeSpy.mockImplementation(props => {
    if (props?.onResize && !resized) {
      resized = true;
      props.onResize(400);
    }
    return { ref: { current: undefined } };
  });
  jest.mocked(getScrollBarSize).mockReturnValue(20);

  const manyRows: BasicData[] = Array.from({ length: 50 }, (_, i) => ({
    columnName: `Row ${i}`,
    columnType: 'Numerical',
  }));
  const columnsNoWidth: ColumnsType<BasicData> = [
    { title: 'Column Name', dataIndex: 'columnName', key: 'columnName' },
    { title: 'Column Type', dataIndex: 'columnType', key: 'columnType' },
  ];

  const { container } = render(
    <Table
      columns={columnsNoWidth}
      data={manyRows}
      virtualize
      height={100}
      usePagination={false}
    />,
  );

  await waitFor(() => {
    expect(container.querySelectorAll('col').length).toBe(2);
  });

  // Enough rows at the default row height to overflow a 100px-tall Grid,
  // so the 20px scrollbar reservation should come out of the 400px
  // container width rather than being added on top of it.
  const totalColWidth = Array.from(container.querySelectorAll('col')).reduce(
    (sum, col) => sum + parseFloat(col.style.width || '0'),
    0,
  );
  expect(totalColWidth).toBe(380);

  resizeSpy.mockRestore();
});
