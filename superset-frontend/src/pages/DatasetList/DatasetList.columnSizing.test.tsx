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
import { act, screen, waitFor } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import {
  setupMocks,
  renderDatasetList,
  mockAdminUser,
} from './DatasetList.testHelpers';
import {
  expectColumnWidthsWithinLayouts,
  mockListViewContainerWidth,
} from 'spec/helpers/listViewColumnWidths';
import { expectTruncatingTitle } from 'spec/helpers/listViewTitleCell';

const CONTAINER_WIDTH = 1440;

jest.setTimeout(15000);

beforeEach(() => {
  setupMocks();
});

afterEach(async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  window.history.replaceState({}, '', '/');
  fetchMock.clearHistory().removeRoutes();
  jest.restoreAllMocks();
});

test('every visible column resolves to a width within its layout', async () => {
  mockListViewContainerWidth(CONTAINER_WIDTH);
  renderDatasetList(mockAdminUser);

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
      Name: 'title',
      Type: 'status',
      Database: 'text',
      Schema: 'text',
      Editors: 'people',
      'Last modified': 'date',
      Actions: 'actions',
    },
    CONTAINER_WIDTH,
  );
});

test('dataset names truncate with an ellipsis beside their badges', async () => {
  renderDatasetList(mockAdminUser);

  // Plain, certified, warning and RLS-badged rows all share the Name cell.
  for (const name of [
    'public.sales_data',
    'Analytics Query',
    'Customer Metrics',
    'Restricted Sales',
  ]) {
    const link = await screen.findByTitle(name);
    expect(link.tagName).toBe('A');
    expectTruncatingTitle(link);
  }
});
