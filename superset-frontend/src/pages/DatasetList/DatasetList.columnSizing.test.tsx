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

test('every visible column renders with an explicit width', async () => {
  renderDatasetList(mockAdminUser);

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
      'Database',
      'Schema',
      'Editors',
      'Last modified',
      'Actions',
    ]),
  );

  const cols = Array.from(table.querySelectorAll('colgroup col'));
  expect(cols).toHaveLength(headers.length);
  cols.forEach((col, index) => {
    // An unsized column absorbs all spare table width, squashing the
    // sized ones (e.g. Name) and inflating the Actions column.
    expect({
      column: headers[index],
      width: (col as HTMLElement).style.width,
    }).toEqual({ column: headers[index], width: expect.stringMatching(/px$/) });
  });
});
