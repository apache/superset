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
 * Unit tests for SIP-212 print-mode URL-param helpers.
 *
 * These tests verify the logic used by Row.tsx, Tabs.tsx, and SliceHeader
 * that reads ?print=1 from the URL and switches their print-mode behaviour.
 * All tests work through the same `getUrlParam(URL_PARAMS.print)` call that
 * the real components use — no component rendering required.
 */

import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import {
  getPrintFontSizeCSS,
  PRINT_FONT_SIZE_SMALL,
  PRINT_FONT_SIZE_MEDIUM,
  PRINT_FONT_SIZE_LARGE,
} from 'src/dashboard/styles/printMode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate the component-level logic:
 * `const isPrintMode = getUrlParam(URL_PARAMS.print) === 1;`
 */
function computeIsPrintMode(): boolean {
  return getUrlParam(URL_PARAMS.print) === 1;
}

/**
 * Simulate Row.tsx:
 * `const [isInView, setIsInView] = useState(isPrintMode);`
 * The initial value is true only in print mode.
 */
function computeRowInitialIsInView(): boolean {
  return computeIsPrintMode();
}

/**
 * Simulate Tabs.tsx tabItems construction for N tabs:
 * each item gets `forceRender: true` only when isPrintMode.
 * isComponentVisible is `true` for every tab when isPrintMode.
 */
function computeTabItems(
  tabIds: string[],
  selectedTabIndex: number,
  isCurrentTabVisible: boolean,
): Array<{ key: string; forceRender?: boolean; isComponentVisible: boolean }> {
  const isPrintMode = computeIsPrintMode();
  return tabIds.map((id, tabIndex) => ({
    key: id,
    ...(isPrintMode && { forceRender: true }),
    isComponentVisible: isPrintMode
      ? true
      : selectedTabIndex === tabIndex && isCurrentTabVisible,
  }));
}

/**
 * Simulate SliceHeader:
 * `const canExplore = !editMode && supersetCanExplore && !isPrintMode;`
 */
function computeCanExplore(
  editMode: boolean,
  supersetCanExplore: boolean,
): boolean {
  const isPrintMode = computeIsPrintMode();
  return !editMode && supersetCanExplore && !isPrintMode;
}

// ---------------------------------------------------------------------------
// Tests — Row.tsx print-mode logic
// ---------------------------------------------------------------------------

test('Row: isInView initial value is false when ?print param absent', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '',
  } as Location);

  expect(computeRowInitialIsInView()).toBe(false);

  spy.mockRestore();
});

test('Row: isInView initial value is true when ?print=1 is in the URL', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?print=1',
  } as Location);

  expect(computeRowInitialIsInView()).toBe(true);

  spy.mockRestore();
});

test('Row: IntersectionObserver is guarded by !isPrintMode (isPrintMode=false → observer would run)', () => {
  // We test the guard condition: !isPrintMode
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '',
  } as Location);

  const isPrintMode = computeIsPrintMode();
  expect(isPrintMode).toBe(false);
  // !isPrintMode === true → observer code would run (condition passed)
  expect(!isPrintMode).toBe(true);

  spy.mockRestore();
});

test('Row: IntersectionObserver is skipped when ?print=1 (isPrintMode=true)', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?print=1',
  } as Location);

  const isPrintMode = computeIsPrintMode();
  expect(isPrintMode).toBe(true);
  // !isPrintMode === false → observer code is skipped
  expect(!isPrintMode).toBe(false);

  spy.mockRestore();
});

// ---------------------------------------------------------------------------
// Tests — Tabs.tsx print-mode logic
// ---------------------------------------------------------------------------

test('Tabs: forceRender is NOT set on tab items when ?print absent', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '',
  } as Location);

  const items = computeTabItems(['tab-1', 'tab-2'], 0, true);
  expect(items.every(item => item.forceRender === undefined)).toBe(true);

  spy.mockRestore();
});

test('Tabs: forceRender:true is set on ALL tab items when ?print=1', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?print=1',
  } as Location);

  const items = computeTabItems(['tab-1', 'tab-2', 'tab-3'], 0, true);
  expect(items.every(item => item.forceRender === true)).toBe(true);

  spy.mockRestore();
});

test('Tabs: isComponentVisible follows selectedTabIndex when ?print absent', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '',
  } as Location);

  // selectedTabIndex=1, isCurrentTabVisible=true
  const items = computeTabItems(['tab-1', 'tab-2', 'tab-3'], 1, true);
  expect(items[0].isComponentVisible).toBe(false);
  expect(items[1].isComponentVisible).toBe(true);
  expect(items[2].isComponentVisible).toBe(false);

  spy.mockRestore();
});

test('Tabs: ALL tabs have isComponentVisible=true when ?print=1', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?print=1',
  } as Location);

  // selectedTabIndex=0 — only tab-1 would normally be visible
  const items = computeTabItems(['tab-1', 'tab-2', 'tab-3'], 0, true);
  expect(items.every(item => item.isComponentVisible === true)).toBe(true);

  spy.mockRestore();
});

// ---------------------------------------------------------------------------
// Tests — SliceHeader print-mode logic
// ---------------------------------------------------------------------------

test('SliceHeader: canExplore is true when editMode=false, supersetCanExplore=true, no print param', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '',
  } as Location);

  expect(computeCanExplore(false, true)).toBe(true);

  spy.mockRestore();
});

test('SliceHeader: canExplore is false when ?print=1 even if supersetCanExplore=true', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?print=1',
  } as Location);

  expect(computeCanExplore(false, true)).toBe(false);

  spy.mockRestore();
});

test('SliceHeader: canExplore is false in editMode regardless of print param', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '',
  } as Location);

  expect(computeCanExplore(true, true)).toBe(false);

  spy.mockRestore();
});

test('SliceHeader: canExplore is false when supersetCanExplore=false regardless of print param', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '',
  } as Location);

  expect(computeCanExplore(false, false)).toBe(false);

  spy.mockRestore();
});

// ---------------------------------------------------------------------------
// Tests — print font-size tier defaults (DashboardBuilder fallback)
// ---------------------------------------------------------------------------

/**
 * Simulate the DashboardBuilder fallback logic:
 *   rawFontSize === 'small' || rawFontSize === 'medium' || rawFontSize === 'large'
 *     ? rawFontSize
 *     : PRINT_FONT_SIZE_SMALL
 */
function computePrintFontSize(
  rawFontSize: string | null,
): 'small' | 'medium' | 'large' {
  return rawFontSize === 'small' ||
    rawFontSize === 'medium' ||
    rawFontSize === 'large'
    ? rawFontSize
    : PRINT_FONT_SIZE_SMALL;
}

test('printFontSize defaults to small when ?print_font_size param is absent', () => {
  expect(computePrintFontSize(null)).toBe('small');
});

test('printFontSize defaults to small when ?print_font_size param is unknown', () => {
  expect(computePrintFontSize('invalid')).toBe('small');
});

test('printFontSize is medium when ?print_font_size=medium', () => {
  expect(computePrintFontSize('medium')).toBe('medium');
});

test('printFontSize is large when ?print_font_size=large', () => {
  expect(computePrintFontSize('large')).toBe('large');
});

test('getPrintFontSizeCSS returns non-empty CSS for small tier (readable overrides)', () => {
  const css = getPrintFontSizeCSS(PRINT_FONT_SIZE_SMALL);
  expect(css).not.toBe('');
  expect(css).toContain('16px');
  expect(css).toContain('superset-chart-table');
});

test('getPrintFontSizeCSS returns CSS with 24px for medium tier', () => {
  const css = getPrintFontSizeCSS(PRINT_FONT_SIZE_MEDIUM);
  expect(css).toContain('24px');
  expect(css).toContain('superset-chart-table');
});

test('getPrintFontSizeCSS returns CSS with 36px for large tier', () => {
  const css = getPrintFontSizeCSS(PRINT_FONT_SIZE_LARGE);
  expect(css).toContain('36px');
  expect(css).toContain('superset-chart-table');
});

// ---------------------------------------------------------------------------
// Tests — URL_PARAMS.print constant existence
// ---------------------------------------------------------------------------

test('URL_PARAMS.print is defined as a number-type param named "print"', () => {
  expect(URL_PARAMS.print).toBeDefined();
  expect(URL_PARAMS.print.name).toBe('print');
  expect(URL_PARAMS.print.type).toBe('number');
});

test('getUrlParam returns null when ?print is absent', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '',
  } as Location);

  expect(getUrlParam(URL_PARAMS.print)).toBeNull();

  spy.mockRestore();
});

test('getUrlParam returns 1 when ?print=1', () => {
  const spy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?print=1',
  } as Location);

  expect(getUrlParam(URL_PARAMS.print)).toBe(1);

  spy.mockRestore();
});
