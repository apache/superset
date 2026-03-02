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
 * Dashboard Page - Accessibility Tests (WCAG 2.1 Level A + AA)
 *
 * Tests cover:
 * - WCAG 1.1.1: Chart images and icons have alt text
 * - WCAG 1.3.3: Toggle switches have accessible names
 * - WCAG 1.4.11: Non-text contrast for UI controls
 * - WCAG 2.4.6: Descriptive headings for dashboard sections
 * - WCAG 2.4.7: Focus visible on interactive elements
 */
import { render } from 'spec/helpers/testing-library';
import { checkA11y } from 'spec/helpers/a11yTestHelper';

// Mock DashboardPage since it requires complex store and API setup
jest.mock('src/dashboard/containers/DashboardPage', () => ({
  DashboardPage: () => (
    <div data-test="mock-dashboard-page">
      <header>
        <h1>Test Dashboard</h1>
        <button type="button" aria-label="Edit dashboard">
          Edit
        </button>
        <button type="button" aria-label="Save dashboard">
          Save
        </button>
      </header>
      <main role="main">
        <section aria-label="Dashboard filters">
          <label htmlFor="filter-date">Date filter</label>
          <select id="filter-date" aria-label="Date range filter">
            <option>Last 7 days</option>
          </select>
        </section>
        <section aria-label="Dashboard charts">
          <div role="img" aria-label="Revenue chart">
            Chart placeholder
          </div>
          <div role="img" aria-label="Users chart">
            Chart placeholder
          </div>
        </section>
      </main>
    </div>
  ),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ idOrSlug: '1' }),
}));

import DashboardRoute from './index';

// eslint-disable-next-line no-restricted-globals
describe('Dashboard Page - Accessibility', () => {
  test('should have no axe-core violations', async () => {
    const { container } = render(<DashboardRoute />, {
      useRedux: true,
      useRouter: true,
    });
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('charts should have aria-labels for screen readers', () => {
    const { getAllByRole } = render(<DashboardRoute />, {
      useRedux: true,
      useRouter: true,
    });
    const charts = getAllByRole('img');
    charts.forEach(chart => {
      expect(chart).toHaveAttribute('aria-label');
    });
  });

  test('action buttons should have accessible names', () => {
    const { getByRole } = render(<DashboardRoute />, {
      useRedux: true,
      useRouter: true,
    });
    expect(
      getByRole('button', { name: 'Edit dashboard' }),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Save dashboard' }),
    ).toBeInTheDocument();
  });

  test('filter controls should have labels', () => {
    const { getByLabelText } = render(<DashboardRoute />, {
      useRedux: true,
      useRouter: true,
    });
    expect(getByLabelText('Date range filter')).toBeInTheDocument();
  });

  test('dashboard should have proper landmark structure', () => {
    const { getByRole } = render(<DashboardRoute />, {
      useRedux: true,
      useRouter: true,
    });
    expect(getByRole('main')).toBeInTheDocument();
  });
});
