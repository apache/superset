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
import { render } from '@superset-ui/core/spec';
import SparklineCell from './SparklineCell';

const mockData = [3516979.54, 4724162.6, 1791486.71];
const mockEntries = [
  { time: '2003-01-01 00:00:00', 'SUM(sales)': 3516979.54 },
  { time: '2004-01-01 00:00:00', 'SUM(sales)': 4724162.6 },
  { time: '2005-01-01 00:00:00', 'SUM(sales)': 1791486.71 },
];

const defaultProps = {
  ariaLabel: 'spark-test',
  dataKey: 'spark-test-key',
  data: mockData,
  entries: mockEntries,
  height: 50,
  width: 300,
  numberFormat: '',
  dateFormat: '',
  showYAxis: false,
  yAxisBounds: [undefined, undefined] as [
    number | undefined,
    number | undefined,
  ],
};

test('should render SparklineCell', () => {
  const { container } = render(<SparklineCell {...defaultProps} />);
  expect(container).toBeInTheDocument();
});

test('should render svg chart', () => {
  render(<SparklineCell {...defaultProps} />);

  const svg = document.querySelector('svg');

  expect(svg).toBeInTheDocument();
  expect(svg).toHaveAttribute('aria-label', 'spark-test');
});

test('should handle width and height props', () => {
  render(<SparklineCell {...defaultProps} width={400} height={100} />);

  const svg = document.querySelector('svg');

  expect(svg).toHaveAttribute('width', '400');
  expect(svg).toHaveAttribute('height', '100');
});

test('should render with y-axis when showYAxis is true', () => {
  render(<SparklineCell {...defaultProps} showYAxis />);

  const svg = document.querySelector('svg');
  const textElements = svg?.querySelectorAll('text');

  expect(svg).toBeInTheDocument();
  expect(textElements).toBeDefined();
  expect(textElements!.length).toBeGreaterThan(0);
});

test('should handle empty data gracefully', () => {
  const { container } = render(
    <SparklineCell {...defaultProps} data={[]} entries={[]} />,
  );
  expect(container).toBeInTheDocument();
});

test('should apply custom number format', () => {
  const { container } = render(
    <SparklineCell {...defaultProps} numberFormat=".2f" showYAxis />,
  );
  expect(container).toBeInTheDocument();
});

test('should handle y-axis bounds', () => {
  const { container } = render(
    <SparklineCell
      {...defaultProps}
      yAxisBounds={[1000000, 5000000]}
      showYAxis
    />,
  );
  expect(container).toBeInTheDocument();
});

test('should render line series', () => {
  render(<SparklineCell {...defaultProps} />);

  const svg = document.querySelector('svg');

  expect(svg).toBeInTheDocument();
});

test('should handle null values in data gracefully', () => {
  const dataWithNulls = [3516979.54, null, 1791486.71];
  const entriesWithNulls = [
    { time: '2003-01-01 00:00:00', 'SUM(sales)': 3516979.54 },
    { time: '2004-01-01 00:00:00', 'SUM(sales)': null },
    { time: '2005-01-01 00:00:00', 'SUM(sales)': 1791486.71 },
  ];

  const { container } = render(
    <SparklineCell
      {...defaultProps}
      data={dataWithNulls}
      entries={entriesWithNulls}
    />,
  );

  expect(container).toBeInTheDocument();
});

test('should return empty div when all data is null', () => {
  const nullData = [null, null, null];
  const nullEntries = [
    { time: '2003-01-01 00:00:00', 'SUM(sales)': null },
    { time: '2004-01-01 00:00:00', 'SUM(sales)': null },
    { time: '2005-01-01 00:00:00', 'SUM(sales)': null },
  ];

  const { container } = render(
    <SparklineCell {...defaultProps} data={nullData} entries={nullEntries} />,
  );

  expect(container).toBeInTheDocument();
  expect(container.querySelector('svg')).toBeNull();
});
