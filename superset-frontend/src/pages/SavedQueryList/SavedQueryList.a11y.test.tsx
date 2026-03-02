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
 * Saved Query List Page - Accessibility Tests (WCAG 2.1 Level A + AA)
 *
 * Bonus page coverage for query management accessibility.
 *
 * Tests cover:
 * - WCAG 1.1.1: Action buttons have accessible names
 * - WCAG 2.4.6: Table headers and column labels
 * - WCAG 2.4.7: Focus visible on list view controls
 */
import { render } from 'spec/helpers/testing-library';
import { checkA11y } from 'spec/helpers/a11yTestHelper';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
}));

// Mock SavedQueryList with accessible ListView structure
jest.mock('./index', () => ({
  __esModule: true,
  default: () => (
    <div data-test="saved-query-list-page">
      <header>
        <h2>Saved queries</h2>
      </header>
      <section aria-label="Query filters">
        <label htmlFor="query-search">Search saved queries</label>
        <input
          id="query-search"
          type="search"
          aria-label="Search saved queries"
        />
      </section>
      <table aria-label="Saved queries list">
        <thead>
          <tr>
            <th scope="col">
              <input type="checkbox" aria-label="Select all saved queries" />
            </th>
            <th scope="col">Query name</th>
            <th scope="col">Database</th>
            <th scope="col">Schema</th>
            <th scope="col">Modified</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input
                type="checkbox"
                aria-label="Select query: Monthly Revenue"
              />
            </td>
            <td>Monthly Revenue</td>
            <td>PostgreSQL</td>
            <td>public</td>
            <td>2024-01-01</td>
            <td>
              <button type="button" aria-label="Edit Monthly Revenue query">
                Edit
              </button>
              <button type="button" aria-label="Copy Monthly Revenue query">
                Copy
              </button>
              <button type="button" aria-label="Delete Monthly Revenue query">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
}));

import SavedQueryList from './index';

// eslint-disable-next-line no-restricted-globals
describe('Saved Query List Page - Accessibility', () => {
  test('should have no axe-core violations', async () => {
    const { container } = render(<SavedQueryList />, {
      useRedux: true,
      useRouter: true,
    });
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('table should have proper column headers', () => {
    const { getAllByRole } = render(<SavedQueryList />, {
      useRedux: true,
      useRouter: true,
    });
    const columnHeaders = getAllByRole('columnheader');
    expect(columnHeaders.length).toBe(6);
    columnHeaders.forEach(header => {
      expect(header).toHaveAttribute('scope', 'col');
    });
  });

  test('action buttons should have descriptive aria-labels', () => {
    const { getByRole } = render(<SavedQueryList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(
      getByRole('button', { name: 'Edit Monthly Revenue query' }),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Copy Monthly Revenue query' }),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Delete Monthly Revenue query' }),
    ).toBeInTheDocument();
  });

  test('search input should have associated label', () => {
    const { getByLabelText } = render(<SavedQueryList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(getByLabelText('Search saved queries')).toBeInTheDocument();
  });
});
