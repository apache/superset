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
import { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react-hooks';
import useSyncActiveTabsToUrl, {
  parseActiveTabsParam,
} from './useSyncActiveTabsToUrl';

type TabsState = { activeTabs: string[]; editMode: boolean };

const setup = (initial: Partial<TabsState> = {}, enabled = true) => {
  const store = configureStore({
    reducer: (
      state: { dashboardState: TabsState } = {
        dashboardState: { activeTabs: [], editMode: false, ...initial },
      },
      action: { type: string; payload?: Partial<TabsState> },
    ) =>
      action.type === 'SET'
        ? { dashboardState: { ...state.dashboardState, ...action.payload } }
        : state,
  });
  const wrapper = ({ children }: { children?: ReactNode }) => (
    <Provider store={store}>
      <BrowserRouter>{children}</BrowserRouter>
    </Provider>
  );
  renderHook(() => useSyncActiveTabsToUrl(enabled), { wrapper });
  return {
    update: (payload: Partial<TabsState>) =>
      act(() => {
        store.dispatch({ type: 'SET', payload });
      }),
  };
};

beforeEach(() => {
  window.history.replaceState({}, '', '/superset/dashboard/7/');
});

test('parses the active_tabs param into tab ids', () => {
  expect(parseActiveTabsParam('TAB-a, TAB-b,,')).toEqual(['TAB-a', 'TAB-b']);
  expect(parseActiveTabsParam(null)).toEqual([]);
});

test('writes the active tabs to the URL, sorted', () => {
  setup({ activeTabs: ['TAB-b', 'TAB-a'] });

  expect(new URLSearchParams(window.location.search).get('active_tabs')).toBe(
    'TAB-a,TAB-b',
  );
});

test('follows the active tabs as they change and clears them', () => {
  const { update } = setup({ activeTabs: ['TAB-a'] });

  update({ activeTabs: ['TAB-c'] });
  expect(window.location.search).toBe('?active_tabs=TAB-c');

  update({ activeTabs: [] });
  expect(window.location.search).toBe('');
});

test('keeps the other params and the hash', () => {
  window.history.replaceState(
    {},
    '',
    '/superset/dashboard/7/?native_filters_key=abc#CHART-1',
  );
  setup({ activeTabs: ['TAB-a'] });

  expect(window.location.search).toBe(
    '?native_filters_key=abc&active_tabs=TAB-a',
  );
  expect(window.location.hash).toBe('#CHART-1');
});

test('does not touch the URL in edit mode or before hydration', () => {
  setup({ activeTabs: ['TAB-a'], editMode: true });
  expect(window.location.search).toBe('');

  setup({ activeTabs: ['TAB-a'] }, false);
  expect(window.location.search).toBe('');
});

test('does not touch the URL outside a dashboard', () => {
  window.history.replaceState({}, '', '/explore/');
  setup({ activeTabs: ['TAB-a'] });

  expect(window.location.search).toBe('');
});
