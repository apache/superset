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
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  API_ENDPOINTS,
  setupMocks,
  renderDatasetList,
  mockAdminUser,
} from './DatasetList.testHelpers';

beforeEach(() => {
  setupMocks();
  window.featureFlags = { SEMANTIC_LAYERS: true } as never;
  fetchMock.get(API_ENDPOINTS.SEMANTIC_LAYERS, { result: [], count: 0 });
});

afterEach(() => {
  window.featureFlags = {} as never;
  fetchMock.clearHistory().removeRoutes();
  jest.restoreAllMocks();
});

test.each([false, true])(
  'dataset connection options respect independent layer read (%s)',
  async canReadLayer => {
    const user = {
      ...mockAdminUser,
      roles: {
        Admin: [
          ...mockAdminUser.roles.Admin,
          ...(canReadLayer ? [['can_read', 'SemanticLayer']] : []),
        ],
      },
    };
    renderDatasetList(user);
    await screen.findByTestId('search-filter-container');
    const filter = screen
      .getAllByTestId('compact-filter-pill')
      .find(item => item.textContent?.includes('Data connection'));
    expect(filter).toBeDefined();
    await userEvent.click(filter!);
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(API_ENDPOINTS.DATASET_RELATED_DATABASE)
          .length,
      ).toBeGreaterThan(0),
    );
    expect(
      fetchMock.callHistory.calls(API_ENDPOINTS.SEMANTIC_LAYERS).length > 0,
    ).toBe(canReadLayer);
  },
);
