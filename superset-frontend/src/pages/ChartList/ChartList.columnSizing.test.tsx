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
import { mockUserSubjectsBootstrapData } from 'spec/helpers/mockBootstrapData';
import { screen, waitFor } from 'spec/helpers/testing-library';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { setupMocks, renderChartList } from './ChartList.testHelpers';

jest.setTimeout(30000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('src/utils/getBootstrapData', () =>
  mockUserSubjectsBootstrapData([1]),
);

const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_sqllab', 'Superset'],
      ['can_write', 'Dashboard'],
      ['can_write', 'Chart'],
      ['can_export', 'Chart'],
    ],
  },
};

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
});

test('every visible column renders with an explicit width', async () => {
  renderChartList(mockUser);

  const table = await screen.findByTestId('listview-table');
  await waitFor(() =>
    expect(
      table.querySelectorAll('tbody tr[data-test="table-row"]').length,
    ).toBeGreaterThan(0),
  );

  const headers = Array.from(table.querySelectorAll('thead th')).map(th =>
    th.textContent?.trim(),
  );
  expect(headers).toEqual(
    expect.arrayContaining([
      'Name',
      'Type',
      'Dataset',
      'On dashboards',
      'Tags',
      'Editors',
      'Viewers',
      'Last modified',
      'Actions',
    ]),
  );

  const cols = Array.from(table.querySelectorAll('colgroup col'));
  expect(cols).toHaveLength(headers.length);
  cols.forEach((col, index) => {
    // An unsized column absorbs all spare table width, squashing the
    // sized ones (e.g. Name) and inflating the Type column.
    expect({
      column: headers[index],
      width: (col as HTMLElement).style.width,
    }).toEqual({ column: headers[index], width: expect.stringMatching(/px$/) });
  });
});
