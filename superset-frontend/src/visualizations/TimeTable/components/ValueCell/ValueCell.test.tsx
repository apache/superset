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
import { calculateCellValue } from '../../utils';

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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ValueCell', () => {
  test('should render simple value without special column type', () => {
const { value, errorMsg } = calculateCellValue(
  'sales',
  mockColumn,
  mockEntries,
);

render(
  <ValueCell
    value={value}
    errorMsg={errorMsg}
    column={mockColumn}
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

const { value, errorMsg } = calculateCellValue(
  'sales',
  timeColumn,
  mockEntries,
);

render(
  <ValueCell
    value={value}
    errorMsg={errorMsg}
    column={timeColumn}
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

const { value, errorMsg } = calculateCellValue(
  'sales',
  timeColumn,
  mockEntries,
);

render(
  <ValueCell
    value={value}
    errorMsg={errorMsg}
    column={timeColumn}
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

const { value, errorMsg } = calculateCellValue(
  'sales',
  timeColumn,
  mockEntries,
);

render(
  <ValueCell
    value={value}
    errorMsg={errorMsg}
    column={timeColumn}
  />,
);

    expect(screen.getByText('0.50')).toBeInTheDocument();
  });

  test('should handle contrib column type', () => {
    const contribColumn = {
      ...mockColumn,
      colType: 'contrib',
    };

const { value, errorMsg } = calculateCellValue(
  'sales',
  contribColumn,
  mockEntries,
);

render(
  <ValueCell
    value={value}
    errorMsg={errorMsg}
    column={contribColumn}
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

const { value, errorMsg } = calculateCellValue(
  'sales',
  avgColumn,
  mockEntries,
);

render(
  <ValueCell
    value={value}
    errorMsg={errorMsg}
    column={avgColumn}
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

const { value, errorMsg } = calculateCellValue(
  'sales',
  timeColumn,
  mockEntries,
);

render(
  <ValueCell
    value={value}
    errorMsg={errorMsg}
    column={timeColumn}
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

const { value, errorMsg } = calculateCellValue(
  'sales',
  timeColumn,
  mockEntries,
);

render(
  <ValueCell
    value={value}
    errorMsg={errorMsg}
    column={timeColumn}
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

const { value, errorMsg } = calculateCellValue(
  'sales',
  avgColumn,
  entriesWithNulls,
);

render(
  <ValueCell
    value={value}
    errorMsg={errorMsg}
    column={avgColumn}
  />,
);
    expect(screen.getByText('200.00')).toBeInTheDocument();
  });

  test('should apply color styling when bounds are provided', () => {
    const columnWithBounds = {
      ...mockColumn,
      bounds: [0, 1000] as [number, number],
    };

const { value, errorMsg } = calculateCellValue(
  'sales',
  columnWithBounds,
  mockEntries,
);

const { container } = render(
  <ValueCell
    value={value}
    errorMsg={errorMsg}
    column={columnWithBounds}
  />,
);

const span = container.querySelector(
  `span[data-value="${value}"]`,
);

expect(span).toBeInTheDocument();
  });
});
