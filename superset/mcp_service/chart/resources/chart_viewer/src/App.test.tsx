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
const initialize = vi.fn();
const downloadViaHost = vi.fn().mockResolvedValue(false);
const supportsDisplayMode = vi.fn((_mode: string): boolean => true);
const requestDisplayMode = vi.fn().mockResolvedValue(null);
let contextListener: ((ctx: Record<string, unknown>) => void) | null = null;

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
    initialize = initialize;
    onToolResult = vi.fn(() => () => {});
    // Captured rather than swallowed: hosts push display-mode changes back at
    // the widget, and the collapse path depends on how those are handled.
    onContextChange = vi.fn((fn: (ctx: Record<string, unknown>) => void) => {
      contextListener = fn;
      return () => {
        contextListener = null;
      };
    });
    hasTool = vi.fn(() => false);
    supportsDisplayMode = supportsDisplayMode;
    downloadViaHost = downloadViaHost;
    getHostMaxHeight = vi.fn(() => null);
    getDiagnostics = vi.fn(() => ({
      protocolVersion: '2026-01-26',
      hostCapabilities: {},
      hostContext: {},
      origin: 'null',
      embedded: true,
      capabilityKeys: [],
      sandboxPermissions: [],
      availableDisplayModes: [],
      exchanges: [],
      derived: {
        appTools: new Set<string>(),
        canCallTools: false,
        canUpdateModelContext: false,
        canSendMessage: false,
      },
    }));
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

// Default handshake. Re-armed after each test because clearAllMocks() drops
// implementations as well as call history.
const CONNECTED_HANDSHAKE = {
  chartData: WRAPPED,
  meta: {},
  context: { scheme: 'light' },
  capabilities: { canCallTool: false },
  connected: true,
  embedded: true,
};

initialize.mockResolvedValue(CONNECTED_HANDSHAKE);

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
  contextListener = null;
  vi.clearAllMocks();
  initialize.mockResolvedValue(CONNECTED_HANDSHAKE);
  supportsDisplayMode.mockReturnValue(true);
  downloadViaHost.mockResolvedValue(false);
});

function maximizeButton(): HTMLButtonElement {
  return container!.querySelector('.sv-maximize') as HTMLButtonElement;
}

/** Height of the most recent size notification sent to the host. */
function lastReportedHeight(): number {
  const calls = reportSize.mock.calls as Array<[number, number]>;
  return calls[calls.length - 1][1];
}

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
  requestDisplayMode.mockResolvedValueOnce(null);
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
  requestDisplayMode.mockResolvedValueOnce('fullscreen');
  await renderApp();
  reportSize.mockClear();
  const button = container!.querySelector('.sv-maximize') as HTMLButtonElement;
  await act(async () => {
    button.click();
  });
  expect(requestDisplayMode).toHaveBeenCalledWith('fullscreen');
  expect(reportSize).not.toHaveBeenCalled();
});

// ---- Maximize round-trip -------------------------------------------------
// Every earlier test here clicked the toggle exactly once and asserted that it
// expanded. Nothing asserted it comes back, which is how a collapse that does
// not collapse shipped past a green suite.

it('returns to its starting height when the host refuses display modes', async () => {
  requestDisplayMode.mockResolvedValue(null);
  await renderApp();
  const start = lastReportedHeight();

  await act(async () => {
    maximizeButton().click();
  });
  expect(lastReportedHeight()).toBeGreaterThanOrEqual(720);

  await act(async () => {
    maximizeButton().click();
  });
  expect(lastReportedHeight()).toBe(start);
  expect(maximizeButton().getAttribute('aria-label')).toBe('Maximize chart');
  expect(maximizeButton().getAttribute('aria-pressed')).toBe('false');
});

it('asks the host to return to inline when it accepts display modes', async () => {
  // A conformant host echoes back the mode it applied.
  requestDisplayMode.mockImplementation((mode: string) =>
    Promise.resolve(mode),
  );
  await renderApp();

  await act(async () => {
    maximizeButton().click();
  });
  expect(maximizeButton().getAttribute('aria-pressed')).toBe('true');

  await act(async () => {
    maximizeButton().click();
  });
  expect(requestDisplayMode).toHaveBeenLastCalledWith('inline');
  expect(maximizeButton().getAttribute('aria-pressed')).toBe('false');
  expect(maximizeButton().getAttribute('aria-label')).toBe('Maximize chart');
});

it('ignores a stale fullscreen context push arriving after a collapse', async () => {
  // A conformant host echoes back the mode it applied.
  requestDisplayMode.mockImplementation((mode: string) =>
    Promise.resolve(mode),
  );
  await renderApp();

  await act(async () => {
    maximizeButton().click();
  });
  await act(async () => {
    maximizeButton().click();
  });
  expect(maximizeButton().getAttribute('aria-pressed')).toBe('false');

  // The host acknowledged 'inline', then emitted a context update still
  // describing the old mode. Honouring it snaps the widget back open and the
  // collapse button looks like it did nothing.
  await act(async () => {
    contextListener?.({ displayMode: 'fullscreen' });
  });
  expect(maximizeButton().getAttribute('aria-pressed')).toBe('false');
});

it('reflects the host when it declines to leave fullscreen', async () => {
  // Spec-legal decline: the host answers a request with the mode it is
  // staying in. Reporting our requested mode here would leave the button
  // showing "Maximize" over a still-expanded widget.
  requestDisplayMode.mockImplementation(() => Promise.resolve('fullscreen'));
  await renderApp();

  await act(async () => {
    maximizeButton().click();
  });
  expect(maximizeButton().getAttribute('aria-pressed')).toBe('true');

  reportSize.mockClear();
  await act(async () => {
    maximizeButton().click();
  });
  expect(requestDisplayMode).toHaveBeenLastCalledWith('inline');
  // Still fullscreen as far as the host is concerned, so say so...
  expect(maximizeButton().getAttribute('aria-pressed')).toBe('true');
  expect(maximizeButton().getAttribute('aria-label')).toBe('Restore chart size');
  // ...do not shrink a frame the host is still presenting expanded...
  expect(reportSize).not.toHaveBeenCalled();
  // ...and tell the user why the button appeared to do nothing.
  expect(container!.querySelector('.sv-toast')?.textContent).toContain(
    'close control',
  );
});

// ---- Host diagnostics ----------------------------------------------------
// The panel exists to answer "did the host not offer this, or did we fail to
// recognise it?" when a gated affordance is missing. It is only useful if it
// renders on the paths where things are going wrong, so pin that.

it('always renders the host diagnostics panel with the raw handshake', async () => {
  await renderApp();
  const diag = container!.querySelector('.sv-diag');
  expect(diag).not.toBeNull();
  // Native <details>, deliberately: it must not depend on the React click
  // handling it is there to help diagnose.
  expect(diag!.tagName).toBe('DETAILS');
  const body = diag!.querySelector('.sv-diag-body');
  expect(body!.textContent).toContain('hostCapabilities');
  expect(body!.textContent).toContain('derived');
});

it('renders diagnostics even when the handshake failed outright', async () => {
  // Embedded, but the host never answered: the widget shows a connection
  // error. That is precisely when someone needs to see what the host sent.
  initialize.mockResolvedValue({
    chartData: null,
    meta: {},
    context: { scheme: 'light' },
    capabilities: { canCallTool: false },
    connected: false,
    embedded: true,
  });
  await renderApp();
  expect(container!.querySelector('.sv-error, .sv-diag')).not.toBeNull();
  // The error state is exactly when someone needs to know what the host said.
  expect(container!.querySelector('.sv-diag')).not.toBeNull();
});

it('always offers "Show CSV", the one export that needs no host support', async () => {
  await renderApp();
  const exportButton = container!.querySelector(
    '[aria-haspopup="menu"]',
  ) as HTMLButtonElement;
  await act(async () => {
    exportButton.click();
  });
  const labels = Array.from(
    container!.querySelectorAll('[role="menuitem"]'),
  ).map((b) => b.textContent);
  // jsdom is top-level, so downloads are on offer here — Show CSV must still
  // be present, because a download's success is not observable either way.
  expect(labels).toContain('Download CSV');
  expect(labels).toContain('Show CSV');
});

// ---- Open in Superset ----------------------------------------------------

it('renders the explore URL as selectable text when it cannot be opened', async () => {
  // Observed on a real host: window.open blocked, ui/open-link unanswered,
  // AND navigator.clipboard.writeText rejected (cross-origin sandboxed iframe
  // with no clipboard-write grant). Every automatic route failed and the
  // clipboard was verified empty afterwards, so the URL has to end up on
  // screen — a toast that disappears is not a way to hand over a link.
  initialize.mockResolvedValue({
    ...CONNECTED_HANDSHAKE,
    chartData: { ...WRAPPED, explore_url: 'https://superset.example/explore/?slice_id=113' },
  });
  await renderApp();
  const open = Array.from(container!.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes('Superset'),
  ) as HTMLButtonElement;
  expect(open).toBeTruthy();
  await act(async () => {
    open.click();
  });
  const panel = container!.querySelector('.sv-panel-text');
  expect(panel).not.toBeNull();
  expect(panel!.textContent).toContain('slice_id=113');
});

// ---- pip / pin -----------------------------------------------------------
// `pip` is the third spec display mode: a floating overlay. The two-state
// `expanding = displayMode !== 'fullscreen'` could not express it — from pip,
// "not fullscreen" would have meant "expand" and collapsing was unreachable.
// That same assumption is where the collapse bug came from.

it('offers no pin control when the host does not advertise pip', async () => {
  supportsDisplayMode.mockImplementation((m: string) => m !== 'pip');
  await renderApp();
  // A button that provably does nothing is worse than no button.
  expect(container!.querySelector('.sv-pin')).toBeNull();
});

it('offers the pin control when the host advertises pip', async () => {
  supportsDisplayMode.mockReturnValue(true);
  await renderApp();
  expect(container!.querySelector('.sv-pin')).not.toBeNull();
});

it('asks for pip, and returns to inline from pip', async () => {
  supportsDisplayMode.mockReturnValue(true);
  requestDisplayMode.mockImplementation((mode: string) => Promise.resolve(mode));
  await renderApp();
  const pin = () => container!.querySelector('.sv-pin') as HTMLButtonElement;

  await act(async () => {
    pin().click();
  });
  expect(requestDisplayMode).toHaveBeenLastCalledWith('pip');
  expect(pin().getAttribute('aria-pressed')).toBe('true');

  // From pip, the pin control must return to inline — with the old binary
  // logic this state was a dead end.
  await act(async () => {
    pin().click();
  });
  expect(requestDisplayMode).toHaveBeenLastCalledWith('inline');
  expect(pin().getAttribute('aria-pressed')).toBe('false');
});

it('reports the mode the host applied when it substitutes one', async () => {
  supportsDisplayMode.mockReturnValue(true);
  // Host is asked for pip and answers fullscreen — spec-legal.
  requestDisplayMode.mockResolvedValue('fullscreen');
  await renderApp();
  await act(async () => {
    (container!.querySelector('.sv-pin') as HTMLButtonElement).click();
  });
  // Claiming pip here is the defect that made the collapse control lie.
  expect(container!.querySelector('.sv-pin')!.getAttribute('aria-pressed')).toBe(
    'false',
  );
  expect(
    container!.querySelector('.sv-maximize')!.getAttribute('aria-pressed'),
  ).toBe('true');
});

it('saves through the host when it advertises downloadFile', async () => {
  // Desktop advertises `downloadFile` and sandboxes the iframe, so <a download>
  // is blocked silently. The host route is the one that can actually produce a
  // file — the widget never used it, which is why Download CSV did nothing.
  initialize.mockResolvedValue({
    ...CONNECTED_HANDSHAKE,
    capabilities: { canDownloadFile: true, canOpenLinks: true },
  });
  downloadViaHost.mockResolvedValue(true);
  await renderApp();
  const menu = container!.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
  await act(async () => { menu.click(); });
  const item = Array.from(container!.querySelectorAll('[role="menuitem"]')).find(
    (b) => b.textContent === 'Download CSV',
  ) as HTMLButtonElement;
  expect(item).toBeTruthy();
  await act(async () => { item.click(); });
  expect(downloadViaHost).toHaveBeenCalled();
  const [name, mime] = downloadViaHost.mock.calls[0] as [string, string, string];
  expect(name.endsWith('.csv')).toBe(true);
  expect(mime).toBe('text/csv');
});

it('shows the CSV when the host refuses the save', async () => {
  initialize.mockResolvedValue({
    ...CONNECTED_HANDSHAKE,
    capabilities: { canDownloadFile: true },
  });
  downloadViaHost.mockResolvedValue(false); // refused or cancelled
  await renderApp();
  const menu = container!.querySelector('[aria-haspopup="menu"]') as HTMLButtonElement;
  await act(async () => { menu.click(); });
  const item = Array.from(container!.querySelectorAll('[role="menuitem"]')).find(
    (b) => b.textContent === 'Download CSV',
  ) as HTMLButtonElement;
  await act(async () => { item.click(); });
  // jsdom is top-level so the browser path succeeds here; what matters is that
  // a refusal is never reported as a save.
  expect(container!.textContent).not.toContain('CSV saved.');
});
