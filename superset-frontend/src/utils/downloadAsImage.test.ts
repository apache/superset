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
import domToImage from 'dom-to-image-more';
import { getInstanceByDom } from 'echarts/core';
import { addWarningToast } from 'src/components/MessageToasts/actions';
import downloadAsImageOptimized, {
  waitForStableScrollHeight,
} from './downloadAsImage';

jest.mock('dom-to-image-more', () => ({
  __esModule: true,
  default: { toJpeg: jest.fn(), toPng: jest.fn() },
}));

jest.mock('echarts/core', () => ({
  __esModule: true,
  getInstanceByDom: jest.fn(),
}));

jest.mock('src/components/MessageToasts/actions', () => ({
  addWarningToast: jest.fn(),
}));

jest.mock('@apache-superset/core/translation', () => ({
  t: (str: string) => str,
}));

const mockToJpeg = domToImage.toJpeg as jest.Mock;
const mockToPng = domToImage.toPng as jest.Mock;
const mockAddWarningToast = addWarningToast as jest.Mock;
const mockGetInstanceByDom = getInstanceByDom as jest.Mock;

// document.fonts.ready is not implemented in jsdom; provide a resolved promise
Object.defineProperty(document, 'fonts', {
  value: { ready: Promise.resolve() },
  configurable: true,
});

// Build a synthetic React event that resolves `currentTarget.closest()` to a given element
function syntheticEventFor(el: Element) {
  return { currentTarget: { closest: () => el } } as any;
}

// Build and attach an ag-grid DOM structure; returns cleanup function
function buildAgGridElement() {
  const container = document.createElement('div');
  const agContainer = document.createElement('div');
  agContainer.setAttribute('data-themed-ag-grid', 'true');
  const agRootWrapper = document.createElement('div');
  agRootWrapper.className = 'ag-root-wrapper';
  agContainer.appendChild(agRootWrapper);
  container.appendChild(agContainer);
  document.body.appendChild(container);
  return {
    container,
    agContainer,
    agRootWrapper,
    cleanup: () => document.body.removeChild(container),
  };
}

// Attach a mock GridApi and set the first-data-rendered flag on the container
function attachMockApi(
  agContainer: HTMLElement,
  { firstDataRendered = true } = {},
) {
  const api = { setGridOption: jest.fn() };
  (agContainer as any)._agGridApi = api;
  (agContainer as any)._agGridFirstDataRendered = firstDataRendered;
  return api;
}

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks does not clear a mockReturnValue, so reset the instance lookup explicitly to
  // stop a return value leaking into any clone-path test added after the ECharts ones below.
  mockGetInstanceByDom.mockReset();
  mockToJpeg.mockResolvedValue('data:image/jpeg;base64,test');
  mockToPng.mockResolvedValue('data:image/png;base64,test');
});

afterEach(() => {
  jest.useRealTimers();
});

test('waitForStableScrollHeight resolves after 2 consecutive stable scrollHeight readings', async () => {
  jest.useFakeTimers();
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollHeight', {
    get: () => 100,
    configurable: true,
  });

  const promise = waitForStableScrollHeight(el);
  await jest.runAllTimersAsync();
  await expect(promise).resolves.toBeUndefined();

  jest.useRealTimers();
});

test('waitForStableScrollHeight respects a custom minStablePolls', async () => {
  jest.useFakeTimers();
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollHeight', {
    get: () => 100,
    configurable: true,
  });

  // With minStablePolls=5 the promise must not resolve after just 2 polls.
  const promise = waitForStableScrollHeight(el, 5000, 5);
  jest.advanceTimersByTime(300);
  let resolved = false;
  promise.then(() => {
    resolved = true;
  });
  // Flush microtasks so the .then() above has a chance to run if resolved
  await Promise.resolve();
  expect(resolved).toBe(false);

  // Now run the remaining polls (2 more stable polls → total 5) and confirm resolution.
  jest.advanceTimersByTime(300);
  await expect(promise).resolves.toBeUndefined();

  jest.useRealTimers();
});

test('waitForStableScrollHeight resets stable count when height changes mid-poll', async () => {
  jest.useFakeTimers();
  const el = document.createElement('div');
  let height = 100;
  Object.defineProperty(el, 'scrollHeight', {
    get: () => height,
    configurable: true,
  });

  const promise = waitForStableScrollHeight(el);
  // Poll 1: height is 100, stableCount becomes 1
  jest.advanceTimersByTime(100);
  // Height changes — stable counter must reset
  height = 200;
  // Run until new height stabilises (2 consecutive 100 ms polls)
  jest.advanceTimersByTime(300);
  await expect(promise).resolves.toBeUndefined();

  jest.useRealTimers();
});

test('waitForStableScrollHeight resolves after maxMs even if height never stabilises', async () => {
  jest.useFakeTimers();
  const el = document.createElement('div');
  let height = 0;
  Object.defineProperty(el, 'scrollHeight', {
    // Always increments so stableFrames never reaches 4
    get: () => {
      height += 1;
      return height;
    },
    configurable: true,
  });

  const promise = waitForStableScrollHeight(el, 200);
  jest.advanceTimersByTime(400); // past the 200 ms deadline
  await expect(promise).resolves.toBeUndefined();

  jest.useRealTimers();
});

test('waitForStableScrollHeight resolves if scrollHeight throws (element removed from DOM)', async () => {
  jest.useFakeTimers();
  const el = document.createElement('div');
  let shouldThrow = false;
  Object.defineProperty(el, 'scrollHeight', {
    get: () => {
      if (shouldThrow) throw new Error('element detached');
      return 100;
    },
    configurable: true,
  });

  const promise = waitForStableScrollHeight(el);
  jest.advanceTimersByTime(100); // poll 1: stable, stableCount = 1
  shouldThrow = true; // simulate DOM removal
  jest.advanceTimersByTime(100); // poll 2: throws → resolves immediately
  await expect(promise).resolves.toBeUndefined();

  jest.useRealTimers();
});

test('shows warning toast when element is not found', async () => {
  const handler = downloadAsImageOptimized('div', 'test');
  // closest() returning null simulates a selector that matches nothing
  await handler({ currentTarget: { closest: () => null } } as any);

  expect(mockAddWarningToast).toHaveBeenCalledWith(
    'Image download failed, please refresh and try again.',
  );
  expect(mockToJpeg).not.toHaveBeenCalled();
});

test('shows "still loading" toast when grid has not yet rendered its first rows', async () => {
  const { container, agContainer, cleanup } = buildAgGridElement();
  attachMockApi(agContainer, { firstDataRendered: false });

  const handler = downloadAsImageOptimized('div', 'My Chart');
  await handler(syntheticEventFor(container));

  expect(mockAddWarningToast).toHaveBeenCalledWith(
    'The chart is still loading. Please wait a moment and try again.',
  );
  expect(mockToJpeg).not.toHaveBeenCalled();

  cleanup();
});

test('switches to print layout, captures JPEG, and restores normal layout', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  const api = attachMockApi(agContainer);

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  expect(api.setGridOption).toHaveBeenCalledWith('domLayout', 'print');
  expect(mockToJpeg).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ quality: 0.95 }),
  );
  expect(api.setGridOption).toHaveBeenCalledWith('domLayout', 'normal');

  cleanup();
  jest.useRealTimers();
});

test('restores normal layout in finally even when image capture throws', async () => {
  jest.useFakeTimers();
  mockToJpeg.mockRejectedValue(new Error('capture failed'));
  const { container, agContainer, cleanup } = buildAgGridElement();
  const api = attachMockApi(agContainer);

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  expect(api.setGridOption).toHaveBeenCalledWith('domLayout', 'normal');
  expect(mockAddWarningToast).toHaveBeenCalledWith(
    'Image download failed, please refresh and try again.',
  );

  cleanup();
  jest.useRealTimers();
});

test('still captures image when _agGridApi is absent (graceful degradation)', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  // No API — only the first-data-rendered flag
  (agContainer as any)._agGridFirstDataRendered = true;

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  expect(mockToJpeg).toHaveBeenCalled();
  expect(mockAddWarningToast).not.toHaveBeenCalled();

  cleanup();
  jest.useRealTimers();
});

test('resolves ag-cell min-height to row pixel height when content fits within it', async () => {
  jest.useFakeTimers();
  const { container, agContainer, agRootWrapper, cleanup } =
    buildAgGridElement();
  attachMockApi(agContainer);

  // Build a row with a cell inside the grid
  const row = document.createElement('div');
  row.className = 'ag-row';
  Object.defineProperty(row, 'offsetHeight', {
    get: () => 32,
    configurable: true,
  });
  const cell = document.createElement('div');
  cell.className = 'ag-cell';
  row.appendChild(cell);
  agRootWrapper.appendChild(row);

  let capturedMinHeight = '';
  mockToJpeg.mockImplementation(() => {
    capturedMinHeight = cell.style.minHeight;
    return Promise.resolve('data:image/jpeg;base64,test');
  });

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  // Cell min-height was resolved to the row's pixel height during capture
  expect(capturedMinHeight).toBe('32px');
  // Cell min-height was restored after capture
  expect(cell.style.minHeight).toBe('');

  cleanup();
  jest.useRealTimers();
});

test('uses cell scrollHeight when it exceeds row offsetHeight (stale row heights for off-screen rows)', async () => {
  jest.useFakeTimers();
  const { container, agContainer, agRootWrapper, cleanup } =
    buildAgGridElement();
  attachMockApi(agContainer);

  const row = document.createElement('div');
  row.className = 'ag-row';
  Object.defineProperty(row, 'offsetHeight', {
    get: () => 25,
    configurable: true,
  }); // stale default
  const cell = document.createElement('div');
  cell.className = 'ag-cell';
  Object.defineProperty(cell, 'scrollHeight', {
    get: () => 120,
    configurable: true,
  }); // actual content
  row.appendChild(cell);
  agRootWrapper.appendChild(row);

  let capturedMinHeight = '';
  mockToJpeg.mockImplementation(() => {
    capturedMinHeight = cell.style.minHeight;
    return Promise.resolve('data:image/jpeg;base64,test');
  });

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  // Uses the larger content height, not the stale row height
  expect(capturedMinHeight).toBe('120px');
  expect(cell.style.minHeight).toBe('');

  cleanup();
  jest.useRealTimers();
});

test('derives image width from getColumnState by summing visible column pixel widths', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  const api = attachMockApi(agContainer);

  // 3 visible columns (200 + 350 + 150 = 700 px) plus one hidden column excluded from sum
  (api as any).getColumnState = jest.fn(() => [
    { colId: 'col1', width: 200, hide: false },
    { colId: 'col2', width: 350, hide: false },
    { colId: 'col3', width: 150, hide: false },
    { colId: 'col4', width: 999, hide: true },
  ]);
  (api as any).applyColumnState = jest.fn();

  let capturedWidth: number | undefined;
  mockToJpeg.mockImplementation(
    (_el: HTMLElement, opts: { width?: number }) => {
      capturedWidth = opts.width;
      return Promise.resolve('data:image/jpeg;base64,test');
    },
  );

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  // Width passed to toJpeg is the sum of visible column widths, not agRootWrapper.offsetWidth
  expect(capturedWidth).toBe(700);
  expect((api as any).getColumnState).toHaveBeenCalled();

  cleanup();
  jest.useRealTimers();
});

test('restores column pixel widths via applyColumnState with flex stripped after print layout', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  const api = attachMockApi(agContainer);

  const savedState = [
    { colId: 'col1', width: 300, flex: 1, hide: false },
    { colId: 'col2', width: 400, flex: 1.5, hide: false },
  ];
  (api as any).getColumnState = jest.fn(() => savedState);
  (api as any).applyColumnState = jest.fn();

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  // flex must be stripped (set to null) so pixel width is used, not flex ratio
  expect((api as any).applyColumnState).toHaveBeenCalledWith({
    state: [
      { colId: 'col1', width: 300, flex: null },
      { colId: 'col2', width: 400, flex: null },
    ],
    applyOrder: false,
  });

  cleanup();
  jest.useRealTimers();
});

test('restores original column state with flex in finally after capture', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  const api = attachMockApi(agContainer);

  const savedState = [
    { colId: 'col1', width: 300, flex: 1, hide: false },
    { colId: 'col2', width: 400, flex: 1.5, hide: false },
  ];
  (api as any).getColumnState = jest.fn(() => savedState);
  (api as any).applyColumnState = jest.fn();

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  // Last call must restore the original state (with flex) so the live grid is unaffected
  expect((api as any).applyColumnState.mock.calls.at(-1)[0]).toEqual({
    state: savedState,
    applyOrder: false,
  });

  cleanup();
  jest.useRealTimers();
});

test('falls back to agRootWrapper.offsetWidth when getColumnState returns no visible columns', async () => {
  jest.useFakeTimers();
  const { container, agContainer, agRootWrapper, cleanup } =
    buildAgGridElement();
  const api = attachMockApi(agContainer);

  // All columns hidden → visible sum is 0 → fall back to offsetWidth
  (api as any).getColumnState = jest.fn(() => [
    { colId: 'col1', width: 500, hide: true },
  ]);
  (api as any).applyColumnState = jest.fn();

  Object.defineProperty(agRootWrapper, 'offsetWidth', {
    get: () => 600,
    configurable: true,
  });

  let capturedWidth: number | undefined;
  mockToJpeg.mockImplementation(
    (_el: HTMLElement, opts: { width?: number }) => {
      capturedWidth = opts.width;
      return Promise.resolve('data:image/jpeg;base64,test');
    },
  );

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  expect(capturedWidth).toBe(600);

  cleanup();
  jest.useRealTimers();
});

test('restores ag-cell styles after capture even when toJpeg throws', async () => {
  jest.useFakeTimers();
  mockToJpeg.mockRejectedValue(new Error('capture failed'));
  const { container, agContainer, agRootWrapper, cleanup } =
    buildAgGridElement();
  attachMockApi(agContainer);

  const row = document.createElement('div');
  row.className = 'ag-row';
  Object.defineProperty(row, 'offsetHeight', {
    get: () => 28,
    configurable: true,
  });
  const cell = document.createElement('div');
  cell.className = 'ag-cell';
  cell.style.minHeight = '100%';
  cell.style.overflow = 'visible';
  row.appendChild(cell);
  agRootWrapper.appendChild(row);

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  // Styles restored to original values despite capture error
  expect(cell.style.minHeight).toBe('100%');
  expect(cell.style.overflow).toBe('visible');

  cleanup();
  jest.useRealTimers();
});

test('calls resetRowHeights after print layout to force ag-grid to re-measure rows with stale cached heights', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  const api = attachMockApi(agContainer);
  (api as any).resetRowHeights = jest.fn();

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  expect(api.setGridOption).toHaveBeenCalledWith('domLayout', 'print');
  expect((api as any).resetRowHeights).toHaveBeenCalled();
  expect(api.setGridOption).toHaveBeenCalledWith('domLayout', 'normal');

  cleanup();
  jest.useRealTimers();
});

test('does not throw when resetRowHeights is absent from the api', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  attachMockApi(agContainer); // api has only setGridOption, no resetRowHeights

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await expect(exportPromise).resolves.toBeUndefined();

  cleanup();
  jest.useRealTimers();
});

test('falls through to clone path for dashboard export with a single ag-grid chart', async () => {
  const dashboard = document.createElement('div');
  dashboard.className = 'dashboard';

  const agContainer = document.createElement('div');
  agContainer.setAttribute('data-themed-ag-grid', 'true');
  const agRootWrapper = document.createElement('div');
  agRootWrapper.className = 'ag-root-wrapper';
  agContainer.appendChild(agRootWrapper);
  (agContainer as any)._agGridFirstDataRendered = true;
  dashboard.appendChild(agContainer);
  document.body.appendChild(dashboard);

  const handler = downloadAsImageOptimized('.dashboard', 'My Dashboard', true);
  await handler({ currentTarget: {} } as any);

  expect(mockToJpeg).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ quality: 0.95 }),
  );
  expect(mockAddWarningToast).not.toHaveBeenCalled();

  document.body.removeChild(dashboard);
});

test('falls through to clone path for dashboard export with multiple ag-grid charts', async () => {
  const dashboard = document.createElement('div');
  dashboard.className = 'dashboard';

  for (let i = 0; i < 2; i += 1) {
    const agContainer = document.createElement('div');
    agContainer.setAttribute('data-themed-ag-grid', 'true');
    const agRootWrapper = document.createElement('div');
    agRootWrapper.className = 'ag-root-wrapper';
    agContainer.appendChild(agRootWrapper);
    (agContainer as any)._agGridFirstDataRendered = true;
    dashboard.appendChild(agContainer);
  }
  document.body.appendChild(dashboard);

  const handler = downloadAsImageOptimized('.dashboard', 'My Dashboard', true);
  await handler({ currentTarget: {} } as any);

  expect(mockToJpeg).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ quality: 0.95 }),
  );
  expect(mockAddWarningToast).not.toHaveBeenCalled();

  document.body.removeChild(dashboard);
});

test('captures JPEG for non-ag-grid elements via the clone path', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const handler = downloadAsImageOptimized('div', 'Bar Chart');
  await handler(syntheticEventFor(container));

  expect(mockToJpeg).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ quality: 0.95 }),
  );
  expect(mockAddWarningToast).not.toHaveBeenCalled();

  document.body.removeChild(container);
});

test('shows warning toast when clone capture throws', async () => {
  mockToJpeg.mockRejectedValue(new Error('clone capture failed'));
  const container = document.createElement('div');
  document.body.appendChild(container);

  const handler = downloadAsImageOptimized('div', 'Bar Chart');
  await handler(syntheticEventFor(container));

  expect(mockAddWarningToast).toHaveBeenCalledWith(
    'Image download failed, please refresh and try again.',
  );

  document.body.removeChild(container);
});

test('ag-grid path uses theme colorBgContainer as background', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  attachMockApi(agContainer);

  const theme = { colorBgContainer: '#1a1a2e' } as any;
  const handler = downloadAsImageOptimized('div', 'My Chart', false, theme);
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  expect(mockToJpeg).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ bgcolor: '#1a1a2e' }),
  );

  cleanup();
  jest.useRealTimers();
});

test('ag-grid path exports PNG (transparent) via toPng when format is png', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  attachMockApi(agContainer);

  const theme = { colorBgContainer: '#1a1a2e' } as any;
  const handler = downloadAsImageOptimized('div', 'My Chart', false, theme, {
    format: 'png',
    backgroundType: 'transparent',
  });
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  // format=png must route to toPng (not toJpeg) with a transparent background
  expect(mockToPng).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ bgcolor: 'transparent' }),
  );
  expect(mockToJpeg).not.toHaveBeenCalled();

  cleanup();
  jest.useRealTimers();
});

test('ag-grid path exports PNG (solid) via toPng using theme background', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  attachMockApi(agContainer);

  const theme = { colorBgContainer: '#1a1a2e' } as any;
  const handler = downloadAsImageOptimized('div', 'My Chart', false, theme, {
    format: 'png',
    backgroundType: 'solid',
  });
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  expect(mockToPng).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ bgcolor: '#1a1a2e' }),
  );
  expect(mockToJpeg).not.toHaveBeenCalled();

  cleanup();
  jest.useRealTimers();
});

test('ag-grid path falls back to white background when theme is absent', async () => {
  jest.useFakeTimers();
  const { container, agContainer, cleanup } = buildAgGridElement();
  attachMockApi(agContainer);

  const handler = downloadAsImageOptimized('div', 'My Chart');
  const exportPromise = handler(syntheticEventFor(container));
  await jest.runAllTimersAsync();
  await exportPromise;

  expect(mockToJpeg).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ bgcolor: undefined }),
  );

  cleanup();
  jest.useRealTimers();
});

test('clone path falls back to white background when theme is absent', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const handler = downloadAsImageOptimized('div', 'Bar Chart');
  await handler(syntheticEventFor(container));

  expect(mockToJpeg).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ bgcolor: undefined }),
  );

  document.body.removeChild(container);
});

// jsdom does not implement HTMLCanvasElement.getContext, so stub a minimal 2d context.
function stubCanvasContext() {
  const drawImage = jest.fn();
  const spy = jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  return { drawImage, restore: () => spy.mockRestore() };
}

test('re-renders an ECharts canvas at PNG_SCALE pixel ratio so the export is crisp', async () => {
  const { restore } = stubCanvasContext();

  const container = document.createElement('div');
  const host = document.createElement('div');
  host.className = 'echarts-host';
  const canvas = document.createElement('canvas');
  // on-screen backing store: CSS 400×300 at devicePixelRatio 1
  canvas.width = 400;
  canvas.height = 300;
  host.appendChild(canvas);
  container.appendChild(host);
  document.body.appendChild(container);

  // Fake ECharts instance whose renderToCanvas returns a 2× (high-res) canvas
  const hiRes = document.createElement('canvas');
  hiRes.width = 800;
  hiRes.height = 600;
  let renderOpts: Record<string, unknown> | undefined;
  const renderToCanvas = jest.fn((opts?: Record<string, unknown>) => {
    renderOpts = opts;
    return hiRes;
  });
  mockGetInstanceByDom.mockReturnValue({ renderToCanvas });

  // Capture the cloned canvas backing store handed to dom-to-image
  let clonedCanvasWidth: number | undefined;
  let clonedCanvasHeight: number | undefined;
  mockToPng.mockImplementation((cloneRoot: HTMLElement) => {
    const c = cloneRoot.querySelector('canvas');
    clonedCanvasWidth = c?.width;
    clonedCanvasHeight = c?.height;
    return Promise.resolve('data:image/png;base64,test');
  });

  const handler = downloadAsImageOptimized(
    'div',
    'Sunburst',
    false,
    undefined,
    { format: 'png' },
  );
  await handler(syntheticEventFor(container));

  // Instance recovered from the canvas's echarts-host ancestor...
  expect(mockGetInstanceByDom).toHaveBeenCalledWith(host);
  // ...and re-rendered at PNG_SCALE (2). No backgroundColor is forced, so the chart keeps its
  // own configured background (matching the on-screen canvas).
  expect(renderToCanvas).toHaveBeenCalled();
  expect(renderOpts).toEqual(expect.objectContaining({ pixelRatio: 2 }));
  expect(renderOpts).not.toHaveProperty('backgroundColor');
  // The cloned canvas dom-to-image serializes is the 2× high-res source
  expect(clonedCanvasWidth).toBe(800);
  expect(clonedCanvasHeight).toBe(600);
  expect(mockToPng).toHaveBeenCalled();

  restore();
  document.body.removeChild(container);
});

test('preserves a non-ECharts canvas at its on-screen resolution (no re-render)', async () => {
  const { drawImage, restore } = stubCanvasContext();

  const container = document.createElement('div');
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  container.appendChild(canvas);
  document.body.appendChild(container);

  let clonedCanvasWidth: number | undefined;
  mockToPng.mockImplementation((cloneRoot: HTMLElement) => {
    clonedCanvasWidth = cloneRoot.querySelector('canvas')?.width;
    return Promise.resolve('data:image/png;base64,test');
  });

  const handler = downloadAsImageOptimized(
    'div',
    'Deck Chart',
    false,
    undefined,
    { format: 'png' },
  );
  await handler(syntheticEventFor(container));

  // No echarts-host ancestor → echarts is never imported/consulted and the on-screen bitmap is
  // copied 1:1.
  expect(mockGetInstanceByDom).not.toHaveBeenCalled();
  expect(clonedCanvasWidth).toBe(400);
  expect(drawImage).toHaveBeenCalled();

  restore();
  document.body.removeChild(container);
});

test('falls back to a 1:1 copy when the ECharts instance is gone (getInstanceByDom returns undefined)', async () => {
  const { drawImage, restore } = stubCanvasContext();
  // Disposed / not-yet-initialised chart: the host is in the DOM but has no live instance.
  mockGetInstanceByDom.mockReturnValue(undefined);

  const container = document.createElement('div');
  const host = document.createElement('div');
  host.className = 'echarts-host';
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  host.appendChild(canvas);
  container.appendChild(host);
  document.body.appendChild(container);

  let clonedCanvasWidth: number | undefined;
  mockToPng.mockImplementation((cloneRoot: HTMLElement) => {
    clonedCanvasWidth = cloneRoot.querySelector('canvas')?.width;
    return Promise.resolve('data:image/png;base64,test');
  });

  const handler = downloadAsImageOptimized(
    'div',
    'Sunburst',
    false,
    undefined,
    { format: 'png' },
  );
  await handler(syntheticEventFor(container));

  expect(mockGetInstanceByDom).toHaveBeenCalledWith(host);
  // No instance → the on-screen bitmap is copied 1:1 and the export still completes
  expect(clonedCanvasWidth).toBe(400);
  expect(drawImage).toHaveBeenCalled();
  expect(mockToPng).toHaveBeenCalled();
  expect(mockAddWarningToast).not.toHaveBeenCalled();

  restore();
  document.body.removeChild(container);
});

test('falls back to a 1:1 copy (and still exports) when renderToCanvas throws', async () => {
  const { drawImage, restore } = stubCanvasContext();
  // A valid but unhealthy instance (mid-dispose, errored chart) whose re-render throws.
  const renderToCanvas = jest.fn(() => {
    throw new Error('chart is disposing');
  });
  mockGetInstanceByDom.mockReturnValue({ renderToCanvas });

  const container = document.createElement('div');
  const host = document.createElement('div');
  host.className = 'echarts-host';
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 300;
  host.appendChild(canvas);
  container.appendChild(host);
  document.body.appendChild(container);

  let clonedCanvasWidth: number | undefined;
  mockToPng.mockImplementation((cloneRoot: HTMLElement) => {
    clonedCanvasWidth = cloneRoot.querySelector('canvas')?.width;
    return Promise.resolve('data:image/png;base64,test');
  });

  const handler = downloadAsImageOptimized(
    'div',
    'Sunburst',
    false,
    undefined,
    { format: 'png' },
  );
  await handler(syntheticEventFor(container));

  // The throw is swallowed per-canvas: the export completes via the on-screen 1:1 copy rather
  // than aborting the whole capture.
  expect(renderToCanvas).toHaveBeenCalled();
  expect(clonedCanvasWidth).toBe(400);
  expect(drawImage).toHaveBeenCalled();
  expect(mockToPng).toHaveBeenCalled();
  expect(mockAddWarningToast).not.toHaveBeenCalled();

  restore();
  document.body.removeChild(container);
});

test('re-renders an ECharts host only once when it owns multiple canvas layers', async () => {
  const { restore } = stubCanvasContext();

  const container = document.createElement('div');
  const host = document.createElement('div');
  host.className = 'echarts-host';
  // ECharts may add a second <canvas> for a hover/progressive layer
  host.appendChild(document.createElement('canvas'));
  host.appendChild(document.createElement('canvas'));
  container.appendChild(host);
  document.body.appendChild(container);

  const hiRes = document.createElement('canvas');
  hiRes.width = 800;
  hiRes.height = 600;
  const renderToCanvas = jest.fn(() => hiRes);
  mockGetInstanceByDom.mockReturnValue({ renderToCanvas });

  const handler = downloadAsImageOptimized(
    'div',
    'Sunburst',
    false,
    undefined,
    { format: 'png' },
  );
  await handler(syntheticEventFor(container));

  // Both canvases resolve to the same instance; the flattened render happens once
  expect(renderToCanvas).toHaveBeenCalledTimes(1);

  restore();
  document.body.removeChild(container);
});
