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
import { renderHook, act } from '@testing-library/react';
import { logging } from '@apache-superset/core/utils';
import type { common } from '@apache-superset/core';
import type { MenuItem, MenuItemType } from '@superset-ui/core/components/Menu';
import { commands, menus } from 'src/core';
import {
  useExtensionMenuItems,
  ChartDownloadProvider,
  useChartDownloadItems,
} from '.';

const ctx = {
  getPayload: async () => ({
    datasource: { id: 1, type: 'table' },
    queries: [],
    result_type: 'full',
    result_format: 'json',
  }),
  chartName: 'Sales',
  canDownload: true,
};

const click = (item: MenuItem) => (item as MenuItemType).onClick?.({} as never);

let disposables: common.Disposable[] = [];

const register = (
  id: string,
  title: string,
  location: Parameters<typeof menus.registerMenuItem>[1],
  run: (...args: unknown[]) => unknown = jest.fn(),
) => {
  disposables.push(
    commands.registerCommand({ id, title }, run),
    menus.registerMenuItem(
      { view: location, command: id },
      location,
      'primary',
    ),
  );
};

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables = [];
  jest.restoreAllMocks();
});

test('returns no items when nothing is registered', () => {
  const { result } = renderHook(() =>
    useExtensionMenuItems('explore.chart.download', ctx),
  );
  expect(result.current).toEqual([]);
});

test('skips an item whose command is not registered', () => {
  disposables.push(
    menus.registerMenuItem(
      { view: 'explore.chart.download', command: 'ext.missing' },
      'explore.chart.download',
      'primary',
    ),
  );
  const { result } = renderHook(() =>
    useExtensionMenuItems('explore.chart.download', ctx),
  );
  expect(result.current).toEqual([]);
});

test('maps a registered item to a menu item that runs the command with the context', async () => {
  const run = jest.fn();
  register('ext.gs', 'Export to Google Sheets', 'explore.chart.download', run);
  const { result } = renderHook(() =>
    useExtensionMenuItems('explore.chart.download', ctx),
  );
  expect(result.current).toEqual([
    expect.objectContaining({
      key: 'ext:explore.chart.download:ext.gs',
      label: 'Export to Google Sheets',
      disabled: false,
    }),
  ]);
  await act(async () => click(result.current[0]));
  expect(run).toHaveBeenCalledWith(ctx);
});

test('items registered after first render appear', () => {
  const { result } = renderHook(() =>
    useExtensionMenuItems('dashboard.download', {
      dashboardId: 1,
      dashboardTitle: 'D',
      activeDataMask: {},
      canDownload: true,
    }),
  );
  expect(result.current).toEqual([]);
  act(() => {
    register('ext.late', 'Late', 'dashboard.download');
  });
  expect(result.current).toHaveLength(1);
});

test('disabled without download permission', () => {
  register('ext.denied', 'Denied', 'explore.chart.download');
  const { result } = renderHook(() =>
    useExtensionMenuItems('explore.chart.download', {
      ...ctx,
      canDownload: false,
    }),
  );
  expect(result.current).toEqual([
    expect.objectContaining({
      key: 'ext:explore.chart.download:ext.denied',
      disabled: true,
    }),
  ]);
});

test('click uses the latest context, not the one from the first render', async () => {
  const run = jest.fn();
  register('ext.fresh', 'Fresh', 'explore.chart.download', run);
  const { result, rerender } = renderHook(
    ({ c }) => useExtensionMenuItems('explore.chart.download', c),
    { initialProps: { c: ctx } },
  );
  const first = result.current;
  const newer = { ...ctx, chartName: 'Renamed' };
  rerender({ c: newer });
  expect(result.current).toBe(first);
  await act(async () => click(result.current[0]));
  expect(run).toHaveBeenCalledWith(newer);
});

test('onItemClick runs after the command starts', async () => {
  const run = jest.fn();
  const onItemClick = jest.fn();
  register('ext.close', 'Close', 'explore.chart.download', run);
  const { result } = renderHook(() =>
    useExtensionMenuItems('explore.chart.download', ctx, { onItemClick }),
  );
  await act(async () => click(result.current[0]));
  expect(run).toHaveBeenCalled();
  expect(onItemClick).toHaveBeenCalledTimes(1);
});

test('disabled state follows canDownload changes', () => {
  register('ext.toggle', 'Toggle', 'explore.chart.download');
  const { result, rerender } = renderHook(
    ({ c }) => useExtensionMenuItems('explore.chart.download', c),
    { initialProps: { c: ctx } },
  );
  expect(result.current[0]).toEqual(
    expect.objectContaining({ disabled: false }),
  );
  rerender({ c: { ...ctx, canDownload: false } });
  expect(result.current[0]).toEqual(
    expect.objectContaining({ disabled: true }),
  );
});

test('a rejecting command is caught and logged', async () => {
  const log = jest.spyOn(logging, 'error').mockImplementation(() => {});
  register('ext.bad', 'Bad', 'explore.chart.download', () =>
    Promise.reject(new Error('x')),
  );
  const { result } = renderHook(() =>
    useExtensionMenuItems('explore.chart.download', ctx),
  );
  await act(async () => click(result.current[0]));
  expect(log).toHaveBeenCalled();
});

test('useChartDownloadItems reads the provider and is empty without one', () => {
  expect(renderHook(() => useChartDownloadItems()).result.current).toEqual([]);
  register('ext.drill', 'Drill', 'chart.drillBy.download');
  const { result } = renderHook(() => useChartDownloadItems(), {
    wrapper: ({ children }) => (
      <ChartDownloadProvider location="chart.drillBy.download" context={ctx}>
        {children}
      </ChartDownloadProvider>
    ),
  });
  expect(result.current).toHaveLength(1);
});

test('key is qualified by location so a command at two locations does not collide', () => {
  register('ext.both', 'Both', 'explore.chart.download');
  register('ext.both', 'Both', 'explore.chart.download.pivoted');
  const plain = renderHook(() =>
    useExtensionMenuItems('explore.chart.download', ctx),
  );
  const pivoted = renderHook(() =>
    useExtensionMenuItems('explore.chart.download.pivoted', ctx),
  );
  const plainKey = (plain.result.current[0] as MenuItemType).key;
  const pivotedKey = (pivoted.result.current[0] as MenuItemType).key;
  expect(plainKey).toContain('explore.chart.download:');
  expect(pivotedKey).toBe('ext:explore.chart.download.pivoted:ext.both');
  expect(plainKey).not.toBe(pivotedKey);
});

test('sets the icon passed in options', () => {
  register('ext.gs', 'Export to Google Sheets', 'explore.chart.download');
  const icon = <span data-test="excel-icon" />;
  const { result } = renderHook(() =>
    useExtensionMenuItems('explore.chart.download', ctx, { icon }),
  );
  expect((result.current[0] as MenuItemType).icon).toBe(icon);
});

test('leaves icon undefined without the option', () => {
  register('ext.gs', 'Export to Google Sheets', 'explore.chart.download');
  const { result } = renderHook(() =>
    useExtensionMenuItems('explore.chart.download', ctx),
  );
  expect((result.current[0] as MenuItemType).icon).toBeUndefined();
});

test('passes the provider icon to nested items', () => {
  register('ext.drill', 'Drill', 'chart.drillBy.download');
  const icon = <span data-test="excel-icon" />;
  const { result } = renderHook(() => useChartDownloadItems(), {
    wrapper: ({ children }) => (
      <ChartDownloadProvider
        location="chart.drillBy.download"
        context={ctx}
        icon={icon}
      >
        {children}
      </ChartDownloadProvider>
    ),
  });
  expect((result.current[0] as MenuItemType).icon).toBe(icon);
});
