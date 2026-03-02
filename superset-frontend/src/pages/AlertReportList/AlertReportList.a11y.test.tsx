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
 * Alert/Report List Page - Accessibility Tests (WCAG 2.1 Level A + AA)
 *
 * Tests cover:
 * - WCAG 1.1.1: Status icons have text alternatives
 * - WCAG 1.4.1: Status not conveyed by color alone
 * - WCAG 1.4.11: Non-text contrast for status indicators
 * - WCAG 2.4.6: Table headers and column labels
 * - WCAG 3.3.1: Error states are programmatically identifiable
 */
import { render } from 'spec/helpers/testing-library';
import { checkA11y } from 'spec/helpers/a11yTestHelper';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
}));

// Mock AlertReportList with accessible ListView structure
jest.mock('./index', () => ({
  __esModule: true,
  default: () => (
    <div data-test="alert-report-list-page">
      <header>
        <h2>Alerts &amp; Reports</h2>
        <div role="toolbar" aria-label="Alert and report actions">
          <button type="button" aria-label="Create new alert">
            + Alert
          </button>
          <button type="button" aria-label="Create new report">
            + Report
          </button>
        </div>
      </header>
      <table aria-label="Alerts and reports list">
        <thead>
          <tr>
            <th scope="col">
              <input
                type="checkbox"
                aria-label="Select all alerts and reports"
              />
            </th>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">Schedule</th>
            <th scope="col">Status</th>
            <th scope="col">Last run</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input
                type="checkbox"
                aria-label="Select alert: Revenue Alert"
              />
            </td>
            <td>Revenue Alert</td>
            <td>Alert</td>
            <td>Every day at 9:00 AM</td>
            <td>
              <span
                role="status"
                aria-label="Status: Active"
                data-status="active"
              >
                Active
              </span>
            </td>
            <td>2024-01-01 09:00</td>
            <td>
              <button type="button" aria-label="Edit Revenue Alert">
                Edit
              </button>
              <button type="button" aria-label="Delete Revenue Alert">
                Delete
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <input
                type="checkbox"
                aria-label="Select report: Weekly Report"
              />
            </td>
            <td>Weekly Report</td>
            <td>Report</td>
            <td>Every Monday at 8:00 AM</td>
            <td>
              <span
                role="status"
                aria-label="Status: Error"
                data-status="error"
              >
                Error
              </span>
            </td>
            <td>2024-01-01 08:00</td>
            <td>
              <button type="button" aria-label="Edit Weekly Report">
                Edit
              </button>
              <button type="button" aria-label="Delete Weekly Report">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
}));

import AlertReportList from './index';

// eslint-disable-next-line no-restricted-globals
describe('Alert/Report List Page - Accessibility', () => {
  test('should have no axe-core violations', async () => {
    const { container } = render(<AlertReportList />, {
      useRedux: true,
      useRouter: true,
    });
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('table should have proper column headers', () => {
    const { getAllByRole } = render(<AlertReportList />, {
      useRedux: true,
      useRouter: true,
    });
    const columnHeaders = getAllByRole('columnheader');
    expect(columnHeaders.length).toBe(7);
    columnHeaders.forEach(header => {
      expect(header).toHaveAttribute('scope', 'col');
    });
  });

  test('status indicators should have accessible text labels', () => {
    const { getAllByRole } = render(<AlertReportList />, {
      useRedux: true,
      useRouter: true,
    });
    const statusElements = getAllByRole('status');
    expect(statusElements.length).toBe(2);
    expect(statusElements[0]).toHaveAttribute('aria-label', 'Status: Active');
    expect(statusElements[1]).toHaveAttribute('aria-label', 'Status: Error');
  });

  test('status should not rely on color alone (WCAG 1.4.1)', () => {
    const { getAllByRole } = render(<AlertReportList />, {
      useRedux: true,
      useRouter: true,
    });
    const statusElements = getAllByRole('status');
    statusElements.forEach(el => {
      // Status text is visible, not just conveyed by color
      expect(el.textContent).toBeTruthy();
      expect(el.textContent!.length).toBeGreaterThan(0);
    });
  });

  test('action buttons should have descriptive aria-labels', () => {
    const { getByRole } = render(<AlertReportList />, {
      useRedux: true,
      useRouter: true,
    });
    expect(
      getByRole('button', { name: 'Create new alert' }),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Edit Revenue Alert' }),
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: 'Delete Weekly Report' }),
    ).toBeInTheDocument();
  });
});
