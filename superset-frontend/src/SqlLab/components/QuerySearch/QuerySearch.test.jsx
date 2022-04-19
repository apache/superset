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
import React from 'react';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import QuerySearch from 'src/SqlLab/components/QuerySearch';
import { Provider } from 'react-redux';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { fireEvent, render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import userEvent from '@testing-library/user-event';
import { user } from 'src/SqlLab/fixtures';

const mockStore = configureStore([thunk]);
const store = mockStore({
  sqlLab: user,
});

const SEARCH_ENDPOINT = 'glob:*/superset/search_queries?*';
const USER_ENDPOINT = 'glob:*/api/v1/query/related/user';
const DATABASE_ENDPOINT = 'glob:*/api/v1/database/?*';

fetchMock.get(SEARCH_ENDPOINT, []);
fetchMock.get(USER_ENDPOINT, []);
fetchMock.get(DATABASE_ENDPOINT, []);

describe('QuerySearch', () => {
  const mockedProps = {
    actions: { addDangerToast: jest.fn() },
    displayLimit: 50,
  };

  it('is valid', () => {
    expect(
      React.isValidElement(
        <ThemeProvider theme={supersetTheme}>
          <Provider store={store}>
            <QuerySearch {...mockedProps} />
          </Provider>
        </ThemeProvider>,
      ),
    ).toBe(true);
  });

  beforeEach(async () => {
    // You need this await function in order to change state in the app. In fact you need it everytime you re-render.
    await act(async () => {
      render(
        <ThemeProvider theme={supersetTheme}>
          <Provider store={store}>
            <QuerySearch {...mockedProps} />
          </Provider>
        </ThemeProvider>,
      );
    });
  });

  it('should have three Selects', () => {
    expect(screen.getByText(/28 days ago/i)).toBeInTheDocument();
    expect(screen.getByText(/now/i)).toBeInTheDocument();
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  it('updates fromTime on user selects from time', () => {
    const role = screen.getByText(/28 days ago/i);
    fireEvent.keyDown(role, { key: 'ArrowDown', keyCode: 40 });
    userEvent.click(screen.getByText(/1 hour ago/i));
    expect(screen.getByText(/1 hour ago/i)).toBeInTheDocument();
  });

  it('updates toTime on user selects on time', () => {
    const role = screen.getByText(/now/i);
    fireEvent.keyDown(role, { key: 'ArrowDown', keyCode: 40 });
    userEvent.click(screen.getByText(/1 hour ago/i));
    expect(screen.getByText(/1 hour ago/i)).toBeInTheDocument();
  });

  it('updates status on user selects status', () => {
    const role = screen.getByText(/success/i);
    fireEvent.keyDown(role, { key: 'ArrowDown', keyCode: 40 });
    userEvent.click(screen.getByText(/failed/i));
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });

  it('should have one input for searchText', () => {
    expect(
      screen.getByPlaceholderText(/Query search string/i),
    ).toBeInTheDocument();
  });

  it('updates search text on user inputs search text', () => {
    const search = screen.getByPlaceholderText(/Query search string/i);
    userEvent.type(search, 'text');
    expect(search.value).toBe('text');
  });

  it('should have one Button', () => {
    const button = screen.getAllByRole('button');
    expect(button.length).toEqual(1);
  });

  it('should call API when search button is pressed', async () => {
    fetchMock.resetHistory();
    const button = screen.getByRole('button');
    await act(async () => {
      userEvent.click(button);
    });
    expect(fetchMock.calls(SEARCH_ENDPOINT)).toHaveLength(1);
  });

  it('should call API when (only)enter key is pressed', async () => {
    fetchMock.resetHistory();
    const search = screen.getByPlaceholderText(/Query search string/i);
    await act(async () => {
      userEvent.type(search, 'a');
    });
    expect(fetchMock.calls(SEARCH_ENDPOINT)).toHaveLength(0);
    await act(async () => {
      userEvent.type(search, '{enter}');
    });
    expect(fetchMock.calls(SEARCH_ENDPOINT)).toHaveLength(1);
  });
});
