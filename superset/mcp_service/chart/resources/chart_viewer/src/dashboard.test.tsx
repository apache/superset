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

/**
 * Composite rendering: a dashboard is a layout tree whose leaves are charts.
 *
 * The property that matters most is that NOTHING is silently dropped. A
 * partial composite that omits the cells it cannot render looks exactly like
 * a complete one, which is the failure mode most likely to make this read as
 * working when it is not.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardGrid } from './components/DashboardGrid';
import { getThemeTokens } from './theme';
import { isDashboardRender, extractToolResult } from './bridge';
import type { DashboardRender } from './types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;

vi.mock('./components/EChart', () => ({ EChart: () => null }));

const chart = (id: number, name: string) => ({
  chart_id: id,
  chart_name: name,
  chart_type: 'echarts_timeseries_line',
  columns: [
    { name: 'ds', display_name: 'ds', data_type: 'temporal' },
    { name: 'v', display_name: 'v', data_type: 'numeric' },
  ],
  data: [{ ds: '2026-01-01', v: 1 }],
  row_count: 1,
  total_rows: 1,
});

const RENDER: DashboardRender = {
  dashboard_id: 7,
  dashboard_title: 'Sales',
  tabs: [
    { id: 'TAB-a', name: 'Overview' },
    { id: 'TAB-b', name: 'Detail' },
  ],
  cells: [
    { chart_id: 1, title: 'Revenue', tab_id: 'TAB-a', status: 'ok', data: chart(1, 'Revenue') as never },
    { chart_id: 2, title: 'Map', tab_id: 'TAB-a', status: 'error', message: 'Unsupported viz type' },
    { chart_id: 3, title: 'Later', tab_id: 'TAB-a', status: 'skipped', message: 'Beyond the limit' },
    { chart_id: 4, title: 'Detail chart', tab_id: 'TAB-b', status: 'ok', data: chart(4, 'Detail chart') as never },
  ],
  chart_count: 4,
  rendered_count: 2,
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(r: DashboardRender): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container!);
    root.render(<DashboardGrid render={r} theme={getThemeTokens('light')} />);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

it('renders a cell for every leaf, including ones it cannot draw', () => {
  render(RENDER);
  // Tab A holds three leaves: one chart, one error, one skipped. All three
  // must appear — dropping the undrawable two would make a partial render
  // indistinguishable from a complete one.
  expect(container!.querySelectorAll('.sv-dash-cell')).toHaveLength(3);
  expect(container!.querySelectorAll('.sv-dash-cell--empty')).toHaveLength(2);
});

it('explains why an undrawable cell is empty rather than leaving a gap', () => {
  render(RENDER);
  const text = container!.textContent ?? '';
  expect(text).toContain('Unsupported viz type');
  expect(text).toContain('Beyond the limit');
});

it('switches tabs without re-querying, since cells carry their tab', () => {
  render(RENDER);
  const tabs = container!.querySelectorAll('[role="tab"]');
  expect(tabs).toHaveLength(2);
  act(() => {
    (tabs[1] as HTMLButtonElement).click();
  });
  expect(container!.querySelectorAll('.sv-dash-cell')).toHaveLength(1);
  expect(container!.textContent).toContain('Detail chart');
});

it('distinguishes a dashboard payload from a chart payload on the wire', () => {
  expect(isDashboardRender(RENDER)).toBe(true);
  expect(isDashboardRender(chart(1, 'x'))).toBe(false);
  // FastMCP wraps union returns, so the dashboard arrives inside `result`.
  const { dashboard, chartData } = extractToolResult({
    structuredContent: { result: RENDER },
  });
  expect(dashboard?.dashboard_id).toBe(7);
  expect(chartData).toBeNull();
});

it('opens the tab that was requested, not blindly the first one', () => {
  // A tab-filtered render still returns EVERY tab so the user can switch, so
  // tabs[0] can legitimately hold nothing. Opening it showed "no charts" on a
  // render that had five.
  render({
    ...RENDER,
    active_tab_id: 'TAB-b',
    cells: RENDER.cells.filter((c) => c.tab_id === 'TAB-b'),
  });
  expect(container!.querySelectorAll('.sv-dash-cell')).toHaveLength(1);
  expect(container!.textContent).toContain('Detail chart');
});

it('falls back to the first tab that actually has cells', () => {
  // No active_tab_id (an older server, or an unfiltered render whose first
  // tab is simply empty).
  render({
    ...RENDER,
    cells: RENDER.cells.filter((c) => c.tab_id === 'TAB-b'),
  });
  expect(container!.querySelectorAll('.sv-dash-cell')).toHaveLength(1);
  const tabs = container!.querySelectorAll('[role="tab"]');
  expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  // The empty tab stays reachable, but is marked rather than looking broken.
  expect(tabs[0].className).toContain('sv-chip--empty');
});

it('says when a cell is not the chart Superset draws', () => {
  // Dashboard 5's Overview tab holds a treemap_v2 and a heatmap_v2. Neither
  // has a renderer here, so both fell through to bar charts — keeping the real
  // title and the real numbers, which made the grid read as a faithful
  // reproduction of the dashboard. It was not.
  const treemap = {
    ...chart(9, 'Sales by publisher'),
    chart_type: 'treemap_v2',
  };
  render({
    ...RENDER,
    tabs: [],
    cells: [
      { chart_id: 9, title: 'Sales by publisher', status: 'ok', data: treemap as never },
    ],
  });
  const note = container!.querySelector('.sv-substitution');
  expect(note).not.toBeNull();
  expect(note!.textContent).toContain('treemap');
});

it('stays quiet for a chart it renders faithfully', () => {
  render({
    ...RENDER,
    tabs: [],
    cells: [{ chart_id: 1, title: 'Revenue', status: 'ok', data: chart(1, 'Revenue') as never }],
  });
  expect(container!.querySelector('.sv-substitution')).toBeNull();
});
