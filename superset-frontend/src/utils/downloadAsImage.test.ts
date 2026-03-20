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
import { addWarningToast } from 'src/components/MessageToasts/actions';
import downloadAsImageOptimized, {
  waitForStableScrollHeight,
} from './downloadAsImage';

jest.mock('dom-to-image-more', () => ({
  __esModule: true,
  default: { toJpeg: jest.fn() },
}));

jest.mock('src/components/MessageToasts/actions', () => ({
  addWarningToast: jest.fn(),
}));

jest.mock('@apache-superset/core/translation', () => ({
  t: (str: string) => str,
}));

const mockToJpeg = domToImage.toJpeg as jest.Mock;
const mockAddWarningToast = addWarningToast as jest.Mock;

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
  mockToJpeg.mockResolvedValue('data:image/jpeg;base64,test');
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
  await promise;

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
  promise.then(() => { resolved = true; });
  // Flush microtasks so the .then() above has a chance to run if resolved
  await Promise.resolve();
  expect(resolved).toBe(false);

  // Now run the remaining polls (2 more stable polls → total 5) and confirm resolution.
  jest.advanceTimersByTime(300);
  await promise;

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
  await promise;

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
  await promise;

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
  await promise;

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
  Object.defineProperty(row, 'offsetHeight', { get: () => 32, configurable: true });
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
  Object.defineProperty(row, 'offsetHeight', { get: () => 25, configurable: true }); // stale default
  const cell = document.createElement('div');
  cell.className = 'ag-cell';
  Object.defineProperty(cell, 'scrollHeight', { get: () => 120, configurable: true }); // actual content
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
  mockToJpeg.mockImplementation((_el: HTMLElement, opts: { width?: number }) => {
    capturedWidth = opts.width;
    return Promise.resolve('data:image/jpeg;base64,test');
  });

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
  mockToJpeg.mockImplementation((_el: HTMLElement, opts: { width?: number }) => {
    capturedWidth = opts.width;
    return Promise.resolve('data:image/jpeg;base64,test');
  });

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
  Object.defineProperty(row, 'offsetHeight', { get: () => 28, configurable: true });
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
    expect.objectContaining({ bgcolor: '#ffffff' }),
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
    expect.objectContaining({ bgcolor: '#ffffff' }),
  );

  document.body.removeChild(container);
});
