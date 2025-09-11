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
import userEvent from '@testing-library/user-event';
import {
  render,
  waitForElementToBeRemoved,
  waitFor,
} from 'spec/helpers/testing-library';
import { exploreActions } from 'src/explore/actions/exploreActions';
import { ChartMetadata, ChartPlugin } from '@superset-ui/core';
import { ResultsPaneOnDashboard } from '../components';
import { createResultsPaneOnDashboardProps } from './fixture';

describe('ResultsPaneOnDashboard', () => {
  // render and render errorMessage
  fetchMock.post(
    'end:/api/v1/chart/data?form_data=%7B%22slice_id%22%3A121%7D',
    {
      result: [],
    },
  );

  // force query, render and search
  fetchMock.post(
    'end:/api/v1/chart/data?form_data=%7B%22slice_id%22%3A144%7D&force=true',
    {
      result: [
        {
          data: [
            { __timestamp: 1230768000000, genre: 'Action' },
            { __timestamp: 1230768000010, genre: 'Horror' },
          ],
          colnames: ['__timestamp', 'genre'],
          coltypes: [2, 1],
          rowcount: 2,
          sql_rowcount: 2,
        },
      ],
    },
  );

  // error response
  fetchMock.post(
    'end:/api/v1/chart/data?form_data=%7B%22slice_id%22%3A169%7D',
    400,
  );

  // multiple results pane
  fetchMock.post(
    'end:/api/v1/chart/data?form_data=%7B%22slice_id%22%3A196%7D',
    {
      result: [
        {
          data: [
            { __timestamp: 1230768000000 },
            { __timestamp: 1230768000010 },
          ],
          colnames: ['__timestamp'],
          coltypes: [2],
        },
        {
          data: [{ genre: 'Action' }, { genre: 'Horror' }],
          colnames: ['genre'],
          coltypes: [1],
          rowcount: 2,
          sql_rowcount: 2,
        },
      ],
    },
  );

  const setForceQuery = jest.spyOn(exploreActions, 'setForceQuery');

  afterAll(() => {
    fetchMock.reset();
    jest.resetAllMocks();
  });

  test('render', async () => {
    const props = createResultsPaneOnDashboardProps({ sliceId: 121 });
    const { findByText } = render(<ResultsPaneOnDashboard {...props} />, {
      useRedux: true,
    });
    expect(
      await findByText('No results were returned for this query'),
    ).toBeVisible();
  });

  test('render errorMessage', async () => {
    const props = createResultsPaneOnDashboardProps({
      sliceId: 121,
      errorMessage: <p>error</p>,
    });
    const { findByText } = render(<ResultsPaneOnDashboard {...props} />, {
      useRedux: true,
    });
    expect(await findByText('Run a query to display results')).toBeVisible();
  });

  test('error response', async () => {
    const props = createResultsPaneOnDashboardProps({
      sliceId: 169,
    });
    const { findByText } = render(<ResultsPaneOnDashboard {...props} />, {
      useRedux: true,
    });
    expect(await findByText('0 rows')).toBeVisible();
    expect(await findByText('Bad Request')).toBeVisible();
  });

  test('force query, render and search', async () => {
    const props = createResultsPaneOnDashboardProps({
      sliceId: 144,
      queryForce: true,
    });
    const { queryByText, getByPlaceholderText } = render(
      <ResultsPaneOnDashboard {...props} />,
      {
        useRedux: true,
      },
    );

    await waitFor(() => {
      expect(setForceQuery).toHaveBeenCalledTimes(1);
    });
    expect(queryByText('2 rows')).toBeVisible();
    expect(queryByText('Action')).toBeVisible();
    expect(queryByText('Horror')).toBeVisible();

    userEvent.type(getByPlaceholderText('Search'), 'hor');
    await waitForElementToBeRemoved(() => queryByText('Action'));
    expect(queryByText('Horror')).toBeVisible();
    expect(queryByText('Action')).not.toBeInTheDocument();
  });

  test('multiple results pane', async () => {
    const FakeChart = () => <span>test</span>;
    const metadata = new ChartMetadata({
      name: 'test-chart',
      thumbnail: '',
      queryObjectCount: 2,
    });

    const plugin = new ChartPlugin({
      metadata,
      Chart: FakeChart,
    });
    plugin.configure({ key: 'mixed_timeseries' }).register();

    const props = createResultsPaneOnDashboardProps({
      sliceId: 196,
      vizType: 'mixed_timeseries',
    });
    const { findByText } = render(<ResultsPaneOnDashboard {...props} />, {
      useRedux: true,
    });
    expect(await findByText('Results')).toBeVisible();
    expect(await findByText('Results 2')).toBeVisible();
  });
});
