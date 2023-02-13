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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { render } from 'spec/helpers/testing-library';

import App from 'src/SqlLab/components/App';
import sqlLabReducer from 'src/SqlLab/reducers/index';
import { LOCALSTORAGE_MAX_USAGE_KB } from 'src/SqlLab/constants';
import { LOG_EVENT } from 'src/logger/actions';

jest.mock('src/SqlLab/components/TabbedSqlEditors', () => () => (
  <div data-test="mock-tabbed-sql-editors" />
));
jest.mock('src/SqlLab/components/QueryAutoRefresh', () => () => (
  <div data-test="mock-query-auto-refresh" />
));

describe('SqlLab App', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const store = mockStore(sqlLabReducer(undefined, {}), {});
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('is valid', () => {
    expect(React.isValidElement(<App />)).toBe(true);
  });

  it('should render', () => {
    const { getByTestId } = render(<App />, { useRedux: true, store });
    expect(getByTestId('SqlLabApp')).toBeInTheDocument();
    expect(getByTestId('mock-tabbed-sql-editors')).toBeInTheDocument();
  });

  it('logs current usage warning', async () => {
    const localStorageUsageInKilobytes = LOCALSTORAGE_MAX_USAGE_KB + 10;
    const storeExceedLocalStorage = mockStore(
      sqlLabReducer(
        {
          localStorageUsageInKilobytes,
        },
        {},
      ),
    );

    const { rerender } = render(<App />, {
      useRedux: true,
      store: storeExceedLocalStorage,
    });
    rerender(<App updated />);
    expect(storeExceedLocalStorage.getActions()).toContainEqual(
      expect.objectContaining({
        type: LOG_EVENT,
      }),
    );
  });
});
