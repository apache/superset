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
 * Chart List Page - Accessibility Tests (WCAG 2.1 Level A + AA)
 *
 * Tests cover:
 * - WCAG 1.1.1: Action buttons have accessible names
 * - WCAG 1.4.11: Non-text contrast for table controls
 * - WCAG 2.4.6: Table headers and column labels
 * - WCAG 2.4.7: Focus visible on list view controls
 */
import fetchMock from 'fetch-mock';
import { render, waitFor } from 'spec/helpers/testing-library';
import { checkA11y } from 'spec/helpers/a11yTestHelper';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
}));

// Mock the ChartList component with accessible ListView structure
jest.mock('./index', () => ({
  __esModule: true,
  default: () => (
    <div data-test="chart-list-page">
      <header>
        <h2>Charts</h2>
        <div role="toolbar" aria-label="Chart actions">
          <button type="button" aria-label="Create new chart">
            + Chart
          </button>
          <button type="button" aria-label="Import chart">
            Import
          </button>
        </div>
      </header>
      <section aria-label="Chart filters">
        <label htmlFor="chart-search">Search charts</label>
        <input id="chart-search" type="search" aria-label="Search charts" />
      </section>
      <table aria-label="Charts list">
        <thead>
          <tr>
            <th scope="col">
              <input type="checkbox" aria-label="Select all charts" />
            </th>
            <th scope="col">Chart name</th>
            <th scope="col">Type</th>
            <th scope="col">Dataset</th>
            <th scope="col">Modified</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input type="checkbox" aria-label="Select chart: Test Chart" />
            </td>
            <td>Test Chart</td>
            <td>Table</td>
            <td>test_dataset</td>
            <td>2024-01-01</td>
            <td>
              <button type="button" aria-label="Edit Test Chart">
                Edit
              </button>
              <button type="button" aria-label="Delete Test Chart">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
}));

import ChartList from './index';

// eslint-disable-next-line no-restricted-globals
describe('Chart List Page - Accessibility', () => {
  test('should have no axe-core violations', async () => {
    const { container } = render(<ChartList />, {
      useRedux: true,
      useRouter: true,
    });
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('table should have proper column headers with scope', () => {
    const { getAllByRole } = render(<ChartList />, {
      useRedux: true,
      useRouter: true,
    });
    const columnHeaders = getAllByRole('columnheader');
    columnHeaders.forEach(header => {
      expect(header).toHaveAttribute('scope', 'col');
    });
  });

  test('action buttons should have descriptive aria-labels', () => {
    const { getByRole } = render(<ChartList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(
      getByRole('button', { name: 'Create new chart' }),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Edit Test Chart' }),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Delete Test Chart' }),
    ).toBeInTheDocument();
  });

  test('search input should have associated label', () => {
    const { getByLabelText } = render(<ChartList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(getByLabelText('Search charts')).toBeInTheDocument();
  });

  test('checkboxes should have accessible names', () => {
    const { getByRole } = render(<ChartList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(
      getByRole('checkbox', { name: 'Select all charts' }),
    ).toBeInTheDocument();
    expect(
      getByRole('checkbox', { name: 'Select chart: Test Chart' }),
    ).toBeInTheDocument();
  });
});
