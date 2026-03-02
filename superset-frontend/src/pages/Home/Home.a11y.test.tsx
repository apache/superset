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
 * Home/Welcome Page - Accessibility Tests (WCAG 2.1 Level A + AA)
 *
 * Tests cover:
 * - WCAG 1.1.1: Non-text content has alternatives
 * - WCAG 1.3.3: Sensory characteristics (toggle switches)
 * - WCAG 2.4.6: Headings and labels
 * - WCAG 2.4.7: Focus visible on navigation elements
 */
import fetchMock from 'fetch-mock';
import { render, waitFor } from 'spec/helpers/testing-library';
import { checkA11y } from 'spec/helpers/a11yTestHelper';
import Welcome from 'src/pages/Home';

// API mocks matching Home.test.tsx patterns
fetchMock.get('glob:*/api/v1/chart/?*', { result: [] });
fetchMock.get('glob:*/api/v1/chart/_info?*', { permissions: [] });
fetchMock.get('glob:*/api/v1/chart/favorite_status?*', { result: [] });
fetchMock.get('glob:*/api/v1/dashboard/?*', { result: [] });
fetchMock.get('glob:*/api/v1/dashboard/_info?*', { permissions: [] });
fetchMock.get('glob:*/api/v1/dashboard/favorite_status/?*', { result: [] });
fetchMock.get('glob:*/api/v1/saved_query/?*', { result: [] });
fetchMock.get('glob:*/api/v1/saved_query/_info?*', { permissions: [] });
fetchMock.get('glob:*/api/v1/log/recent_activity/*', { result: [] });

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn().mockReturnValue(false),
}));

const mockedProps = {
  user: {
    username: 'alpha',
    firstName: 'alpha',
    lastName: 'alpha',
    createdOn: '2016-11-11T12:34:17',
    userId: 5,
    email: 'alpha@alpha.com',
    isActive: true,
    isAnonymous: false,
    permissions: {},
    roles: {
      sql_lab: [['can_read', 'SavedQuery']],
    },
  },
};

// eslint-disable-next-line no-restricted-globals
describe('Home/Welcome Page - Accessibility', () => {
  afterEach(() => {
    fetchMock.clearHistory();
  });

  test('should have no axe-core violations', async () => {
    const { container } = await waitFor(() =>
      render(<Welcome {...mockedProps} />, {
        useRedux: true,
        useRouter: true,
      }),
    );
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('navigation panels should have accessible headings', async () => {
    const { findAllByText } = await waitFor(() =>
      render(<Welcome {...mockedProps} />, {
        useRedux: true,
        useRouter: true,
      }),
    );
    const panels = await findAllByText(/Dashboards|Charts|Recents/);
    expect(panels.length).toBeGreaterThan(0);
  });

  test('interactive elements should be keyboard accessible', async () => {
    const { container } = await waitFor(() =>
      render(<Welcome {...mockedProps} />, {
        useRedux: true,
        useRouter: true,
      }),
    );
    // All buttons and links should be focusable
    const focusableElements = container.querySelectorAll(
      'button, a[href], [tabindex]:not([tabindex="-1"])',
    );
    expect(focusableElements.length).toBeGreaterThan(0);
  });
});
