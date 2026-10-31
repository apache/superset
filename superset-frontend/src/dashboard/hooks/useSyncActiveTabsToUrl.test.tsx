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
import { BrowserRouter, useHistory } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { act, render } from '@testing-library/react';
import { applicationRoot } from 'src/utils/getBootstrapData';
import useSyncActiveTabsToUrl, {
  parseActiveTabsParam,
} from './useSyncActiveTabsToUrl';

jest.mock('src/utils/getBootstrapData', () => ({
  ...jest.requireActual('src/utils/getBootstrapData'),
  applicationRoot: jest.fn(),
}));

type TabsState = {
  activeTabs: string[];
  editMode: boolean;
};

const layout = {
  'TAB-first': { type: 'TAB', parents: ['ROOT_ID', 'TABS-root'] },
  'TAB-second': { type: 'TAB', parents: ['ROOT_ID', 'TABS-root'] },
  'CHART-1': {
    type: 'CHART',
    parents: ['ROOT_ID', 'TABS-root', 'TAB-first'],
  },
};

const setup = (initial: Partial<TabsState> = {}, enabled = true) => {
  let history!: ReturnType<typeof useHistory>;
  const store = configureStore({
    reducer: (
      state: {
        dashboardState: TabsState;
        dashboardLayout: { present: typeof layout };
      } = {
        dashboardState: { activeTabs: [], editMode: false, ...initial },
        dashboardLayout: { present: layout },
      },
      action: { type: string; payload?: Partial<TabsState> },
    ) =>
      action.type === 'SET'
        ? {
            ...state,
            dashboardState: { ...state.dashboardState, ...action.payload },
          }
        : state,
  });
  const wrapper = ({ children }: { children?: ReactNode }) => (
    <Provider store={store}>
      <BrowserRouter basename={applicationRoot()}>{children}</BrowserRouter>
    </Provider>
  );
  const TestComponent = () => {
    history = useHistory();
    useSyncActiveTabsToUrl(enabled);
    return null;
  };
  render(<TestComponent />, { wrapper });
  return {
    navigate: (path: string) => act(() => history.push(path)),
    update: (payload: Partial<TabsState>) =>
      act(() => {
        store.dispatch({ type: 'SET', payload });
      }),
  };
};

beforeEach(() => {
  jest.mocked(applicationRoot).mockReturnValue('/superset');
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
  setup({ activeTabs: ['TAB-first'] });

  expect(window.location.search).toBe(
    '?native_filters_key=abc&active_tabs=TAB-first',
  );
  expect(window.location.hash).toBe('#CHART-1');
});

test('does not touch the URL in edit mode or before hydration', () => {
  setup({ activeTabs: ['TAB-a'], editMode: true });
  expect(window.location.search).toBe('');

  setup({ activeTabs: ['TAB-a'] }, false);
  expect(window.location.search).toBe('');
});

test.each([
  '/explore/',
  '/dashboard/list/',
  '/dashboard/',
  '/dashboard/7/extra/',
  '/dashboard-other/7/',
])('does not touch the URL outside a dashboard detail route: %s', path => {
  window.history.replaceState({}, '', `/superset${path}?custom=keep`);
  setup({ activeTabs: ['TAB-a'] });

  expect(window.location.search).toBe('?custom=keep');
});

test.each([
  ['', '7'],
  ['/analytics', '7'],
  ['/superset', '7'],
  ['/analytics', 'my-dashboard'],
])(
  'syncs tabs under application root %s for dashboard %s',
  (appRoot, dashboardId) => {
    jest.mocked(applicationRoot).mockReturnValue(appRoot);
    window.history.replaceState({}, '', `${appRoot}/dashboard/${dashboardId}/`);
    const { update } = setup({ activeTabs: ['TAB-first'] });

    update({ activeTabs: ['TAB-second'] });

    expect(window.location.pathname).toBe(
      `${appRoot}/dashboard/${dashboardId}/`,
    );
    expect(window.location.search).toBe('?active_tabs=TAB-second');
  },
);

test('does not sync stale tabs after navigating away from a dashboard', () => {
  const { navigate, update } = setup({ activeTabs: ['TAB-a'] });

  navigate('/explore/?custom=keep');
  update({ activeTabs: ['TAB-b'] });

  expect(window.location.pathname).toBe('/superset/explore/');
  expect(window.location.search).toBe('?custom=keep');
});

test('drops a deep link hash once the tabs on its path are deselected', () => {
  window.history.replaceState({}, '', '/superset/dashboard/7/#TAB-first');
  const { update } = setup({ activeTabs: ['TAB-first'] });
  expect(window.location.hash).toBe('#TAB-first');

  update({ activeTabs: ['TAB-second'] });

  expect(window.location.search).toBe('?active_tabs=TAB-second');
  expect(window.location.hash).toBe('');
});

test('keeps a deep link hash while the tabs on its path stay selected', () => {
  window.history.replaceState({}, '', '/superset/dashboard/7/#CHART-1');
  setup({ activeTabs: ['TAB-first'] });

  expect(window.location.search).toBe('?active_tabs=TAB-first');
  expect(window.location.hash).toBe('#CHART-1');
});

test('drops a hash targeting a chart once its tab is deselected', () => {
  window.history.replaceState({}, '', '/superset/dashboard/7/#CHART-1');
  const { update } = setup({ activeTabs: ['TAB-first'] });
  expect(window.location.hash).toBe('#CHART-1');

  update({ activeTabs: ['TAB-second'] });

  expect(window.location.search).toBe('?active_tabs=TAB-second');
  expect(window.location.hash).toBe('');
});

test('keeps syncing on the address bar path after a navigation made outside the router', () => {
  const { update } = setup({ activeTabs: ['TAB-first'] });
  window.history.replaceState({}, '', '/superset/dashboard/new-slug/');

  update({ activeTabs: ['TAB-second'] });
  expect(window.location.pathname).toBe('/superset/dashboard/new-slug/');
  expect(window.location.search).toBe('?active_tabs=TAB-second');

  update({ activeTabs: ['TAB-first'] });
  expect(window.location.pathname).toBe('/superset/dashboard/new-slug/');
  expect(window.location.search).toBe('?active_tabs=TAB-first');
});

test('keeps a deep link hash while hydration has yet to reconcile its tab', () => {
  window.history.replaceState({}, '', '/superset/dashboard/7/#CHART-1');
  const { update } = setup({ activeTabs: ['TAB-second'] });

  expect(window.location.search).toBe('?active_tabs=TAB-second');
  expect(window.location.hash).toBe('#CHART-1');

  update({ activeTabs: ['TAB-first'] });
  expect(window.location.hash).toBe('#CHART-1');

  update({ activeTabs: ['TAB-second'] });
  expect(window.location.hash).toBe('');
});

test('syncs tabs on a dashboard with a non-ASCII slug', () => {
  window.history.replaceState({}, '', '/superset/dashboard/café/');
  const { update } = setup({ activeTabs: ['TAB-first'] });

  update({ activeTabs: ['TAB-second'] });

  expect(window.location.search).toBe('?active_tabs=TAB-second');
});
