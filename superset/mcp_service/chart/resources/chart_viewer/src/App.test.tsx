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

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

import type { ChartData } from './types';

// Tells React that act() is legitimate here (we drive rendering manually
// rather than through a testing-library adapter).
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom implements neither ResizeObserver nor canvas, both of which the
// ECharts renderer touches on mount. Stub the observer and mock the chart
// component away: these tests assert the surrounding chrome, not the plot.
globalThis.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;

// The app reports its size from inside requestAnimationFrame; run callbacks
// synchronously so assertions can run right after render.
window.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
  cb(0);
  return 0;
}) as typeof window.requestAnimationFrame;

vi.mock('./components/EChart', () => ({
  EChart: () => null,
}));

const reportSize = vi.fn();
const requestDisplayMode = vi.fn().mockResolvedValue(false);

// A chart payload shaped exactly like a live render_chart result: the MCP
// service wraps the name and insights in UNTRUSTED-CONTENT markers.
const WRAPPED: ChartData = {
  chart_id: 113,
  chart_name: '<UNTRUSTED-CONTENT>\nMonthly Revenue Trend\n</UNTRUSTED-CONTENT>',
  chart_type: 'echarts_timeseries_line',
  columns: [
    { name: 'order_date', display_name: 'Order Date', data_type: 'temporal' },
    { name: 'Revenue', display_name: 'Revenue', data_type: 'numeric' },
  ],
  data: [
    { order_date: '2003-01-31T00:00:00', Revenue: 44621.96 },
    { order_date: '2003-11-12T00:00:00', Revenue: 111156.73 },
  ],
  row_count: 2,
  total_rows: 2,
  insights: ['<UNTRUSTED-CONTENT>\nFresh data retrieved from database\n</UNTRUSTED-CONTENT>'],
} as unknown as ChartData;

vi.mock('./bridge', () => ({
  ChartBridge: class {
    initialize = vi.fn().mockResolvedValue({
      chartData: WRAPPED,
      meta: {},
      context: { scheme: 'light' },
      capabilities: { canCallTool: false },
      connected: true,
      embedded: true,
    });
    onToolResult = vi.fn(() => () => {});
    onContextChange = vi.fn(() => () => {});
    hasTool = vi.fn(() => false);
    reportSize = reportSize;
    requestDisplayMode = requestDisplayMode;
    callTool = vi.fn();
    updateModelContext = vi.fn();
    sendMessage = vi.fn();
    openLink = vi.fn();
  },
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function renderApp(): Promise<void> {
  const { App } = await import('./App');
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container!);
    root.render(<App />);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
});

it('renders the chart title without UNTRUSTED-CONTENT markers', async () => {
  await renderApp();
  const title = container!.querySelector('.sv-title');
  expect(title).not.toBeNull();
  expect(title!.textContent).toBe('Monthly Revenue Trend');
  expect(container!.innerHTML).not.toContain('UNTRUSTED-CONTENT');
});

it('renders the insight line without UNTRUSTED-CONTENT markers', async () => {
  await renderApp();
  const insights = container!.querySelector('.sv-insights');
  expect(insights).not.toBeNull();
  expect(insights!.textContent).toContain('Fresh data retrieved from database');
  expect(insights!.textContent).not.toContain('UNTRUSTED-CONTENT');
});

it('asks the host for a taller frame once data has arrived', async () => {
  await renderApp();
  expect(reportSize).toHaveBeenCalled();
  const [, height] = reportSize.mock.calls[0] as [number, number];
  expect(height).toBeGreaterThanOrEqual(420);
});

it('offers a drag handle and a maximize toggle', async () => {
  await renderApp();
  expect(container!.querySelector('.sv-resize-handle')).not.toBeNull();
  const button = container!.querySelector('.sv-maximize');
  expect(button).not.toBeNull();
  expect(button!.getAttribute('aria-label')).toBe('Maximize chart');
});

it('grows in place when the host refuses a fullscreen display mode', async () => {
  requestDisplayMode.mockResolvedValueOnce(false);
  await renderApp();
  const button = container!.querySelector('.sv-maximize') as HTMLButtonElement;
  await act(async () => {
    button.click();
  });
  expect(requestDisplayMode).toHaveBeenCalledWith('fullscreen');
  // Fallback path: the widget sizes itself up and tells the host.
  const calls = reportSize.mock.calls;
  const last = calls[calls.length - 1] as [number, number];
  expect(last[1]).toBeGreaterThanOrEqual(720);
});

it('offers exports the current host can actually perform', async () => {
  await renderApp();
  const exportButton = container!.querySelector(
    '[aria-haspopup="menu"]',
  ) as HTMLButtonElement;
  expect(exportButton).not.toBeNull();
  await act(async () => {
    exportButton.click();
  });
  const labels = Array.from(
    container!.querySelectorAll('[role="menuitem"]'),
  ).map((b) => b.textContent);
  // jsdom is a top-level document, so file downloads are on offer...
  expect(labels).toContain('Download CSV');
  expect(labels).toContain('Copy CSV');
  // ...but this mocked host advertises neither ui/message nor
  // ui/update-model-context, so handing the data to the assistant is not
  // offered as a button that would silently do nothing.
  expect(labels).not.toContain('Send data to the assistant');
});

it('does not resize itself when the host accepts fullscreen', async () => {
  requestDisplayMode.mockResolvedValueOnce(true);
  await renderApp();
  reportSize.mockClear();
  const button = container!.querySelector('.sv-maximize') as HTMLButtonElement;
  await act(async () => {
    button.click();
  });
  expect(requestDisplayMode).toHaveBeenCalledWith('fullscreen');
  expect(reportSize).not.toHaveBeenCalled();
});
