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
import { render, screen } from '@superset-ui/core/spec';
import ValueCell from './ValueCell';

const mockColumn = {
  key: 'test-column',
  label: 'Test Column',
  d3format: '.2f',
};

const mockEntries = [
  { time: '2023-01-03', sales: 300, price: 30 },
  { time: '2023-01-02', sales: 200, price: 20 },
  { time: '2023-01-01', sales: 100, price: 10 },
];

describe('ValueCell', () => {
  test('should render simple value without special column type', () => {
    render(
      <ValueCell
        valueField="sales"
        column={mockColumn}
        reversedEntries={mockEntries}
      />,
    );

    expect(screen.getByText('300.00')).toBeInTheDocument();
  });

  test('should handle time column type with diff comparison', () => {
    const timeColumn = {
      ...mockColumn,
      colType: 'time',
      comparisonType: 'diff',
      timeLag: 1,
    };

    render(
      <ValueCell
        valueField="sales"
        column={timeColumn}
        reversedEntries={mockEntries}
      />,
    );

    expect(screen.getByText('100.00')).toBeInTheDocument();
  });

  test('should handle time column type with percentage comparison', () => {
    const timeColumn = {
      ...mockColumn,
      colType: 'time',
      comparisonType: 'perc',
      timeLag: 1,
    };

    render(
      <ValueCell
        valueField="sales"
        column={timeColumn}
        reversedEntries={mockEntries}
      />,
    );

    expect(screen.getByText('1.50')).toBeInTheDocument();
  });

  test('should handle time column type with percentage change', () => {
    const timeColumn = {
      ...mockColumn,
      colType: 'time',
      comparisonType: 'perc_change',
      timeLag: 1,
    };

    render(
      <ValueCell
        valueField="sales"
        column={timeColumn}
        reversedEntries={mockEntries}
      />,
    );

    expect(screen.getByText('0.50')).toBeInTheDocument();
  });

  test('should handle contrib column type', () => {
    const contribColumn = {
      ...mockColumn,
      colType: 'contrib',
    };

    render(
      <ValueCell
        valueField="sales"
        column={contribColumn}
        reversedEntries={mockEntries}
      />,
    );

    expect(screen.getByText('0.91')).toBeInTheDocument();
  });

  test('should handle avg column type', () => {
    const avgColumn = {
      ...mockColumn,
      colType: 'avg',
      timeLag: 2,
    };

    render(
      <ValueCell
        valueField="sales"
        column={avgColumn}
        reversedEntries={mockEntries}
      />,
    );

    expect(screen.getByText('250.00')).toBeInTheDocument();
  });

  test('should show error message for excessive time lag', () => {
    const timeColumn = {
      ...mockColumn,
      colType: 'time',
      timeLag: 10,
    };

    render(
      <ValueCell
        valueField="sales"
        column={timeColumn}
        reversedEntries={mockEntries}
      />,
    );

    expect(
      screen.getByText(/The time lag set at 10 is too large/),
    ).toBeInTheDocument();
  });

  test('should handle negative time lag', () => {
    const timeColumn = {
      ...mockColumn,
      colType: 'time',
      comparisonType: 'diff',
      timeLag: -1,
    };

    render(
      <ValueCell
        valueField="sales"
        column={timeColumn}
        reversedEntries={mockEntries}
      />,
    );

    expect(screen.getByText('200.00')).toBeInTheDocument();
  });

  test('should handle null/undefined values in avg calculation', () => {
    const avgColumn = {
      ...mockColumn,
      colType: 'avg',
      timeLag: 3,
    };

    const entriesWithNulls = [
      { time: '2023-01-03', sales: 300 },
      { time: '2023-01-02', sales: null },
      { time: '2023-01-01', sales: 100 },
    ];

    render(
      <ValueCell
        valueField="sales"
        column={avgColumn}
        reversedEntries={entriesWithNulls}
      />,
    );

    expect(screen.getByText('200.00')).toBeInTheDocument();
  });

  test('should apply color styling when bounds are provided', () => {
    const columnWithBounds = {
      ...mockColumn,
      bounds: [0, 1000] as [number, number],
    };

    const { container } = render(
      <ValueCell
        valueField="sales"
        column={columnWithBounds}
        reversedEntries={mockEntries}
      />,
    );

    const span = container.querySelector('span[data-value="300"]');
    expect(span).toBeInTheDocument();
  });
});
