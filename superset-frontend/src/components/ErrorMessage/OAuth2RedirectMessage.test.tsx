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
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ErrorLevel,
  ErrorSource,
  ErrorTypeEnum,
  ThemeProvider,
  supersetTheme,
} from '@superset-ui/core';
import OAuth2RedirectMessage from 'src/components/ErrorMessage/OAuth2RedirectMessage';
import { reRunQuery } from 'src/SqlLab/actions/sqlLab';
import { triggerQuery } from 'src/components/Chart/chartAction';
import { onRefresh } from 'src/dashboard/actions/dashboardState';

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

// Mock global window functions
const mockOpen = jest.spyOn(window, 'open').mockImplementation(() => null);
const mockAddEventListener = jest.spyOn(window, 'addEventListener');
const mockRemoveEventListener = jest.spyOn(window, 'removeEventListener');

// Mock window.postMessage
const originalPostMessage = window.postMessage;

beforeEach(() => {
  window.postMessage = jest.fn();
});

afterEach(() => {
  window.postMessage = originalPostMessage;
});

function simulateMessageEvent(data: any, origin: string) {
  const messageEvent = new MessageEvent('message', { data, origin });
  window.dispatchEvent(messageEvent);
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
  <ThemeProvider theme={supersetTheme}>
    <Provider store={mockStore}>
      <OAuth2RedirectMessage {...defaultProps} {...overrides} />;
    </Provider>
  </ThemeProvider>
);

describe('OAuth2RedirectMessage Component', () => {
  it('renders without crashing and displays the correct initial UI elements', () => {
    const { getByText } = render(setup());

    expect(getByText(/Authorization needed/i)).toBeInTheDocument();
    expect(getByText(/provide authorization/i)).toBeInTheDocument();
  });

  it('opens a new window with the correct URL when the link is clicked', () => {
    const { getByText } = render(setup());

    const linkElement = getByText(/provide authorization/i);
    fireEvent.click(linkElement);

    expect(mockOpen).toHaveBeenCalledWith('https://example.com', '_blank');
  });

  it('cleans up the message event listener on unmount', () => {
    const { unmount } = render(setup());

    expect(mockAddEventListener).toHaveBeenCalled();
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalled();
  });

  it('dispatches reRunQuery action when a message with correct tab ID is received for SQL Lab', async () => {
    render(setup());

    simulateMessageEvent({ tabId: 'tabId' }, 'https://redirect.example.com');

    await waitFor(() => {
      expect(reRunQuery).toHaveBeenCalledWith({ sql: 'SELECT * FROM table' });
    });
  });

  it('dispatches triggerQuery action for explore source upon receiving a correct message', async () => {
    render(setup({ source: 'explore' }));

    simulateMessageEvent({ tabId: 'tabId' }, 'https://redirect.example.com');

    await waitFor(() => {
      expect(triggerQuery).toHaveBeenCalledWith(true, 123);
    });
  });

  it('dispatches onRefresh action for dashboard source upon receiving a correct message', async () => {
    render(setup({ source: 'dashboard' }));

    simulateMessageEvent({ tabId: 'tabId' }, 'https://redirect.example.com');

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalledWith(
        ['1', '2'],
        true,
        0,
        'dashboard-id',
      );
    });
  });
});
