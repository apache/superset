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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { VizType } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import { act } from 'react-dom/test-utils';
import ChartTable from './ChartTable';

const chartsEndpoint = 'glob:*/api/v1/chart/?*';
const chartsInfoEndpoint = 'glob:*/api/v1/chart/_info*';
const chartFavoriteStatusEndpoint = 'glob:*/api/v1/chart/favorite_status*';

const mockCharts = [...new Array(3)].map((_, i) => ({
  changed_on_utc: new Date().toISOString(),
  created_by: 'super user',
  id: i,
  slice_name: `cool chart ${i}`,
  url: 'url',
  viz_type: VizType.Bar,
  datasource_title: `ds${i}`,
  thumbnail_url: '',
}));

fetchMock.get(chartsEndpoint, {
  result: mockCharts,
});

fetchMock.get(chartsInfoEndpoint, {
  permissions: ['can_add', 'can_edit', 'can_delete'],
});

fetchMock.get(chartFavoriteStatusEndpoint, {
  result: [],
});

const mockedProps = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  user: {
    userId: '2',
  },
  mine: [],
  otherTabData: [],
  otherTabFilters: [],
  otherTabTitle: 'Other',
  showThumbnails: false,
};

const otherTabProps = {
  ...mockedProps,
  otherTabData: mockCharts,
};

const mineTabProps = {
  ...mockedProps,
  mine: mockCharts,
};

const renderOptions = {
  useRedux: true,
  useRouter: true,
};

const renderChartTable = (props: any) =>
  // Use of act here prevents an error about state updates inside tests
  act(async () => {
    render(<ChartTable {...props} />, renderOptions);
  });

test('renders with EmptyState if no data present', async () => {
  await renderChartTable(mockedProps);
  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
});

test('fetches chart favorites and renders chart cards', async () => {
  await renderChartTable(mockedProps);
  userEvent.click(screen.getByText(/favorite/i));
  await waitFor(() => {
    expect(fetchMock.calls(chartFavoriteStatusEndpoint)).toHaveLength(1);
    expect(screen.getAllByText(/cool chart/i)).toHaveLength(3);
  });
});

test('renders other tab by default', async () => {
  await renderChartTable(otherTabProps);
  expect(screen.getAllByText(/cool chart/i)).toHaveLength(3);
});

test('renders mine tab on click', async () => {
  await renderChartTable(mineTabProps);
  userEvent.click(screen.getByText(/mine/i));
  await waitFor(() => {
    expect(screen.getAllByText(/cool chart/i)).toHaveLength(3);
  });
});
