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
import { render, waitFor } from 'spec/helpers/testing-library';
import {
  setupAGGridModules,
  type AgGridContainerElement,
} from '@superset-ui/core/components/ThemedAgGridReact';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import { ResultsPaneOnDashboard } from '../components';
import { createResultsPaneOnDashboardProps } from './fixture';

jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(),
}));
jest.mock('src/explore/exploreUtils', () => ({
  ...jest.requireActual('src/explore/exploreUtils'),
  buildV1ChartDataPayload: jest.fn(),
}));

const mockedBuildPayload = buildV1ChartDataPayload as jest.Mock;

const queriesResponse = [
  {
    colnames: ['genre', 'count'],
    coltypes: [1, 0],
    data: [
      { genre: 'Action', count: 3 },
      { genre: 'Horror', count: 1 },
    ],
    rowcount: 2,
  },
];

const renderPane = async (sliceId: number) => {
  const { container } = render(
    <ResultsPaneOnDashboard
      {...createResultsPaneOnDashboardProps({ sliceId, queriesResponse })}
    />,
    { useRedux: true },
  );
  const gridContainer = await waitFor(() => {
    const el = container.querySelector<AgGridContainerElement>(
      '[data-themed-ag-grid]',
    );
    expect(el?._agGridApi).toBeDefined();
    return el!;
  });
  return gridContainer._agGridApi!;
};

const sortedColumns = (api: Awaited<ReturnType<typeof renderPane>>) =>
  api
    .getColumnState()
    .filter(state => state.sort)
    .map(state => [state.colId, state.sort]);

beforeAll(() => {
  setupAGGridModules();
});

beforeEach(() => {
  mockedBuildPayload.mockReset();
});

test('shows the order the results query uses as the initial sort', async () => {
  mockedBuildPayload.mockResolvedValue({
    queries: [{ orderby: [['count', false]], post_processing: [] }],
  });

  const api = await renderPane(301);

  await waitFor(() => expect(sortedColumns(api)).toEqual([['count', 'desc']]));
});

test('resolves an adhoc metric in the default order to its result label', async () => {
  mockedBuildPayload.mockResolvedValue({
    queries: [
      {
        orderby: [
          [
            {
              expressionType: 'SQL',
              sqlExpression: 'COUNT(*)',
              label: 'count',
            },
            true,
          ],
        ],
        post_processing: [],
      },
    ],
  });

  const api = await renderPane(302);

  await waitFor(() => expect(sortedColumns(api)).toEqual([['count', 'asc']]));
});

test('shows no initial sort when post-processing reorders the rows', async () => {
  mockedBuildPayload.mockResolvedValue({
    queries: [
      {
        orderby: [['count', false]],
        post_processing: [{ operation: 'cum' }],
      },
    ],
  });

  const api = await renderPane(303);

  await waitFor(() => expect(mockedBuildPayload).toHaveBeenCalled());
  // Let the resolved payload's state update land before checking.
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(sortedColumns(api)).toEqual([]);
});
