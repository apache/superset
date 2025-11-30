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
import { render, screen } from '@testing-library/react';
import { BarChartRenderer } from '../src/renderers/BarChartRenderer';
import { ThemeProvider, supersetTheme } from '@apache-superset/core/ui';
import '@testing-library/jest-dom';

const mockData = [150, 152, 155, 153, null, 162, 165, 163, 168, 170];

const createMockParams = {
  valueFormatted: undefined,
  node: {
    rowIndex: 0,
    rowPinned: undefined,
    id: 'row-0',
  },
  col: {
    key: 'test-column',
    label: 'Test Column',
    metricName: 'test_metric',
    config: {
      chartConfig: {
        width: 400,
        height: 10,
        color: '#28d8c9ff',
        showValues: false,
      },
      horizontalAlign: 'left',
    },
  },
  colDef: {},
  data: mockData,
  rowIndex: 0,
};

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

test('should render BarChartRenderer', () => {
  renderWithTheme(<BarChartRenderer {...(createMockParams as any)} />);
  const chart = screen.getByLabelText('Bar chart for Test Column');
  expect(chart).toBeInTheDocument();
});

test('renders bar chart with correct dimenstions, color, and strokeWidth', () => {
  renderWithTheme(<BarChartRenderer {...(createMockParams as any)} />);
  const svg = document.querySelector('svg');
  expect(svg).toHaveAttribute('width', '400');
  expect(svg).toHaveAttribute('height', '10');
  const coloredElement = document.querySelector('[fill="#28d8c9ff"]');
  expect(coloredElement).toBeInTheDocument();
});

test('should render with y-axis when showValues is true', () => {
  const paramsWithValues = { ...createMockParams };
  paramsWithValues.col.config.chartConfig.showValues = true;
  renderWithTheme(<BarChartRenderer {...(paramsWithValues as any)} />);
  const svg = document.querySelector('svg');
  const textElements = svg?.querySelectorAll('text');
  expect(svg).toBeInTheDocument();
  expect(textElements).toBeDefined();
  expect(textElements!.length).toBeGreaterThan(0);
});

test('should handle empty data gracefully', () => {
  const paramsWithEmptyData = { ...createMockParams };
  paramsWithEmptyData.data = [];
  renderWithTheme(<BarChartRenderer {...(paramsWithEmptyData as any)} />);
  const container = screen.getByLabelText('Bar chart for Test Column');
  expect(container).toBeInTheDocument();
});
