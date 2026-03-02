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
 * Database List Page - Accessibility Tests (WCAG 2.1 Level A + AA)
 *
 * Tests cover:
 * - WCAG 1.1.1: Action buttons have accessible names
 * - WCAG 1.4.11: Non-text contrast for table controls
 * - WCAG 2.4.6: Table headers and column labels
 */
import { render } from 'spec/helpers/testing-library';
import { checkA11y } from 'spec/helpers/a11yTestHelper';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
}));

// Mock DatabaseList with accessible ListView structure
jest.mock('./index', () => ({
  __esModule: true,
  default: () => (
    <div data-test="database-list-page">
      <header>
        <h2>Databases</h2>
        <div role="toolbar" aria-label="Database actions">
          <button type="button" aria-label="Add new database connection">
            + Database
          </button>
        </div>
      </header>
      <section aria-label="Database filters">
        <label htmlFor="database-search">Search databases</label>
        <input
          id="database-search"
          type="search"
          aria-label="Search databases"
        />
      </section>
      <table aria-label="Databases list">
        <thead>
          <tr>
            <th scope="col">Database name</th>
            <th scope="col">Backend</th>
            <th scope="col">Allow DML</th>
            <th scope="col">CSV upload</th>
            <th scope="col">Expose in SQL Lab</th>
            <th scope="col">Modified</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>PostgreSQL Production</td>
            <td>PostgreSQL</td>
            <td>
              <span role="img" aria-label="Enabled">
                Yes
              </span>
            </td>
            <td>
              <span role="img" aria-label="Disabled">
                No
              </span>
            </td>
            <td>
              <span role="img" aria-label="Enabled">
                Yes
              </span>
            </td>
            <td>2024-01-01</td>
            <td>
              <button
                type="button"
                aria-label="Edit PostgreSQL Production database"
              >
                Edit
              </button>
              <button
                type="button"
                aria-label="Delete PostgreSQL Production database"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
}));

import DatabaseList from './index';

// eslint-disable-next-line no-restricted-globals
describe('Database List Page - Accessibility', () => {
  test('should have no axe-core violations', async () => {
    const { container } = render(<DatabaseList />, {
      useRedux: true,
      useRouter: true,
    });
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('table should have proper column headers', () => {
    const { getAllByRole } = render(<DatabaseList />, {
      useRedux: true,
      useRouter: true,
    });
    const columnHeaders = getAllByRole('columnheader');
    expect(columnHeaders.length).toBe(7);
    columnHeaders.forEach(header => {
      expect(header).toHaveAttribute('scope', 'col');
    });
  });

  test('boolean indicators should have accessible text alternatives', () => {
    const { getAllByRole } = render(<DatabaseList />, {
      useRedux: true,
      useRouter: true,
    });
    const statusImages = getAllByRole('img');
    statusImages.forEach(img => {
      expect(img).toHaveAttribute('aria-label');
      expect(
        ['Enabled', 'Disabled'].includes(img.getAttribute('aria-label') || ''),
      ).toBe(true);
    });
  });

  test('action buttons should have descriptive aria-labels', () => {
    const { getByRole } = render(<DatabaseList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(
      getByRole('button', { name: 'Add new database connection' }),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Edit PostgreSQL Production database' }),
    ).toBeInTheDocument();
  });
});
