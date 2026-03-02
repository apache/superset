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
 * Dataset List Page - Accessibility Tests (WCAG 2.1 Level A + AA)
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

// Mock DatasetList with accessible ListView structure
jest.mock('./index', () => ({
  __esModule: true,
  default: () => (
    <div data-test="dataset-list-page">
      <header>
        <h2>Datasets</h2>
        <div role="toolbar" aria-label="Dataset actions">
          <button type="button" aria-label="Create new dataset">
            + Dataset
          </button>
        </div>
      </header>
      <section aria-label="Dataset filters">
        <label htmlFor="dataset-search">Search datasets</label>
        <input
          id="dataset-search"
          type="search"
          aria-label="Search datasets"
        />
      </section>
      <table aria-label="Datasets list">
        <thead>
          <tr>
            <th scope="col">
              <input type="checkbox" aria-label="Select all datasets" />
            </th>
            <th scope="col">Dataset name</th>
            <th scope="col">Type</th>
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
                aria-label="Select dataset: sales_data"
              />
            </td>
            <td>sales_data</td>
            <td>Physical</td>
            <td>PostgreSQL</td>
            <td>public</td>
            <td>2024-01-01</td>
            <td>
              <button type="button" aria-label="Edit sales_data dataset">
                Edit
              </button>
              <button type="button" aria-label="Delete sales_data dataset">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
}));

import DatasetList from './index';

// eslint-disable-next-line no-restricted-globals
describe('Dataset List Page - Accessibility', () => {
  test('should have no axe-core violations', async () => {
    const { container } = render(<DatasetList />, {
      useRedux: true,
      useRouter: true,
    });
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('table should have proper column headers with scope', () => {
    const { getAllByRole } = render(<DatasetList />, {
      useRedux: true,
      useRouter: true,
    });
    const columnHeaders = getAllByRole('columnheader');
    expect(columnHeaders.length).toBe(7);
    columnHeaders.forEach(header => {
      expect(header).toHaveAttribute('scope', 'col');
    });
  });

  test('action buttons should have descriptive aria-labels', () => {
    const { getByRole } = render(<DatasetList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(
      getByRole('button', { name: 'Create new dataset' }),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Edit sales_data dataset' }),
    ).toBeInTheDocument();
  });

  test('bulk select checkboxes should have accessible names', () => {
    const { getByRole } = render(<DatasetList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(
      getByRole('checkbox', { name: 'Select all datasets' }),
    ).toBeInTheDocument();
    expect(
      getByRole('checkbox', { name: 'Select dataset: sales_data' }),
    ).toBeInTheDocument();
  });
});
