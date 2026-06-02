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
import { render, waitFor } from 'spec/helpers/testing-library';
import { ErrorLevel, ErrorSource, ErrorTypeEnum } from '@superset-ui/core';
import { reRunQuery } from 'src/SqlLab/actions/sqlLab';
import { triggerQuery } from 'src/components/Chart/chartAction';
import { onRefresh } from 'src/dashboard/actions/dashboardState';
import { OAuth2RedirectMessage } from '.';

// Mock the Redux store
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

// Mock actions
jest.mock('src/SqlLab/actions/sqlLab', () => ({
  reRunQuery: jest.fn(),
}));

jest.mock('src/components/Chart/chartAction', () => ({
  triggerQuery: jest.fn(),
}));

jest.mock('src/dashboard/actions/dashboardState', () => ({
  onRefresh: jest.fn(),
}));

// Mock useDispatch
const mockDispatch = jest.fn();
jest.spyOn(reduxHooks, 'useDispatch').mockReturnValue(mockDispatch);

// Capture the channel instance created by the component so tests can drive its
// onmessage handler and assert it gets closed on unmount.
let capturedChannel: {
  onmessage: ((event: any) => void) | null;
  close: jest.Mock;
};
const channelCloseMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  capturedChannel = { onmessage: null, close: channelCloseMock };
  (global as any).BroadcastChannel = jest
    .fn()
    .mockImplementation(() => capturedChannel);
});

function simulateBroadcastMessage(data: any) {
  capturedChannel.onmessage?.({ data });
}

function simulateStorageMessage(data: any) {
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
      redirect_uri: 'https://redirect.example.com',
    },
    level: 'warning' as ErrorLevel,
  },
  source: 'sqllab' as ErrorSource,
};

const setup = (overrides = {}) => (
  <Provider store={mockStore}>
    <OAuth2RedirectMessage {...defaultProps} {...overrides} />;
  </Provider>
);

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('OAuth2RedirectMessage Component', () => {
  test('renders without crashing and displays the correct initial UI elements', () => {
    const { getByText } = render(setup());

    expect(getByText(/Authorization needed/i)).toBeInTheDocument();
    expect(getByText(/provide authorization/i)).toBeInTheDocument();
  });

  test('renders the authorization link pointing at the OAuth2 URL', () => {
    const { getByText } = render(setup());

    const linkElement = getByText(/provide authorization/i).closest('a');
    expect(linkElement).toHaveAttribute('href', 'https://example.com');
    expect(linkElement).toHaveAttribute('target', '_blank');
  });

  test('closes the BroadcastChannel on unmount', () => {
    const { unmount } = render(setup());

    expect((global as any).BroadcastChannel).toHaveBeenCalledWith('oauth');
    unmount();
    expect(channelCloseMock).toHaveBeenCalled();
  });

  test('dispatches reRunQuery action when a message with correct tab ID is received for SQL Lab', async () => {
    render(setup());

    simulateBroadcastMessage({ tabId: 'tabId' });

    await waitFor(() => {
      expect(reRunQuery).toHaveBeenCalledWith({ sql: 'SELECT * FROM table' });
    });
  });

  test('dispatches reRunQuery action when storage event has matching tab ID', async () => {
    render(setup());

    simulateStorageMessage({ tabId: 'tabId' });

    await waitFor(() => {
      expect(reRunQuery).toHaveBeenCalledWith({ sql: 'SELECT * FROM table' });
    });
  });

  test('dispatches triggerQuery action for explore source upon receiving a correct message', async () => {
    render(setup({ source: 'explore' }));

    simulateBroadcastMessage({ tabId: 'tabId' });

    await waitFor(() => {
      expect(triggerQuery).toHaveBeenCalledWith(true, 123);
    });
  });

  test('dispatches onRefresh action for dashboard source upon receiving a correct message', async () => {
    render(setup({ source: 'dashboard' }));

    simulateBroadcastMessage({ tabId: 'tabId' });

    await waitFor(() => {
      // Chart IDs are converted to numbers by the component via chartList.map(Number)
      expect(onRefresh).toHaveBeenCalledWith([1, 2], true, 0, 'dashboard-id');
    });
  });

  test('ignores messages with a mismatched tab ID', () => {
    render(setup());

    simulateBroadcastMessage({ tabId: 'someOtherTab' });

    expect(reRunQuery).not.toHaveBeenCalled();
  });
});
