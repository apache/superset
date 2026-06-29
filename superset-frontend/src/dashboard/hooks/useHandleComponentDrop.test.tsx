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
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { renderHook, act } from '@testing-library/react';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
  NEW_COMPONENTS_SOURCE_ID,
} from 'src/dashboard/util/constants';
import {
  CHART_TYPE,
  DASHBOARD_GRID_TYPE,
  ROW_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from 'src/dashboard/util/componentTypes';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import type { DashboardLayout } from 'src/dashboard/types';
import { useDashboardLayoutStore } from 'src/dashboard/stores';
import { useHandleComponentDrop } from './useHandleComponentDrop';

// zundo's temporal middleware needs the real zustand implementation.
jest.unmock('zustand');

const mockAddWarningToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: unknown) => Component,
  useToasts: () => ({
    addWarningToast: mockAddWarningToast,
    addSuccessToast: jest.fn(),
    addDangerToast: jest.fn(),
    addInfoToast: jest.fn(),
  }),
}));

type Layout = Record<string, unknown>;
type Filters = Record<string, unknown>;

// Seeds the layout store, replaces its mutation actions with spies (the hook
// only routes to them), and returns a Redux wrapper carrying dashboardFilters.
function setup(layout: Layout = {}, dashboardFilters: Filters = {}) {
  const spies = {
    createComponent: jest.fn(),
    moveComponent: jest.fn(),
    createTopLevelTabs: jest.fn(),
    deleteComponent: jest.fn(),
  };
  useDashboardLayoutStore.setState({
    layout: layout as unknown as DashboardLayout,
    ...spies,
  });

  const store = configureStore({
    reducer: { dashboardFilters: (s = dashboardFilters) => s },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { spies, wrapper };
}

function drop(dropResult: DropResult, layout?: Layout, filters?: Filters) {
  const { spies, wrapper } = setup(layout, filters);
  const { result } = renderHook(() => useHandleComponentDrop(), { wrapper });
  act(() => {
    result.current(dropResult);
  });
  return spies;
}

beforeEach(() => {
  mockAddWarningToast.mockClear();
  useDashboardLayoutStore.setState({ layout: {} });
  useDashboardLayoutStore.temporal.getState().clear();
});

test('creates a component when the source is new', () => {
  const dropResult = {
    source: { id: NEW_COMPONENTS_SOURCE_ID },
    destination: { id: DASHBOARD_GRID_ID, type: DASHBOARD_GRID_TYPE },
    dragging: { id: 'new-row', type: ROW_TYPE },
  } as unknown as DropResult;

  const spies = drop(dropResult);

  expect(spies.createComponent).toHaveBeenCalledWith(dropResult);
  expect(spies.moveComponent).not.toHaveBeenCalled();
});

test('moves a component when it is not new', () => {
  const dropResult = {
    source: { id: 'id', index: 0, type: ROW_TYPE },
    destination: { id: DASHBOARD_GRID_ID, type: DASHBOARD_GRID_TYPE },
    dragging: { id: 'dragging', type: ROW_TYPE },
  } as unknown as DropResult;

  // Non-empty children so the emptied-parent cleanup does not fire.
  const spies = drop(dropResult, { id: { type: ROW_TYPE, children: ['_'] } });

  expect(spies.moveComponent).toHaveBeenCalledWith(dropResult);
  expect(spies.deleteComponent).not.toHaveBeenCalled();
});

test('warns and does nothing when the drop overflows the destination', () => {
  const dropResult = {
    source: { id: 'source', type: ROW_TYPE },
    destination: { id: 'destination', type: ROW_TYPE },
    dragging: { id: 'dragging', type: CHART_TYPE, meta: { width: 1 } },
  } as unknown as DropResult;

  const spies = drop(dropResult, {
    source: { id: 'source', type: ROW_TYPE, children: ['dragging'] },
    destination: { id: 'destination', type: ROW_TYPE, children: ['rowChild'] },
    dragging: { id: 'dragging', type: CHART_TYPE, meta: { width: 1 } },
    rowChild: { id: 'rowChild', type: CHART_TYPE, meta: { width: 12 } },
  });

  expect(mockAddWarningToast).toHaveBeenCalledTimes(1);
  expect(spies.moveComponent).not.toHaveBeenCalled();
  expect(spies.createComponent).not.toHaveBeenCalled();
});

test('deletes an emptied parent Row or Tabs after the move', () => {
  const dropResult = {
    source: { id: 'tabsId', type: TABS_TYPE },
    destination: { id: DASHBOARD_GRID_ID, type: DASHBOARD_GRID_TYPE },
    dragging: { id: 'tabId', type: TAB_TYPE },
  } as unknown as DropResult;

  const spies = drop(dropResult, {
    parentId: { id: 'parentId', children: ['tabsId'] },
    tabsId: { id: 'tabsId', type: TABS_TYPE, children: [] },
    [DASHBOARD_GRID_ID]: { id: DASHBOARD_GRID_ID, type: DASHBOARD_GRID_TYPE },
    tabId: { id: 'tabId', type: TAB_TYPE },
  });

  expect(spies.moveComponent).toHaveBeenCalledWith(dropResult);
  expect(spies.deleteComponent).toHaveBeenCalledWith('tabsId', 'parentId');
});

test('creates top-level tabs when dropped on the root', () => {
  const dropResult = {
    source: { id: NEW_COMPONENTS_SOURCE_ID },
    destination: { id: DASHBOARD_ROOT_ID },
    dragging: { id: 'new-row', type: ROW_TYPE },
  } as unknown as DropResult;

  const spies = drop(dropResult);

  expect(spies.createTopLevelTabs).toHaveBeenCalledWith(dropResult);
  expect(spies.createComponent).not.toHaveBeenCalled();
});

test('warns when dropping a top-level tab into nested tabs', () => {
  const dropResult = {
    source: { id: 'TABS-ROOT_TABS', index: 1, type: TABS_TYPE },
    destination: { id: 'TABS-ROW_TABS', index: 1, type: TABS_TYPE },
    dragging: { id: 'TAB-1', type: TAB_TYPE },
  } as unknown as DropResult;

  const spies = drop(dropResult, {
    [DASHBOARD_ROOT_ID]: {
      id: DASHBOARD_ROOT_ID,
      type: 'ROOT',
      children: ['TABS-ROOT_TABS'],
    },
    'TABS-ROOT_TABS': { id: 'TABS-ROOT_TABS', type: TABS_TYPE, children: [] },
    'TABS-ROW_TABS': { id: 'TABS-ROW_TABS', type: TABS_TYPE, children: [] },
  });

  expect(mockAddWarningToast).toHaveBeenCalledTimes(1);
  expect(spies.moveComponent).not.toHaveBeenCalled();
});

test('warns when a moved chart lands in a different filter scope', () => {
  const dropResult = {
    source: { id: 'chart1', index: 0, type: CHART_TYPE },
    destination: { id: DASHBOARD_GRID_ID, type: DASHBOARD_GRID_TYPE },
    dragging: { id: 'chart1', type: CHART_TYPE },
  } as unknown as DropResult;

  // A filter scoped to the destination but not the source triggers the warning.
  const spies = drop(
    dropResult,
    {
      chart1: { id: 'chart1', type: CHART_TYPE, parents: ['ROOT_ID'] },
      [DASHBOARD_GRID_ID]: {
        id: DASHBOARD_GRID_ID,
        type: DASHBOARD_GRID_TYPE,
        parents: [],
      },
    },
    { f1: { chartId: 1, scopes: { col: { scope: [DASHBOARD_GRID_ID] } } } },
  );

  expect(spies.moveComponent).toHaveBeenCalledWith(dropResult);
  expect(mockAddWarningToast).toHaveBeenCalledTimes(1);
});
