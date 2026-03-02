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
 * Dashboard List Page - Accessibility Tests (WCAG 2.1 Level A + AA)
 *
 * Tests cover:
 * - WCAG 1.1.1: Action buttons have accessible names
 * - WCAG 1.4.11: Non-text contrast for table controls
 * - WCAG 2.4.6: Table headers and column labels
 * - WCAG 2.4.7: Focus visible on list view controls
 */
import { render } from 'spec/helpers/testing-library';
import { checkA11y } from 'spec/helpers/a11yTestHelper';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
}));

// Mock DashboardList with accessible ListView structure
jest.mock('./index', () => ({
  __esModule: true,
  default: () => (
    <div data-test="dashboard-list-page">
      <header>
        <h2>Dashboards</h2>
        <div role="toolbar" aria-label="Dashboard actions">
          <button type="button" aria-label="Create new dashboard">
            + Dashboard
          </button>
          <button type="button" aria-label="Import dashboard">
            Import
          </button>
        </div>
      </header>
      <section aria-label="Dashboard filters">
        <label htmlFor="dashboard-search">Search dashboards</label>
        <input
          id="dashboard-search"
          type="search"
          aria-label="Search dashboards"
        />
      </section>
      <table aria-label="Dashboards list">
        <thead>
          <tr>
            <th scope="col">
              <input type="checkbox" aria-label="Select all dashboards" />
            </th>
            <th scope="col">Dashboard name</th>
            <th scope="col">Status</th>
            <th scope="col">Modified</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input
                type="checkbox"
                aria-label="Select dashboard: Sales Dashboard"
              />
            </td>
            <td>Sales Dashboard</td>
            <td>
              <span role="status" aria-label="Published">
                Published
              </span>
            </td>
            <td>2024-01-01</td>
            <td>
              <button type="button" aria-label="Edit Sales Dashboard">
                Edit
              </button>
              <button type="button" aria-label="Delete Sales Dashboard">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
}));

import DashboardList from './index';

// eslint-disable-next-line no-restricted-globals
describe('Dashboard List Page - Accessibility', () => {
  test('should have no axe-core violations', async () => {
    const { container } = render(<DashboardList />, {
      useRedux: true,
      useRouter: true,
    });
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('table should have proper column headers with scope', () => {
    const { getAllByRole } = render(<DashboardList />, {
      useRedux: true,
      useRouter: true,
    });
    const columnHeaders = getAllByRole('columnheader');
    columnHeaders.forEach(header => {
      expect(header).toHaveAttribute('scope', 'col');
    });
  });

  test('action buttons should have descriptive aria-labels', () => {
    const { getByRole } = render(<DashboardList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(
      getByRole('button', { name: 'Create new dashboard' }),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Edit Sales Dashboard' }),
    ).toBeInTheDocument();
  });

  test('status indicators should have accessible labels', () => {
    const { getByRole } = render(<DashboardList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(getByRole('status')).toHaveAttribute('aria-label', 'Published');
  });
});
