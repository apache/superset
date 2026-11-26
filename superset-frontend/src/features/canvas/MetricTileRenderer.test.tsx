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
import type { CanvasRendererProps } from 'src/core/canvas/types';
import { render, screen } from 'spec/helpers/testing-library';
import { formatMetric, MetricTileRenderer, NO_VALUE } from './dataRenderers';

const mockRows = {
  rows: [] as Record<string, unknown>[],
  loading: false,
  error: undefined as string | undefined,
};

jest.mock('./useWidgetRows', () => ({
  ...jest.requireActual('./useWidgetRows'),
  useWidgetRows: () => ({ ...mockRows, retry: jest.fn() }),
}));

const tile = (props: Record<string, unknown> = {}, title?: string) =>
  ({
    canvasId: 7,
    nodeId: 'kpi',
    widgetType: 'metric-tile',
    props: { dataBinding: { metrics: ['revenue'] }, ...props },
    title,
    filters: [],
    crossFilters: [],
    refreshKey: 0,
  }) as unknown as CanvasRendererProps;

beforeEach(() =>
  Object.assign(mockRows, { rows: [], loading: false, error: undefined }),
);

test('a metric is shortened, with the full figure kept for its tooltip', () => {
  expect(formatMetric(1234567)).toEqual({ short: '1.23M', full: '1,234,567' });
  expect(formatMetric(1234.5, 2).full).toBe('1,234.50');
});

test('a missing metric reads as a dash, not "null"', () => {
  expect(formatMetric(null).short).toBe(NO_VALUE);
  expect(formatMetric(undefined).short).toBe(NO_VALUE);
});

test('a titled tile shows its value once and no second label', () => {
  mockRows.rows = [{ revenue: 1234567 }];
  render(<MetricTileRenderer {...tile({ label: 'Revenue' }, 'Revenue')} />, {
    useRedux: true,
  });

  expect(screen.getByText('1.23M')).toBeInTheDocument();
  expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
});

test('an untitled tile names its value below it', () => {
  mockRows.rows = [{ revenue: 10 }];
  render(<MetricTileRenderer {...tile({ label: 'Revenue' })} />, {
    useRedux: true,
  });

  expect(screen.getByText('Revenue')).toBeInTheDocument();
});

test('a null metric shows a dash', () => {
  mockRows.rows = [{ revenue: null }];
  render(<MetricTileRenderer {...tile({}, 'Revenue')} />, { useRedux: true });

  expect(screen.getByText(NO_VALUE)).toBeInTheDocument();
});

test('a loading tile shows a placeholder', () => {
  mockRows.loading = true;
  render(<MetricTileRenderer {...tile({}, 'Revenue')} />, { useRedux: true });

  expect(screen.getByTestId('canvas-widget-loading')).toBeInTheDocument();
});
