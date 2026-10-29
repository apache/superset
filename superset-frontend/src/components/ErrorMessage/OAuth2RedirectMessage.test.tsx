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

import * as reduxHooks from 'react-redux';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { act, render, waitFor } from 'spec/helpers/testing-library';
import { ErrorLevel, ErrorSource, ErrorTypeEnum } from '@superset-ui/core';
import { reRunQuery } from 'src/SqlLab/actions/sqlLab';
import { triggerQuery } from 'src/components/Chart/chartAction';
import { onRefresh } from 'src/dashboard/actions/dashboardState';
import { OAuth2RedirectMessage } from '.';

// jsdom does not provide BroadcastChannel, so these tests drive the component
// through a mocked channel (see `capturedChannel`) and dispatched storage events.
const mockStore = createStore(() => ({
  sqlLab: {
    queries: { 'query-id': { sql: 'SELECT * FROM table' } },
    queryEditors: [{ id: 'editor-id', latestQueryId: 'query-id' }],
    tabHistory: ['editor-id'],
  },
  explore: {
    slice: { slice_id: 123 },
  },
  charts: { '1': {}, '2': {} },
  dashboardInfo: { id: 'dashboard-id' },
}));

jest.mock('src/SqlLab/actions/sqlLab', () => ({
  reRunQuery: jest.fn(),
}));

jest.mock('src/components/Chart/chartAction', () => ({
  triggerQuery: jest.fn(),
}));

jest.mock('src/dashboard/actions/dashboardState', () => ({
  onRefresh: jest.fn(),
}));

const mockDispatch = jest.fn();
jest.spyOn(reduxHooks, 'useDispatch').mockReturnValue(mockDispatch);

type OAuthMessage = { tabId?: string };

const globalWithBroadcastChannel = global as unknown as {
  BroadcastChannel: jest.Mock;
};

// Capture the channel created by the component so tests can drive its
// onmessage handler and assert it gets closed on unmount.
let capturedChannel: {
  onmessage: ((event: { data: OAuthMessage }) => void) | null;
  close: jest.Mock;
};
const channelCloseMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  capturedChannel = { onmessage: null, close: channelCloseMock };
  globalWithBroadcastChannel.BroadcastChannel = jest
    .fn()
    .mockImplementation(() => capturedChannel);
});

function simulateBroadcastMessage(data: OAuthMessage) {
  capturedChannel.onmessage?.({ data });
}

function simulateStorageMessage(data: OAuthMessage) {
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'oauth2_auth_complete',
      newValue: JSON.stringify(data),
    }),
  );
}

const defaultProps = {
  error: {
    error_type: ErrorTypeEnum.OAUTH2_REDIRECT,
    message: "You don't have permission to access the data.",
    extra: {
      url: 'https://example.com',
      tab_id: 'tabId',
    },
    level: 'warning' as ErrorLevel,
  },
  source: 'sqllab' as ErrorSource,
};

const setup = (overrides = {}) => (
  <Provider store={mockStore}>
    <OAuth2RedirectMessage {...defaultProps} {...overrides} />
  </Provider>
);

test('renders the authorization link', () => {
  const { getByText } = render(setup());

  expect(getByText(/Authorization needed/i)).toBeInTheDocument();
  const link = getByText(/provide authorization/i);
  expect(link).toHaveAttribute('href', 'https://example.com');
  expect(link).toHaveAttribute('target', '_blank');
});

test('closes the BroadcastChannel on unmount', () => {
  const { unmount } = render(setup());

  expect(globalWithBroadcastChannel.BroadcastChannel).toHaveBeenCalledWith(
    'oauth',
  );
  unmount();
  expect(channelCloseMock).toHaveBeenCalled();
});

test('re-runs the SQL Lab query on a matching broadcast message', async () => {
  render(setup());
  simulateBroadcastMessage({ tabId: 'tabId' });
  await waitFor(() => {
    expect(reRunQuery).toHaveBeenCalledWith({ sql: 'SELECT * FROM table' });
  });
});

test('triggers the chart query for explore', async () => {
  render(setup({ source: 'explore' }));
  simulateBroadcastMessage({ tabId: 'tabId' });
  await waitFor(() => {
    expect(triggerQuery).toHaveBeenCalledWith(true, 123);
  });
});

test('refreshes the dashboard charts on a matching broadcast message', async () => {
  render(setup({ source: 'dashboard' }));
  simulateBroadcastMessage({ tabId: 'tabId' });
  await waitFor(() => {
    expect(onRefresh).toHaveBeenCalledWith([1, 2], true, 0, 'dashboard-id');
  });
});

test('refreshes the dashboard on a matching storage event', async () => {
  render(setup({ source: 'dashboard' }));
  simulateStorageMessage({ tabId: 'tabId' });
  await waitFor(() => {
    expect(onRefresh).toHaveBeenCalledWith([1, 2], true, 0, 'dashboard-id');
  });
});

test('ignores messages for other tab IDs and malformed storage payloads', () => {
  render(setup({ source: 'dashboard' }));
  simulateBroadcastMessage({ tabId: 'other' });
  simulateStorageMessage({ tabId: 'other' });
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: 'oauth2_auth_complete',
      newValue: 'not-json',
    }),
  );
  expect(onRefresh).not.toHaveBeenCalled();
});

test('dispatches only once when both BroadcastChannel and storage signals arrive', async () => {
  render(setup());
  simulateBroadcastMessage({ tabId: 'tabId' });
  simulateStorageMessage({ tabId: 'tabId' });
  await waitFor(() => {
    expect(reRunQuery).toHaveBeenCalledTimes(1);
  });
});

test('falls back to storage events when BroadcastChannel construction throws', async () => {
  globalWithBroadcastChannel.BroadcastChannel = jest
    .fn()
    .mockImplementation(() => {
      throw new Error('blocked');
    });
  render(setup());
  simulateStorageMessage({ tabId: 'tabId' });
  await waitFor(() => {
    expect(reRunQuery).toHaveBeenCalledWith({ sql: 'SELECT * FROM table' });
  });
});

test('dashboard: store updates while failed charts churn do not drop the completion message', () => {
  // Simulates a dashboard whose chart state keeps changing (charts added,
  // updated) while the error banner is displayed, then the OAuth tab reports
  // completion. The listener must stay subscribed and refresh the latest chart set.
  const initialState = {
    sqlLab: { queries: {}, queryEditors: [], tabHistory: [] },
    explore: {},
    charts: { '1': {}, '2': {} } as Record<string, object>,
    dashboardInfo: { id: 'dashboard-id' },
  };
  const store = createStore(
    (state: typeof initialState = initialState, action: { type: string }) =>
      action.type === 'ADD_CHART'
        ? { ...state, charts: { ...state.charts, '3': {} } }
        : state,
  );
  render(
    <Provider store={store}>
      <OAuth2RedirectMessage {...defaultProps} source="dashboard" />
    </Provider>,
  );
  expect(globalWithBroadcastChannel.BroadcastChannel).toHaveBeenCalledTimes(1);

  act(() => {
    store.dispatch({ type: 'ADD_CHART' });
  });

  // The channel is not recreated on store updates...
  expect(globalWithBroadcastChannel.BroadcastChannel).toHaveBeenCalledTimes(1);
  expect(channelCloseMock).not.toHaveBeenCalled();

  simulateBroadcastMessage({ tabId: 'tabId' });
  // ...and the refresh covers the latest chart list.
  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect(onRefresh).toHaveBeenCalledWith([1, 2, 3], true, 0, 'dashboard-id');
});

test('re-processes a later signal when the first arrived before state was ready', async () => {
  const initialState = {
    sqlLab: {
      queries: {},
      queryEditors: [{ id: 'editor-id' }],
      tabHistory: ['editor-id'],
    },
    explore: { slice: { slice_id: 123 } },
    charts: {},
    dashboardInfo: { id: 'dashboard-id' },
  };
  const dynamicStore = createStore(
    (state: typeof initialState = initialState, action: { type: string }) =>
      action.type === 'SET_READY'
        ? {
            ...state,
            sqlLab: {
              ...state.sqlLab,
              queries: { 'query-id': { sql: 'SELECT * FROM table' } },
              queryEditors: [{ id: 'editor-id', latestQueryId: 'query-id' }],
            },
          }
        : state,
  );
  render(
    <Provider store={dynamicStore}>
      <OAuth2RedirectMessage {...defaultProps} />
    </Provider>,
  );

  simulateBroadcastMessage({ tabId: 'tabId' });
  expect(reRunQuery).not.toHaveBeenCalled();

  act(() => {
    dynamicStore.dispatch({ type: 'SET_READY' });
  });
  simulateStorageMessage({ tabId: 'tabId' });

  await waitFor(() => {
    expect(reRunQuery).toHaveBeenCalledWith({ sql: 'SELECT * FROM table' });
  });
});

test('triggers the chart query with the unsaved chart ID for an unsaved explore chart', async () => {
  const store = createStore(() => ({
    sqlLab: { queries: {}, queryEditors: [], tabHistory: [] },
    explore: { form_data: {} },
    charts: {},
    dashboardInfo: {},
  }));
  render(
    <Provider store={store}>
      <OAuth2RedirectMessage {...defaultProps} source="explore" />
    </Provider>,
  );
  simulateBroadcastMessage({ tabId: 'tabId' });
  await waitFor(() => {
    expect(triggerQuery).toHaveBeenCalledWith(true, 0);
  });
});

test('only the instance with the matching tab ID acts when several are mounted', () => {
  const channels: Array<{
    onmessage: ((event: { data: OAuthMessage }) => void) | null;
    close: jest.Mock;
  }> = [];
  globalWithBroadcastChannel.BroadcastChannel = jest
    .fn()
    .mockImplementation(() => {
      const channel = { onmessage: null, close: jest.fn() };
      channels.push(channel);
      return channel;
    });
  const other = {
    ...defaultProps.error,
    extra: { ...defaultProps.error.extra, tab_id: 'otherTabId' },
  };
  render(
    <Provider store={mockStore}>
      <OAuth2RedirectMessage {...defaultProps} source="dashboard" />
      <OAuth2RedirectMessage
        {...defaultProps}
        error={other}
        source="dashboard"
      />
    </Provider>,
  );
  expect(channels).toHaveLength(2);

  // Every instance hears every broadcast; only the matching tab ID refreshes.
  channels.forEach(channel =>
    channel.onmessage?.({ data: { tabId: 'tabId' } }),
  );
  expect(onRefresh).toHaveBeenCalledTimes(1);
});
