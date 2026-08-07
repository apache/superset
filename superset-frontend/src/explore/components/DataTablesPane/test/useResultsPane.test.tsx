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
import { screen, render, waitFor } from 'spec/helpers/testing-library';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { ResultsPaneOnDashboard } from '../components';
import { createResultsPaneOnDashboardProps } from './fixture';

// Mocked so each test can assert whether the results branch hit the network.
jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(),
}));

const mockedGetChartDataRequest = getChartDataRequest as jest.Mock;

beforeAll(() => {
  setupAGGridModules();
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('useResultsPane query data reuse', () => {
  beforeEach(() => {
    mockedGetChartDataRequest.mockReset();
  });

  test('reuses queriesResponse from Redux and skips the results API call (v1 charts)', async () => {
    const props = createResultsPaneOnDashboardProps({
      sliceId: 201,
      queriesResponse: [
        {
          colnames: ['genre'],
          coltypes: [1],
          data: [{ genre: 'Action' }, { genre: 'Horror' }],
          rowcount: 2,
        },
      ],
    });

    render(<ResultsPaneOnDashboard {...props} />, { useRedux: true });

    expect(await screen.findByText('Action')).toBeVisible();
    expect(screen.getByText('Horror')).toBeVisible();
    expect(mockedGetChartDataRequest).not.toHaveBeenCalled();
  });

  test('falls back to the results API for legacy charts without a typed queriesResponse', async () => {
    mockedGetChartDataRequest.mockResolvedValue({
      json: {
        result: [
          {
            colnames: ['genre'],
            coltypes: [1],
            data: [{ genre: 'Drama' }],
            rowcount: 1,
          },
        ],
      },
    });
    const props = createResultsPaneOnDashboardProps({ sliceId: 202 });

    render(<ResultsPaneOnDashboard {...props} />, { useRedux: true });

    expect(await screen.findByText('Drama')).toBeVisible();
    expect(mockedGetChartDataRequest).toHaveBeenCalledTimes(1);
  });

  test('falls back to the results API when queriesResponse has no colnames', async () => {
    mockedGetChartDataRequest.mockResolvedValue({
      json: {
        result: [
          {
            colnames: ['genre'],
            coltypes: [1],
            data: [{ genre: 'Thriller' }],
            rowcount: 1,
          },
        ],
      },
    });
    const props = createResultsPaneOnDashboardProps({
      sliceId: 203,
      queriesResponse: [{ data: [{ genre: 'ignored' }] }],
    });

    render(<ResultsPaneOnDashboard {...props} />, { useRedux: true });

    expect(await screen.findByText('Thriller')).toBeVisible();
    expect(mockedGetChartDataRequest).toHaveBeenCalledTimes(1);
  });

  test('falls back to the API when queriesResponse has colnames but not the full v1 shape', async () => {
    mockedGetChartDataRequest.mockResolvedValue({
      json: {
        result: [
          {
            colnames: ['genre'],
            coltypes: [1],
            data: [{ genre: 'Indie' }],
            rowcount: 1,
          },
        ],
      },
    });
    const props = createResultsPaneOnDashboardProps({
      sliceId: 207,
      // colnames present but coltypes/data missing: not a real v1 result
      queriesResponse: [{ colnames: ['genre'] }],
    });

    render(<ResultsPaneOnDashboard {...props} />, { useRedux: true });

    expect(await screen.findByText('Indie')).toBeVisible();
    expect(mockedGetChartDataRequest).toHaveBeenCalledTimes(1);
  });

  test('reuse path honors the effective row limit (slices Redux data, no extra query)', async () => {
    const props = createResultsPaneOnDashboardProps({
      sliceId: 204,
      rowLimit: 2,
      queriesResponse: [
        {
          colnames: ['genre'],
          coltypes: [1],
          data: [
            { genre: 'Action' },
            { genre: 'Horror' },
            { genre: 'Comedy' },
            { genre: 'Drama' },
            { genre: 'Sci-Fi' },
          ],
          rowcount: 5,
        },
      ],
    });

    render(<ResultsPaneOnDashboard {...props} />, { useRedux: true });

    expect(await screen.findByText('Action')).toBeVisible();
    expect(screen.getByText('Horror')).toBeVisible();
    expect(screen.queryByText('Comedy')).not.toBeInTheDocument();
    expect(screen.queryByText('Sci-Fi')).not.toBeInTheDocument();
    expect(screen.getByText('2 rows')).toBeVisible();
    expect(mockedGetChartDataRequest).not.toHaveBeenCalled();
  });

  test('renders an empty (0 rows) result from reused data without an API call', async () => {
    const props = createResultsPaneOnDashboardProps({
      sliceId: 205,
      queriesResponse: [
        { colnames: ['genre'], coltypes: [1], data: [], rowcount: 0 },
      ],
    });

    render(<ResultsPaneOnDashboard {...props} />, { useRedux: true });

    expect(await screen.findByText('0 rows')).toBeVisible();
    expect(mockedGetChartDataRequest).not.toHaveBeenCalled();
  });

  test('clears the force-query flag when reusing Redux data', async () => {
    const props = createResultsPaneOnDashboardProps({
      sliceId: 206,
      queryForce: true,
      queriesResponse: [
        {
          colnames: ['genre'],
          coltypes: [1],
          data: [{ genre: 'Action' }],
          rowcount: 1,
        },
      ],
    });
    const setForceQuery = jest.fn();

    render(
      <ResultsPaneOnDashboard {...props} setForceQuery={setForceQuery} />,
      {
        useRedux: true,
      },
    );

    await waitFor(() => expect(setForceQuery).toHaveBeenCalledWith(false));
    expect(mockedGetChartDataRequest).not.toHaveBeenCalled();
  });
});
