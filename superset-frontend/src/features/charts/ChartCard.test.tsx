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
import { createMemoryHistory, type Update } from 'history';
import { Router } from 'react-router-dom';
import { isFeatureEnabled } from '@superset-ui/core';
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import type Chart from 'src/types/Chart';
import ChartCard from './ChartCard';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockChart = {
  id: 1,
  slice_name: 'Sample Chart',
  url: '/explore/?slice_id=1',
  changed_on_delta_humanized: '2 days ago',
  datasource_name_text: 'Sample dataset',
  thumbnail_url: '/thumbnail.png',
} as Chart;

const renderCard = (history: ReturnType<typeof createMemoryHistory>) =>
  render(
    <Router history={history}>
      <ChartCard
        chart={mockChart}
        hasPerm={() => true}
        openChartEditModal={jest.fn()}
        bulkSelectEnabled={false}
        addDangerToast={jest.fn()}
        addSuccessToast={jest.fn()}
        refreshData={jest.fn()}
        saveFavoriteStatus={jest.fn()}
        favoriteStatus={false}
        showThumbnails
        handleBulkChartExport={jest.fn()}
      />
    </Router>,
  );

const recordNavigations = (
  history: ReturnType<typeof createMemoryHistory>,
): string[] => {
  const navigations: string[] = [];
  history.listen(({ action, location }: Update) =>
    navigations.push(`${action} ${location.pathname}${location.search}`),
  );
  return navigations;
};

beforeEach(() => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
});

afterEach(() => {
  (isFeatureEnabled as jest.Mock).mockReset();
});

test('renders the chart title', () => {
  renderCard(createMemoryHistory());
  expect(screen.getByText('Sample Chart')).toBeInTheDocument();
});

test('clicking the thumbnail navigates to the chart exactly once', () => {
  // The cover is a router link and the whole card is clickable, so a click on
  // the cover used to be handled twice and pushed two identical entries. That
  // left the Back button popping the duplicate instead of returning the user to
  // the page they came from.
  const history = createMemoryHistory({
    initialEntries: ['/superset/welcome/'],
  });
  renderCard(history);
  const navigations = recordNavigations(history);

  fireEvent.click(screen.getByRole('link'));

  expect(navigations).toEqual(['PUSH /explore/?slice_id=1']);
});

test('clicking the card outside the thumbnail navigates to the chart', () => {
  const history = createMemoryHistory({
    initialEntries: ['/superset/welcome/'],
  });
  renderCard(history);
  const navigations = recordNavigations(history);

  fireEvent.click(screen.getByText('Sample Chart'));

  expect(navigations).toEqual(['PUSH /explore/?slice_id=1']);
});
