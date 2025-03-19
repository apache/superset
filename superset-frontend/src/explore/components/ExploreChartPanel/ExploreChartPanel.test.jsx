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
import { isValidElement } from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from 'spec/helpers/testing-library';
import { getChartMetadataRegistry, ChartMetadata } from '@superset-ui/core';
import ChartContainer from 'src/explore/components/ExploreChartPanel';
import { setItem, LocalStorageKeys } from 'src/utils/localStorageHelpers';

const createProps = (overrides = {}) => ({
  sliceName: 'Trend Line',
  height: '500px',
  actions: {},
  can_overwrite: false,
  can_download: false,
  containerId: 'foo',
  width: '500px',
  isStarred: false,
  vizType: 'histogram',
  chart: {
    id: 1,
    latestQueryFormData: {
      viz_type: 'histogram',
      datasource: '49__table',
      slice_id: 318,
      url_params: {},
      granularity_sqla: 'time_start',
      time_range: 'No filter',
      all_columns_x: ['age'],
      adhoc_filters: [],
      row_limit: 10000,
      groupby: null,
      color_scheme: 'supersetColors',
      label_colors: {},
      link_length: '25',
      x_axis_label: 'age',
      y_axis_label: 'count',
    },
    chartStatus: 'rendered',
    queriesResponse: [{ is_cached: true }],
  },
  ...overrides,
});

describe('ChartContainer', () => {
  test('renders when vizType is line', () => {
    const props = createProps();
    expect(isValidElement(<ChartContainer {...props} />)).toBe(true);
  });

  test('renders with alert banner', async () => {
    const props = createProps({
      chartIsStale: true,
      chart: { chartStatus: 'rendered', queriesResponse: [{}] },
    });
    getChartMetadataRegistry().registerValue(
      'histogram',
      new ChartMetadata({
        name: 'fake table',
        thumbnail: '.png',
        useLegacyApi: false,
      }),
    );
    render(<ChartContainer {...props} />, { useRedux: true });
    expect(
      await screen.findByText('Your chart is not up to date'),
    ).toBeVisible();
  });

  test('doesnt render alert banner when no changes in control panel were made (chart is not stale)', async () => {
    const props = createProps({
      chartIsStale: false,
    });
    render(<ChartContainer {...props} />, { useRedux: true });
    expect(await screen.findByText(/cached/i)).toBeInTheDocument();
    expect(
      screen.queryByText('Your chart is not up to date'),
    ).not.toBeInTheDocument();
  });

  test('doesnt render alert banner when chart not created yet (no queries response)', async () => {
    const props = createProps({
      chartIsStale: true,
      chart: { queriesResponse: [] },
    });
    render(<ChartContainer {...props} />, { useRedux: true });
    expect(await screen.findByRole('timer')).toBeInTheDocument();
    expect(
      screen.queryByText('Your chart is not up to date'),
    ).not.toBeInTheDocument();
  });

  test('renders prompt to fill required controls when required control removed', async () => {
    const props = createProps({
      chartIsStale: true,
      chart: { chartStatus: 'rendered', queriesResponse: [{}] },
      errorMessage: 'error',
    });
    render(<ChartContainer {...props} />, { useRedux: true });
    expect(
      await screen.findByText('Required control values have been removed'),
    ).toBeVisible();
  });

  test('should render cached button and call expected actions', async () => {
    const setForceQuery = jest.fn();
    const postChartFormData = jest.fn();
    const updateQueryFormData = jest.fn();
    const props = createProps({
      actions: {
        setForceQuery,
        postChartFormData,
        updateQueryFormData,
      },
    });
    render(<ChartContainer {...props} />, { useRedux: true });

    const cached = await screen.findByText('Cached');
    expect(cached).toBeInTheDocument();

    userEvent.click(cached);
    expect(setForceQuery).toHaveBeenCalledTimes(1);
    expect(postChartFormData).toHaveBeenCalledTimes(1);
    expect(updateQueryFormData).toHaveBeenCalledTimes(1);
  });

  test('should hide cached button', async () => {
    const props = createProps({
      chart: {
        chartStatus: 'rendered',
        queriesResponse: [{ is_cached: false }],
      },
    });
    render(<ChartContainer {...props} />, { useRedux: true });
    expect(await screen.findByRole('timer')).toBeInTheDocument();
    expect(screen.queryByText(/cached/i)).not.toBeInTheDocument();
  });

  it('hides gutter when collapsing data panel', async () => {
    const props = createProps();
    setItem(LocalStorageKeys.IsDatapanelOpen, true);
    const { container } = render(<ChartContainer {...props} />, {
      useRedux: true,
    });
    const tabpanel = screen.getByRole('tabpanel', { name: /results/i });
    expect(await within(tabpanel).findByText(/0 rows/i)).toBeInTheDocument();

    const gutter = container.querySelector('.gutter');
    expect(gutter).toBeVisible();

    userEvent.click(screen.getByLabelText('Collapse data panel'));
    expect(await screen.findByRole('timer')).toBeInTheDocument();
    expect(gutter).not.toBeVisible();
  });
});
