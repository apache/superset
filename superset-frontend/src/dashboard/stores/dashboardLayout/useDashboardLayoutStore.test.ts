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

import type { LayoutItem, LayoutItemMeta } from 'src/dashboard/types';
import { useDashboardLayoutStore } from './useDashboardLayoutStore';
import { useDashboardStateStore } from '../dashboardState';

// zundo's temporal middleware uses zustand internals at store-creation time, so
// the zustand auto-mock breaks it; load the real implementation instead.
jest.unmock('zustand');

const store = useDashboardLayoutStore;

/** Builds a typed LayoutItem fixture with sensible defaults. */
const makeLayoutItem = (
  partial: Partial<LayoutItem> & Pick<LayoutItem, 'id'>,
): LayoutItem => ({
  type: 'ROW',
  children: [],
  meta: {} as LayoutItemMeta,
  ...partial,
});

beforeEach(() => {
  store.setState({ layout: {} });
  store.temporal.getState().clear();
});

test('starts with empty layout', () => {
  expect(store.getState().layout).toEqual({});
});

test('setLayout replaces layout entirely', () => {
  store.getState().setLayout({
    DASHBOARD_ROOT_ID: makeLayoutItem({
      id: 'DASHBOARD_ROOT_ID',
      type: 'ROOT',
      children: ['GRID_ID'],
    }),
    GRID_ID: makeLayoutItem({ id: 'GRID_ID', type: 'GRID' }),
  });
  expect(Object.keys(store.getState().layout)).toContain('DASHBOARD_ROOT_ID');
  expect(Object.keys(store.getState().layout)).toContain('GRID_ID');
});

test('updateComponents merges into existing layout', () => {
  store.getState().setLayout({
    A: makeLayoutItem({ id: 'A', type: 'ROW' }),
  });
  store.getState().updateComponents({
    B: makeLayoutItem({ id: 'B', type: 'CHART' }),
  });
  expect(store.getState().layout.A).toBeDefined();
  expect(store.getState().layout.B).toBeDefined();
});

test('undo restores previous layout', () => {
  store.getState().setLayout({ V1: makeLayoutItem({ id: 'V1' }) });
  store.getState().updateComponents({ V2: makeLayoutItem({ id: 'V2' }) });

  expect(store.getState().layout.V2).toBeDefined();

  store.temporal.getState().undo();
  expect(store.getState().layout.V2).toBeUndefined();
  expect(store.getState().layout.V1).toBeDefined();
});

test('redo re-applies undone change', () => {
  store.getState().setLayout({ R1: makeLayoutItem({ id: 'R1' }) });
  store.getState().updateComponents({ R2: makeLayoutItem({ id: 'R2' }) });

  store.temporal.getState().undo();
  expect(store.getState().layout.R2).toBeUndefined();

  store.temporal.getState().redo();
  expect(store.getState().layout.R2).toBeDefined();
});

test('clear resets undo/redo history', () => {
  store.getState().setLayout({ C1: makeLayoutItem({ id: 'C1' }) });
  store.getState().updateComponents({ C2: makeLayoutItem({ id: 'C2' }) });

  expect(store.temporal.getState().pastStates.length).toBeGreaterThan(0);

  store.temporal.getState().clear();
  expect(store.temporal.getState().pastStates.length).toBe(0);
  expect(store.temporal.getState().futureStates.length).toBe(0);
});

test('subscribeWithSelector fires on layout change', () => {
  const listener = jest.fn();
  const unsub = store.subscribe(s => s.layout, listener);

  store.getState().setLayout({ S1: makeLayoutItem({ id: 'S1' }) });
  expect(listener).toHaveBeenCalledTimes(1);

  unsub();
});

test('deleteComponent removes the component and its children', () => {
  store.getState().setLayout({
    ROW: makeLayoutItem({ id: 'ROW', type: 'ROW', children: ['CHART'] }),
    CHART: makeLayoutItem({ id: 'CHART', type: 'CHART' }),
  });
  store.getState().deleteComponent('CHART', 'ROW');

  expect(store.getState().layout.CHART).toBeUndefined();
  expect(store.getState().layout.ROW.children).toEqual([]);
});

test('layout mutations flag unsaved changes and create undo history', () => {
  useDashboardStateStore.setState({ hasUnsavedChanges: false });
  store.getState().setLayout({
    ROW: makeLayoutItem({ id: 'ROW', type: 'ROW', children: ['CHART'] }),
    CHART: makeLayoutItem({ id: 'CHART', type: 'CHART' }),
  });
  store.temporal.getState().clear();

  store.getState().deleteComponent('CHART', 'ROW');

  expect(useDashboardStateStore.getState().hasUnsavedChanges).toBe(true);
  expect(store.temporal.getState().pastStates.length).toBeGreaterThan(0);
});

test('resizeComponent updates width and height', () => {
  store.getState().setLayout({
    CHART: makeLayoutItem({
      id: 'CHART',
      type: 'CHART',
      meta: { width: 4, height: 20 } as LayoutItemMeta,
    }),
  });
  store.getState().resizeComponent({ id: 'CHART', width: 6, height: 30 });

  expect(store.getState().layout.CHART.meta.width).toBe(6);
  expect(store.getState().layout.CHART.meta.height).toBe(30);
});

test('updateDashboardTitle sets the header text', () => {
  store.getState().setLayout({
    HEADER_ID: makeLayoutItem({
      id: 'HEADER_ID',
      type: 'HEADER',
      meta: { text: 'Old' } as LayoutItemMeta,
    }),
  });
  store.getState().updateDashboardTitle('New Title');

  expect(store.getState().layout.HEADER_ID.meta.text).toBe('New Title');
});
