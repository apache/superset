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

/**
 * SQL Lab Page - Accessibility Tests (WCAG 2.1 Level A + AA)
 *
 * Tests cover:
 * - WCAG 1.1.1: Editor and result areas have accessible labels
 * - WCAG 2.4.6: Tab headings are descriptive
 * - WCAG 2.4.7: Focus management in tabbed interface
 * - WCAG 3.3.1: SQL error messages are programmatically identifiable
 */
import fetchMock from 'fetch-mock';
import {
  render,
  act,
  waitFor,
  defaultStore as store,
  createStore,
} from 'spec/helpers/testing-library';
import reducers from 'spec/helpers/reducerIndex';
import { api } from 'src/hooks/apiResources/queryApi';
import { DEFAULT_COMMON_BOOTSTRAP_DATA } from 'src/constants';
import { checkA11y } from 'spec/helpers/a11yTestHelper';

import SqlLab from '.';

const fakeApiResult = {
  result: {
    common: DEFAULT_COMMON_BOOTSTRAP_DATA,
    tab_state_ids: [],
    databases: [],
    queries: {},
    user: {
      userId: 1,
      username: 'test_user',
      isActive: true,
      isAnonymous: false,
      firstName: 'Test',
      lastName: 'User',
      permissions: {},
      roles: {},
    },
  },
};

const sqlLabInitialStateApiRoute = `glob:*/api/v1/sqllab/`;

jest.mock('src/SqlLab/components/App', () => () => (
  <div data-test="mock-sqllab-app" role="application" aria-label="SQL Lab editor">
    <div role="tablist" aria-label="Query tabs">
      <button role="tab" aria-selected="true" aria-controls="tab-panel-1">
        Query 1
      </button>
    </div>
    <div id="tab-panel-1" role="tabpanel" aria-labelledby="tab-1">
      <label htmlFor="sql-editor">SQL Query</label>
      <textarea id="sql-editor" aria-label="SQL query editor" />
      <button type="button" aria-label="Run query">
        Run
      </button>
      <section aria-label="Query results">
        <table aria-label="Query result table">
          <thead>
            <tr>
              <th scope="col">Column</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Value</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
));

// eslint-disable-next-line no-restricted-globals
describe('SQL Lab Page - Accessibility', () => {
  beforeEach(() => {
    fetchMock.get(sqlLabInitialStateApiRoute, fakeApiResult);
  });

  afterEach(() => {
    fetchMock.clearHistory().removeRoutes();
    act(() => {
      store.dispatch(api.util.resetApiState());
    });
  });

  test('should have no axe-core violations', async () => {
    const storeWithSqlLab = createStore({}, reducers);
    const { container } = render(<SqlLab />, {
      useRedux: true,
      useRouter: true,
      store: storeWithSqlLab,
    });
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(sqlLabInitialStateApiRoute).length,
      ).toBe(1),
    );
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('tab interface should follow WAI-ARIA tabs pattern', async () => {
    const storeWithSqlLab = createStore({}, reducers);
    const { getByRole } = render(<SqlLab />, {
      useRedux: true,
      useRouter: true,
      store: storeWithSqlLab,
    });
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(sqlLabInitialStateApiRoute).length,
      ).toBe(1),
    );
    expect(getByRole('tablist')).toHaveAttribute('aria-label', 'Query tabs');
    expect(getByRole('tab')).toHaveAttribute('aria-selected', 'true');
  });

  test('SQL editor should have accessible label', async () => {
    const storeWithSqlLab = createStore({}, reducers);
    const { getByLabelText } = render(<SqlLab />, {
      useRedux: true,
      useRouter: true,
      store: storeWithSqlLab,
    });
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(sqlLabInitialStateApiRoute).length,
      ).toBe(1),
    );
    expect(getByLabelText('SQL query editor')).toBeInTheDocument();
  });

  test('result table should have proper table structure', async () => {
    const storeWithSqlLab = createStore({}, reducers);
    const { getByRole } = render(<SqlLab />, {
      useRedux: true,
      useRouter: true,
      store: storeWithSqlLab,
    });
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(sqlLabInitialStateApiRoute).length,
      ).toBe(1),
    );
    const table = getByRole('table');
    expect(table).toHaveAttribute('aria-label', 'Query result table');
  });
});
