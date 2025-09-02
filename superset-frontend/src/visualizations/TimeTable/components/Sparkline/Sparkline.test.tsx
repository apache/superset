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
import Sparkline from './Sparkline';

const mockEntries = [
  { time: '2023-01-01', sales: 100 },
  { time: '2023-01-02', sales: 200 },
  { time: '2023-01-03', sales: 300 },
  { time: '2023-01-04', sales: 400 },
];

describe('Sparkline', () => {
  test('should render basic sparkline without time ratio', () => {
    const column = {
      key: 'test-sparkline',
      colType: 'spark',
      width: '200',
      height: '40',
    };

    const { container } = render(
      <Sparkline valueField="sales" column={column} entries={mockEntries} />,
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  test('should handle time ratio sparkline', () => {
    const column = {
      key: 'test-sparkline',
      colType: 'spark',
      timeRatio: 2,
      width: '200',
      height: '40',
    };

    const { container } = render(
      <Sparkline valueField="sales" column={column} entries={mockEntries} />,
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  test('should handle string time ratio', () => {
    const column = {
      key: 'test-sparkline',
      colType: 'spark',
      timeRatio: '1',
      width: '200',
      height: '40',
    };

    const { container } = render(
      <Sparkline valueField="sales" column={column} entries={mockEntries} />,
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  test('should use default dimensions when not specified', () => {
    const column = {
      key: 'test-sparkline',
      colType: 'spark',
    };

    const { container } = render(
      <Sparkline valueField="sales" column={column} entries={mockEntries} />,
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  test('should handle yAxis bounds configuration', () => {
    const column = {
      key: 'test-sparkline',
      colType: 'spark',
      yAxisBounds: [0, 500] as [number, number],
      showYAxis: true,
    };

    const { container } = render(
      <Sparkline valueField="sales" column={column} entries={mockEntries} />,
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  test('should handle invalid yAxis bounds', () => {
    const column = {
      key: 'test-sparkline',
      colType: 'spark',
      yAxisBounds: [] as null[],
    };

    const { container } = render(
      <Sparkline valueField="sales" column={column} entries={mockEntries} />,
    );

    expect(container.firstChild).toBeInTheDocument();
  });
});
