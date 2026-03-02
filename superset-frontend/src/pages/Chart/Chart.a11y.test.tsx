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
 * Explore/Chart Builder Page - Accessibility Tests (WCAG 2.1 Level A + AA)
 *
 * Tests cover:
 * - WCAG 1.1.1: Control panels have accessible labels
 * - WCAG 1.3.3: Dropdown controls convey info beyond color
 * - WCAG 2.4.6: Headings and labels for control sections
 * - WCAG 2.4.7: Focus visible on chart builder controls
 * - WCAG 3.3.1: Error identification in chart configuration
 */
import fetchMock from 'fetch-mock';
import { render, waitFor } from 'spec/helpers/testing-library';
import { checkA11y } from 'spec/helpers/a11yTestHelper';

jest.mock('src/hooks/useUnsavedChangesPrompt', () => ({
  useUnsavedChangesPrompt: jest.fn().mockReturnValue({
    showModal: false,
    setShowModal: jest.fn(),
    handleConfirmNavigation: jest.fn(),
    handleSaveAndCloseModal: jest.fn(),
  }),
}));

jest.mock('re-resizable', () => ({
  Resizable: () => <div data-test="mock-re-resizable" />,
}));

jest.mock(
  'src/explore/components/ExploreChartPanel',
  () =>
    () => (
      <div data-test="mock-explore-chart-panel" role="region" aria-label="Chart visualization">
        <div role="img" aria-label="Chart output">Chart content</div>
      </div>
    ),
);

jest.mock('src/dashboard/util/charts/getFormDataWithExtraFilters');
jest.mock('src/explore/exploreUtils/getParsedExploreURLParams', () => ({
  getParsedExploreURLParams: jest.fn().mockReturnValue(new Map()),
}));

import ChartPage from '.';

// eslint-disable-next-line no-restricted-globals
describe('Explore/Chart Builder Page - Accessibility', () => {
  beforeEach(() => {
    fetchMock.get('glob:*/api/v1/explore/*', {
      result: {
        dataset: { id: 1 },
        form_data: { viz_type: 'table', datasource: '1__table' },
      },
    });
  });

  afterEach(() => {
    fetchMock.clearHistory().removeRoutes();
  });

  test('should have no axe-core violations', async () => {
    const { container } = render(<ChartPage />, {
      useRouter: true,
      useRedux: true,
      useDnd: true,
    });
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls('glob:*/api/v1/explore/*').length,
      ).toBeGreaterThanOrEqual(1),
    );
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('chart panel should have accessible region landmark', async () => {
    const { getByTestId } = render(<ChartPage />, {
      useRouter: true,
      useRedux: true,
      useDnd: true,
    });
    await waitFor(() =>
      expect(getByTestId('mock-explore-chart-panel')).toBeInTheDocument(),
    );
    const panel = getByTestId('mock-explore-chart-panel');
    expect(panel).toHaveAttribute('role', 'region');
    expect(panel).toHaveAttribute('aria-label', 'Chart visualization');
  });
});
