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
import { screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { render } from 'spec/helpers/testing-library';
import { supersetTheme } from '@apache-superset/core/theme';
import TTestTable from '../src/TTestTable';
import type { DataEntry } from '../src/TTestTable';

// Mock the p-value computation to a predictable value (0.02) so the table's
// formatting and significance thresholds are deterministic.
jest.mock('../src/statistics', () => ({
  __esModule: true,
  studentTwoSidedPValue: () => 0.02,
}));

const mockData: DataEntry[] = [
  {
    group: ['group-A'],
    values: [
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ],
  },
  {
    group: ['group-B'],
    values: [
      { x: 1, y: 15 },
      { x: 2, y: 25 },
    ],
  },
];

const defaultProps = {
  alpha: 0.05,
  data: mockData,
  groups: ['category'],
  liftValPrec: 4,
  metric: 'revenue',
  pValPrec: 6,
};

const dataRows = () =>
  document.querySelectorAll<HTMLTableRowElement>('tr.ant-table-row');

test('renders the metric name as an h3 heading', async () => {
  render(<TTestTable {...defaultProps} />);

  const heading = await screen.findByText('revenue');
  expect(heading.tagName).toBe('H3');
});

test('renders a table with the correct column headers', async () => {
  render(<TTestTable {...defaultProps} />);

  await waitFor(() => expect(dataRows()).toHaveLength(2));
  expect(screen.getByText('category')).toBeInTheDocument();
  expect(screen.getByText('p-value')).toBeInTheDocument();
  expect(screen.getByText('Lift %')).toBeInTheDocument();
  expect(screen.getByText('Significant')).toBeInTheDocument();
});

test('renders group columns matching the groups prop', async () => {
  const multiGroupData: DataEntry[] = [
    { group: ['group-A', 'sub-1'], values: [{ x: 1, y: 10 }] },
    { group: ['group-B', 'sub-2'], values: [{ x: 1, y: 15 }] },
  ];

  render(
    <TTestTable
      {...defaultProps}
      groups={['category', 'subcategory']}
      data={multiGroupData}
    />,
  );

  await waitFor(() => expect(dataRows()).toHaveLength(2));
  expect(screen.getByText('category')).toBeInTheDocument();
  expect(screen.getByText('subcategory')).toBeInTheDocument();
});

test('first row is treated as control by default and shows "control" for the computed columns', async () => {
  render(<TTestTable {...defaultProps} />);

  // The control row renders "control" in its p-value, lift and significance cells
  await waitFor(() => {
    expect(screen.getAllByText('control').length).toBeGreaterThanOrEqual(2);
  });
});

test('computes lift values correctly for non-control rows', async () => {
  // Control (group-A): sum of y = 30, group-B: sum of y = 40
  // Lift = ((40 - 30) / 30) * 100 = 33.3333 with liftValPrec=4
  render(<TTestTable {...defaultProps} />);

  expect(await screen.findByText('33.3333')).toBeInTheDocument();
});

test('computes p-value from the statistics module', async () => {
  // Mocked studentTwoSidedPValue returns 0.02, with pValPrec=6 => "0.020000"
  render(<TTestTable {...defaultProps} />);

  expect(await screen.findByText('0.020000')).toBeInTheDocument();
});

test('marks non-control row as significant when p-value is below alpha', async () => {
  // p-value 0.02 < alpha 0.05, so significance is true
  render(<TTestTable {...defaultProps} />);

  const cell = await screen.findByText('true');
  expect(cell).toHaveStyle({ color: supersetTheme.colorSuccess });
});

test('marks non-control row as not significant when p-value is above alpha', async () => {
  // p-value 0.02 > alpha 0.01, so significance is false
  render(<TTestTable {...defaultProps} alpha={0.01} />);

  const cell = await screen.findByText('false');
  expect(cell).toHaveStyle({ color: supersetTheme.colorError });
});

test('renders Infinity lift when control values sum to zero, colored as invalid', async () => {
  const zeroControlData: DataEntry[] = [
    {
      group: ['zero-group'],
      values: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    },
    {
      group: ['other-group'],
      values: [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
      ],
    },
  ];

  render(<TTestTable {...defaultProps} data={zeroControlData} />);

  // ((30 - 0) / 0) * 100 = Infinity; getLiftStatus classifies non-finite as invalid
  const cell = await screen.findByText('Infinity');
  expect(cell).toHaveStyle({ color: supersetTheme.colorWarning });
});

test('colors finite positive lift cells with the success token', async () => {
  render(<TTestTable {...defaultProps} />);

  const cell = await screen.findByText('33.3333');
  expect(cell).toHaveStyle({ color: supersetTheme.colorSuccess });
});

test('recomputes and clamps the control index when data shrinks', async () => {
  const threeRowData: DataEntry[] = [
    { group: ['row-0'], values: [{ x: 1, y: 10 }] },
    { group: ['row-1'], values: [{ x: 1, y: 20 }] },
    { group: ['row-2'], values: [{ x: 1, y: 40 }] },
  ];
  const { rerender } = render(
    <TTestTable {...defaultProps} data={threeRowData} />,
  );

  // Make the last row (index 2) the control
  const row2 = await screen.findByText('row-2');
  fireEvent.click(row2.closest('tr')!);

  // row-0 lift vs row-2 control: ((10 - 40) / 40) * 100 = -75.0000
  expect(await screen.findByText('-75.0000')).toBeInTheDocument();

  // Shrink the data so the control index (2) is out of range
  rerender(<TTestTable {...defaultProps} data={threeRowData.slice(0, 2)} />);

  // Control clamps to the last remaining row (index 1) and values recompute:
  // row-0 lift vs row-1 control: ((10 - 20) / 20) * 100 = -50.0000
  expect(await screen.findByText('-50.0000')).toBeInTheDocument();
  expect(screen.queryByText('row-2')).not.toBeInTheDocument();
});

test('sorts a non-finite lift value deterministically regardless of comparison order', async () => {
  // Control sum is non-zero, so row-normal gets a finite lift while row-huge
  // overflows to a non-finite ("Infinity") lift.
  const mixedLiftData: DataEntry[] = [
    { group: ['control'], values: [{ x: 1, y: 100 }] },
    { group: ['row-normal'], values: [{ x: 1, y: 200 }] },
    { group: ['row-huge'], values: [{ x: 1, y: Infinity }] },
  ];

  render(
    <TTestTable {...defaultProps} data={mixedLiftData} groups={['group']} />,
  );

  await waitFor(() => {
    expect(screen.getByText('Infinity')).toBeInTheDocument();
    expect(screen.getByText('100.0000')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByText('Lift %'));

  await waitFor(() => {
    const rowLabels = Array.from(dataRows()).map(row => row.textContent);
    // Non-finite value is consistently ordered ahead of the finite one, with
    // the control pinned to the top.
    expect(rowLabels).toEqual([
      expect.stringContaining('control'),
      expect.stringContaining('row-huge'),
      expect.stringContaining('row-normal'),
    ]);
  });
});

test('throws an error when groups array is empty', () => {
  // Suppress React error boundary console output for this test
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  expect(() => {
    render(<TTestTable {...defaultProps} groups={[]} />);
  }).toThrow('Group by param is required');

  consoleSpy.mockRestore();
});

test('clicking a non-control row changes it to the new control', async () => {
  render(<TTestTable {...defaultProps} />);

  // Initially group-A is control, group-B shows the computed lift
  const groupB = await screen.findByText('group-B');
  expect(await screen.findByText('33.3333')).toBeInTheDocument();

  // Click the group-B row to make it the new control
  fireEvent.click(groupB.closest('tr')!);

  // group-A lift vs group-B control: ((30 - 40) / 40) * 100 = -25.0000
  expect(await screen.findByText('-25.0000')).toBeInTheDocument();
});

test('renders group name data in the table cells', async () => {
  render(<TTestTable {...defaultProps} />);

  expect(await screen.findByText('group-A')).toBeInTheDocument();
  expect(screen.getByText('group-B')).toBeInTheDocument();
});

test('renders with three data rows and computes values for each non-control row', async () => {
  const threeRowData: DataEntry[] = [
    {
      group: ['control-group'],
      values: [
        { x: 1, y: 10 },
        { x: 2, y: 10 },
      ],
    },
    {
      group: ['test-group-1'],
      values: [
        { x: 1, y: 15 },
        { x: 2, y: 15 },
      ],
    },
    {
      group: ['test-group-2'],
      values: [
        { x: 1, y: 20 },
        { x: 2, y: 20 },
      ],
    },
  ];

  render(<TTestTable {...defaultProps} data={threeRowData} />);

  await waitFor(() => expect(dataRows()).toHaveLength(3));
  // control-group: sum = 20
  // test-group-1: sum = 30, lift = 50.0000; test-group-2: sum = 40, lift = 100.0000
  expect(screen.getByText('50.0000')).toBeInTheDocument();
  expect(screen.getByText('100.0000')).toBeInTheDocument();
});
