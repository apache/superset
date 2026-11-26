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
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import EchartsRenderer from './EchartsRenderer';

const mockRows = {
  rows: [{ x: 1 }] as Record<string, unknown>[],
  loading: false,
  error: undefined as string | undefined,
};

jest.mock('../useWidgetRows', () => ({
  ...jest.requireActual('../useWidgetRows'),
  useWidgetRows: () => ({
    ...mockRows,
    query: 'SELECT 1',
    language: 'sql',
    datasource: '13__table',
    retry: jest.fn(),
  }),
}));

const mockSetOption = jest.fn();

jest.mock('echarts', () => ({
  init: () => ({
    setOption: mockSetOption,
    dispose: jest.fn(),
    resize: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  }),
}));

const widget = {
  canvasId: 7,
  nodeId: 'chart',
  widgetType: 'echarts',
  props: { echartsOptions: {} },
  filters: [],
  crossFilters: [],
  customizations: [],
  colors: { labelColors: {} },
  refreshKey: 0,
} as unknown as CanvasRendererProps;

test('the chart opts its canvas out of the widget drag', () => {
  // ECharts paints its own drag targets -- a dataZoom slider, a brush, graph
  // roam -- onto its canvas, where they are pixels rather than elements. The
  // check that stops a press on a control becoming a widget move walks the
  // DOM, so it has nothing to match, and dragging a zoom handle in a plan
  // would move the widget and persist it on release.
  render(<EchartsRenderer {...widget} />, { useRedux: true, useRouter: true });

  expect(screen.getByTestId('canvas-echarts')).toHaveAttribute(
    'data-canvas-no-drag',
  );
});

beforeEach(() => {
  mockSetOption.mockClear();
  Object.assign(mockRows, {
    rows: [{ x: 1 }],
    loading: false,
    error: undefined,
  });
});

test('a chart still loading shows a placeholder, not a blank box', () => {
  Object.assign(mockRows, { rows: [], loading: true });
  render(<EchartsRenderer {...widget} />, { useRedux: true, useRouter: true });

  expect(screen.getByTestId('canvas-widget-loading')).toBeInTheDocument();
});

test('a chart with no rows says so', () => {
  Object.assign(mockRows, { rows: [] });
  render(
    <EchartsRenderer
      {...widget}
      filters={[{ filterNodeId: 'f', value: { values: ['EMEA'] } }]}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(
    screen.getByText('No results for the current filters'),
  ).toBeInTheDocument();
});

test('a failed query keeps its message behind Details', () => {
  Object.assign(mockRows, { rows: [], error: 'column "x" does not exist' });
  render(<EchartsRenderer {...widget} />, { useRedux: true, useRouter: true });

  expect(screen.getByRole('alert')).toHaveTextContent(
    "This widget's data couldn't be loaded.",
  );
  expect(screen.queryByText('column "x" does not exist')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  expect(screen.getByText('column "x" does not exist')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

const drawnTooltip = async (echartsOptions: Record<string, unknown>) => {
  render(<EchartsRenderer {...widget} props={{ echartsOptions }} />, {
    useRedux: true,
    useRouter: true,
  });
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());
  return mockSetOption.mock.lastCall?.[0].tooltip;
};

// Canvas cells and groups clip their overflow. Rich-text tooltips are drawn
// on the chart's own canvas, and ECharts confines them to the chart when
// `confine` is unset, so a tooltip never spills past the chart into the
// cell's clipped overflow.
test('the drawn tooltip is rich text left to ECharts confinement', async () => {
  const tooltip = await drawnTooltip({ tooltip: { trigger: 'axis' } });

  expect(tooltip).toMatchObject({ trigger: 'axis', renderMode: 'richText' });
  expect(tooltip).not.toHaveProperty('confine');
});

test('every drawn tooltip of an array is rich text', async () => {
  const tooltips = await drawnTooltip({
    tooltip: [{ trigger: 'axis' }, { trigger: 'item' }],
  });

  expect(tooltips).toEqual([
    expect.objectContaining({ trigger: 'axis', renderMode: 'richText' }),
    expect.objectContaining({ trigger: 'item', renderMode: 'richText' }),
  ]);
  tooltips.forEach((tooltip: Record<string, unknown>) =>
    expect(tooltip).not.toHaveProperty('confine'),
  );
});
