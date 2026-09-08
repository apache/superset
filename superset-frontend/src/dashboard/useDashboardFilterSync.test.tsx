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
import { PropsWithChildren } from 'react';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import { act, renderHook } from '@testing-library/react';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import { DataMaskStateWithId } from '@superset-ui/core';
import Toast from 'src/components/MessageToasts/Toast';
import messageToasts from 'src/components/MessageToasts/reducers';
import dataMask from 'src/dataMask/reducer';
import { updateDataMask } from 'src/dataMask/actions';
import {
  subscribeRealtime,
  subscribeRealtimeOpen,
} from 'src/middleware/realtime';
import { getPermalinkValue } from './components/nativeFilters/FilterBar/keyValue';
import { DashboardPermalinkValue } from './types';
import useDashboardFilterSync from './useDashboardFilterSync';

jest.mock('src/middleware/realtime');
jest.mock('./components/nativeFilters/FilterBar/keyValue');

const resolvePermalink = jest.mocked(getPermalinkValue);
const unsubscribe = jest.fn();
const unsubscribeOpen = jest.fn();
let handler: Parameters<typeof subscribeRealtime>[1];
let onOpen: Parameters<typeof subscribeRealtimeOpen>[0];
const prior = {
  id: 'region',
  extraFormData: {},
  filterState: { value: ['APAC'] },
  ownState: {},
};
const incoming: DataMaskStateWithId = {
  region: {
    ...prior,
    filterState: { value: ['EMEA'] },
    extraFormData: { filters: [{ col: 'region', op: 'IN', val: ['EMEA'] }] },
  },
  time: {
    id: 'time',
    filterState: { value: 'Last week' },
    extraFormData: { time_range: 'Last week' },
  },
};
const permalink: DashboardPermalinkValue = {
  dashboardId: '42',
  state: { dataMask: incoming, activeTabs: [], anchor: '' },
};

function setup(dashboardId: number | undefined = 42) {
  const store = createStore(combineReducers({ dataMask, messageToasts }));
  store.dispatch(updateDataMask('region', prior));
  const dispatch = jest.spyOn(store, 'dispatch');
  const wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={store}>{children}</Provider>
  );
  const hook = renderHook(({ id }) => useDashboardFilterSync(id), {
    wrapper,
    initialProps: { id: dashboardId },
  });
  return { ...hook, store, dispatch };
}

async function receive(dashboardId = 42, key = 'key') {
  await act(async () => {
    await handler({ dashboard_id: dashboardId, permalink_key: key });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resolvePermalink.mockReset();
  jest.mocked(subscribeRealtime).mockImplementation((_topic, listener) => {
    handler = listener;
    return unsubscribe;
  });
  jest.mocked(subscribeRealtimeOpen).mockImplementation(listener => {
    onOpen = listener;
    return unsubscribeOpen;
  });
  resolvePermalink.mockResolvedValue(permalink);
});

test('subscribes, resolves and dispatches each mask, and unsubscribes', async () => {
  const { store, dispatch, unmount } = setup();
  expect(subscribeRealtime).toHaveBeenCalledWith(
    'dashboard.filters_applied',
    expect.any(Function),
  );
  await receive();
  expect(resolvePermalink).toHaveBeenCalledWith('key');
  Object.entries(incoming).forEach(([id, mask]) => {
    expect(dispatch).toHaveBeenCalledWith(updateDataMask(id, mask));
  });
  expect(store.getState().messageToasts[0].text).toBe(
    'Filters applied from chat',
  );
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(unsubscribeOpen).toHaveBeenCalledTimes(1);
  expect(store.getState().messageToasts).toEqual([]);
});

test('ignores other dashboards and malformed payloads', async () => {
  const { dispatch } = setup();
  await receive(43);
  await act(async () => {
    await handler(null);
    await handler({ dashboard_id: 42 });
    await handler({ dashboard_id: 42, permalink_key: 3 });
  });
  expect(resolvePermalink).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});

test.each([null, { dashboardId: '42', state: {} }])(
  'missing permalink state degrades quietly: %s',
  async value => {
    resolvePermalink.mockResolvedValue(value as DashboardPermalinkValue | null);
    const { dispatch } = setup();
    await receive();
    expect(dispatch).not.toHaveBeenCalled();
  },
);

test('a rejected resolve degrades quietly', async () => {
  resolvePermalink.mockRejectedValue(new Error('unavailable'));
  const { dispatch } = setup();
  await receive();
  expect(dispatch).not.toHaveBeenCalled();
});

test('toast undo restores the prior mask and removes newly introduced entries', async () => {
  const { store } = setup();
  const previous = store.getState().dataMask;
  await receive();
  const toast = store.getState().messageToasts[0];
  render(<Toast toast={toast} onCloseToast={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(store.getState().dataMask).toEqual(previous);
  expect(store.getState().messageToasts).toEqual([]);
  act(() => toast.action?.onClick());
  expect(store.getState().dataMask).toEqual(previous);
});

test.each(['unmount', 'navigate'])(
  '%s during resolution prevents dispatch',
  async mode => {
    let finish!: (value: typeof permalink) => void;
    resolvePermalink.mockReturnValue(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    const { dispatch, unmount, rerender } = setup();
    act(() => {
      handler({ dashboard_id: 42, permalink_key: 'key' });
    });
    if (mode === 'unmount') unmount();
    else rerender({ id: 43 });
    await act(async () => finish(permalink));
    expect(dispatch).not.toHaveBeenCalled();
  },
);

test('captures edits made while resolving and ignores older resolutions', async () => {
  let finish!: (value: typeof permalink) => void;
  resolvePermalink.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  const { store } = setup();
  act(() => {
    handler({ dashboard_id: 42, permalink_key: 'old' });
  });
  act(() =>
    store.dispatch(
      updateDataMask('region', { filterState: { value: ['US'] } }),
    ),
  );
  const previous = store.getState().dataMask;
  await receive(42, 'new');
  const toast = store.getState().messageToasts[0];
  await act(async () => finish(permalink));
  expect(store.getState().messageToasts).toHaveLength(1);
  act(() => toast.action?.onClick());
  expect(store.getState().dataMask).toEqual(previous);
});

test('reconnect does not replay stale state or undo manual edits', async () => {
  const { store } = setup();
  await receive();
  act(() => store.getState().messageToasts[0].action?.onClick());
  const previous = store.getState().dataMask;
  act(() => {
    onOpen('initial');
    onOpen('keepalive');
    onOpen('reconnect');
  });
  expect(resolvePermalink).toHaveBeenCalledTimes(1);
  expect(store.getState().dataMask).toBe(previous);
});

test('does not subscribe before the dashboard is hydrated', () => {
  const { rerender } = setup(0);
  expect(subscribeRealtime).not.toHaveBeenCalled();
  expect(subscribeRealtimeOpen).not.toHaveBeenCalled();
  rerender({ id: 42 });
  expect(subscribeRealtime).toHaveBeenCalledTimes(1);
});

test('superseded and unmounted toast actions cannot change filters', async () => {
  const { store, dispatch, unmount } = setup();
  await receive();
  const oldToast = store.getState().messageToasts[0];
  await receive(42, 'second');
  const latestToast = store.getState().messageToasts[0];
  expect(store.getState().messageToasts).toHaveLength(1);
  dispatch.mockClear();
  act(() => oldToast.action?.onClick());
  expect(dispatch).not.toHaveBeenCalled();
  unmount();
  dispatch.mockClear();
  act(() => latestToast.action?.onClick());
  expect(dispatch).not.toHaveBeenCalled();
});
