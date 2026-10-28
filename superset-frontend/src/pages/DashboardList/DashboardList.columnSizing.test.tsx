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
import fetchMock from 'fetch-mock';
import { screen, waitFor } from 'spec/helpers/testing-library';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import {
  mockAdminUser,
  setupMocks,
  renderDashboardList,
} from './DashboardList.testHelpers';
import {
  expectColumnWidthsWithinLayouts,
  mockListViewContainerWidth,
} from 'spec/helpers/listViewColumnWidths';
import { expectTruncatingTitle } from 'spec/helpers/listViewTitleCell';

const CONTAINER_WIDTH = 1440;

jest.setTimeout(30000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

beforeEach(() => {
  setupMocks();
  // Enable the optional Tags and Viewers columns; the card-view default
  // stays off so the table is rendered.
  mockIsFeatureEnabled.mockImplementation(
    flag =>
      flag === FeatureFlag.TaggingSystem || flag === FeatureFlag.EnableViewers,
  );
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  mockIsFeatureEnabled.mockReset();
  jest.restoreAllMocks();
});

test('every visible column resolves to a width within its layout', async () => {
  mockListViewContainerWidth(CONTAINER_WIDTH);
  renderDashboardList(mockAdminUser);

  const table = await screen.findByTestId('listview-table');
  await waitFor(() =>
    expect(
      table.querySelectorAll('tbody tr[data-test="table-row"]').length,
    ).toBeGreaterThan(0),
  );

  // Every column is sized from its layout preset, so no column absorbs the
  // spare width (squashing Name or inflating Actions) and the table fills
  // the container exactly.
  expectColumnWidthsWithinLayouts(
    table,
    {
      '': 'icon',
      Name: 'title',
      Status: 'status',
      Tags: 'tags',
      Editors: 'people',
      Viewers: 'people',
      'Last modified': 'date',
      Actions: 'actions',
    },
    CONTAINER_WIDTH,
  );
});

test('dashboard titles truncate with an ellipsis beside their badges', async () => {
  renderDashboardList(mockAdminUser);

  for (const title of ['Sales Dashboard', 'Analytics Dashboard']) {
    const link = await screen.findByTitle(title);
    expect(link.tagName).toBe('A');
    expectTruncatingTitle(link);
  }
});
