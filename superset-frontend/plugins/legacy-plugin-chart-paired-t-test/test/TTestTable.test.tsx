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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TTestTable from '../src/TTestTable';
import type { DataEntry } from '../src/TTestTable';

// Mock the distributions module to return a predictable cdf value.
// cdf returns 0.01 so that p-value = 2 * 0.01 = 0.02
jest.mock('distributions', () => {
  class MockStudentt {
    cdf(_x: number): number {
      return 0.01;
    }
  }
  return {
    __esModule: true,
    default: { Studentt: MockStudentt },
  };
});

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

test('renders the metric name as an h3 heading', async () => {
  render(<TTestTable {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByText('revenue')).toBeInTheDocument();
  });

  const heading = screen.getByText('revenue');
  expect(heading.tagName).toBe('H3');
});

test('renders a table with the correct column headers', async () => {
  render(<TTestTable {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  expect(screen.getByText('category')).toBeInTheDocument();
  expect(screen.getByText('p-value')).toBeInTheDocument();
  expect(screen.getByText('Lift %')).toBeInTheDocument();
  expect(screen.getByText('Significant')).toBeInTheDocument();
});

test('renders group columns matching the groups prop', async () => {
  const multiGroupData: DataEntry[] = [
    {
      group: ['group-A', 'sub-1'],
      values: [{ x: 1, y: 10 }],
    },
    {
      group: ['group-B', 'sub-2'],
      values: [{ x: 1, y: 15 }],
    },
  ];

  render(
    <TTestTable
      {...defaultProps}
      groups={['category', 'subcategory']}
      data={multiGroupData}
    />,
  );

  await waitFor(() => {
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  expect(screen.getByText('category')).toBeInTheDocument();
  expect(screen.getByText('subcategory')).toBeInTheDocument();
});

test('first row is treated as control by default and shows "control" for p-value and lift columns', async () => {
  render(<TTestTable {...defaultProps} />);

  // After componentDidMount, the first row should be control
  await waitFor(() => {
    const controlTexts = screen.getAllByText('control');
    // The control row has "control" in pValue and liftValue columns
    expect(controlTexts.length).toBeGreaterThanOrEqual(2);
  });
});

test('computes lift values correctly for non-control rows', async () => {
  // Control (group-A): sum of y = 10 + 20 = 30
  // group-B: sum of y = 15 + 25 = 40
  // Lift = ((40 - 30) / 30) * 100 = 33.3333%
  // With liftValPrec=4 => "33.3333"
  render(<TTestTable {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByText('33.3333')).toBeInTheDocument();
  });
});

test('computes p-value using the mocked distributions module', async () => {
  // Mock cdf returns 0.01, so p-value = 2 * 0.01 = 0.02
  // With pValPrec=6 => "0.020000"
  render(<TTestTable {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByText('0.020000')).toBeInTheDocument();
  });
});

test('marks non-control row as significant when p-value is below alpha', async () => {
  // p-value = 0.02 < alpha = 0.05, so significance is true
  render(<TTestTable {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByText('true')).toBeInTheDocument();
  });
});

test('marks non-control row as not significant when p-value is above alpha', async () => {
  // p-value = 0.02 > alpha = 0.01, so significance is false
  render(<TTestTable {...defaultProps} alpha={0.01} />);

  await waitFor(() => {
    expect(screen.getByText('false')).toBeInTheDocument();
  });
});

test('returns NaN lift when control values sum to zero (division by zero guard)', async () => {
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

  // The lift computation: ((sumValues - sumControl) / sumControl) * 100
  // = ((30 - 0) / 0) * 100 = Infinity
  // Infinity.toFixed(4) in jsdom returns "NaN", and the component renders it.
  // The getLiftStatus method classifies this as "invalid" (NaN or non-finite).
  await waitFor(() => {
    expect(screen.getByText('NaN')).toBeInTheDocument();
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

  // Wait for initial render with group-A as control
  await waitFor(() => {
    expect(screen.getByText('group-A')).toBeInTheDocument();
    expect(screen.getByText('group-B')).toBeInTheDocument();
  });

  // Initially group-A is control, so its row shows "control" in p-value and lift columns.
  // The non-control row (group-B) shows computed values.
  await waitFor(() => {
    expect(screen.getByText('33.3333')).toBeInTheDocument();
  });

  // Click the group-B row to make it the new control.
  // The row containing "group-B" text is what we need to click.
  const groupBCell = screen.getByText('group-B');
  const groupBRow = groupBCell.closest('tr');
  expect(groupBRow).not.toBeNull();
  fireEvent.click(groupBRow!);

  // After clicking, group-B becomes control.
  // group-A lift: ((30 - 40) / 40) * 100 = -25.0000
  await waitFor(() => {
    expect(screen.getByText('-25.0000')).toBeInTheDocument();
  });
});

test('renders group name data in the table cells', async () => {
  render(<TTestTable {...defaultProps} />);

  await waitFor(() => {
    expect(screen.getByText('group-A')).toBeInTheDocument();
    expect(screen.getByText('group-B')).toBeInTheDocument();
  });
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

  await waitFor(() => {
    expect(screen.getByText('control-group')).toBeInTheDocument();
    expect(screen.getByText('test-group-1')).toBeInTheDocument();
    expect(screen.getByText('test-group-2')).toBeInTheDocument();
  });

  // control-group: sum = 20
  // test-group-1: sum = 30, lift = ((30-20)/20)*100 = 50.0000
  // test-group-2: sum = 40, lift = ((40-20)/20)*100 = 100.0000
  await waitFor(() => {
    expect(screen.getByText('50.0000')).toBeInTheDocument();
    expect(screen.getByText('100.0000')).toBeInTheDocument();
  });
});
