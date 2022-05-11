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

import React from 'react';
import fetchMock from 'fetch-mock';
import sinon from 'sinon';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import * as chartAction from 'src/components/Chart/chartAction';
import * as downloadAsImage from 'src/utils/downloadAsImage';
import * as exploreUtils from 'src/explore/exploreUtils';
import ExploreAdditionalActionsMenu from '.';

const createProps = () => ({
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
  slice: {
    cache_timeout: null,
    changed_on: '2021-03-19T16:30:56.750230',
    changed_on_humanized: '3 days ago',
    datasource: 'FCC 2018 Survey',
    description: null,
    description_markeddown: '',
    edit_url: '/chart/edit/318',
    form_data: {
      adhoc_filters: [],
      all_columns_x: ['age'],
      color_scheme: 'supersetColors',
      datasource: '49__table',
      granularity_sqla: 'time_start',
      groupby: null,
      label_colors: {},
      link_length: '25',
      queryFields: { groupby: 'groupby' },
      row_limit: 10000,
      slice_id: 318,
      time_range: 'No filter',
      url_params: {},
      viz_type: 'histogram',
      x_axis_label: 'age',
      y_axis_label: 'count',
    },
    modified: '<span class="no-wrap">3 days ago</span>',
    owners: [],
    slice_id: 318,
    slice_name: 'Age distribution of respondents',
    slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20318%7D',
  },
  chartStatus: 'rendered',
  onOpenPropertiesModal: jest.fn(),
  onOpenInEditor: jest.fn(),
  canDownloadCSV: false,
  showReportSubMenu: false,
});

fetchMock.post(
  'http://api/v1/chart/data?form_data=%7B%22slice_id%22%3A318%7D',
  { body: {} },
  {
    sendAsJson: false,
  },
);

test('Should render a button', () => {
  const props = createProps();
  render(<ExploreAdditionalActionsMenu {...props} />, { useRedux: true });
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('Should open a menu', () => {
  const props = createProps();
  render(<ExploreAdditionalActionsMenu {...props} />, {
    useRedux: true,
  });

  expect(props.onOpenInEditor).toBeCalledTimes(0);
  expect(props.onOpenPropertiesModal).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button'));
  expect(props.onOpenInEditor).toBeCalledTimes(0);
  expect(props.onOpenPropertiesModal).toBeCalledTimes(0);

  expect(screen.getByText('Edit chart properties')).toBeInTheDocument();
  expect(screen.getByText('Download')).toBeInTheDocument();
  expect(screen.getByText('Share')).toBeInTheDocument();
  expect(screen.getByText('View query')).toBeInTheDocument();
  expect(screen.getByText('Run in SQL Lab')).toBeInTheDocument();

  expect(screen.queryByText('Set up an email report')).not.toBeInTheDocument();
  expect(screen.queryByText('Manage email report')).not.toBeInTheDocument();
});

test('Should open download submenu', async () => {
  const props = createProps();
  render(<ExploreAdditionalActionsMenu {...props} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByRole('button'));

  expect(screen.queryByText('Export to .CSV')).not.toBeInTheDocument();
  expect(screen.queryByText('Export to .JSON')).not.toBeInTheDocument();
  expect(screen.queryByText('Download as image')).not.toBeInTheDocument();

  expect(screen.getByText('Download')).toBeInTheDocument();
  userEvent.hover(screen.getByText('Download'));
  expect(await screen.findByText('Export to .CSV')).toBeInTheDocument();
  expect(await screen.findByText('Export to .JSON')).toBeInTheDocument();
  expect(await screen.findByText('Download as image')).toBeInTheDocument();
});

test('Should open share submenu', async () => {
  const props = createProps();
  render(<ExploreAdditionalActionsMenu {...props} />, {
    useRedux: true,
  });

  userEvent.click(screen.getByRole('button'));

  expect(
    screen.queryByText('Copy permalink to clipboard'),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Embed code')).not.toBeInTheDocument();
  expect(screen.queryByText('Share chart by email')).not.toBeInTheDocument();

  expect(screen.getByText('Share')).toBeInTheDocument();
  userEvent.hover(screen.getByText('Share'));
  expect(
    await screen.findByText('Copy permalink to clipboard'),
  ).toBeInTheDocument();
  expect(await screen.findByText('Embed code')).toBeInTheDocument();
  expect(await screen.findByText('Share chart by email')).toBeInTheDocument();
});

test('Should call onOpenPropertiesModal when click on "Edit chart properties"', () => {
  const props = createProps();
  render(<ExploreAdditionalActionsMenu {...props} />, {
    useRedux: true,
  });
  expect(props.onOpenInEditor).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button'));
  userEvent.click(
    screen.getByRole('menuitem', { name: 'Edit chart properties' }),
  );
  expect(props.onOpenPropertiesModal).toBeCalledTimes(1);
});

test('Should call getChartDataRequest when click on "View query"', async () => {
  const props = createProps();
  const getChartDataRequest = jest.spyOn(chartAction, 'getChartDataRequest');
  render(<ExploreAdditionalActionsMenu {...props} />, {
    useRedux: true,
  });

  expect(getChartDataRequest).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button'));
  expect(getChartDataRequest).toBeCalledTimes(0);

  const menuItem = screen.getByText('View query').parentElement!;
  userEvent.click(menuItem);

  await waitFor(() => expect(getChartDataRequest).toBeCalledTimes(1));
});

test('Should call onOpenInEditor when click on "Run in SQL Lab"', () => {
  const props = createProps();
  render(<ExploreAdditionalActionsMenu {...props} />, {
    useRedux: true,
  });

  expect(props.onOpenInEditor).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button'));
  expect(props.onOpenInEditor).toBeCalledTimes(0);

  userEvent.click(screen.getByRole('menuitem', { name: 'Run in SQL Lab' }));
  expect(props.onOpenInEditor).toBeCalledTimes(1);
});

describe('Download', () => {
  let spyDownloadAsImage = sinon.spy();
  let spyExportChart = sinon.spy();

  beforeEach(() => {
    spyDownloadAsImage = sinon.spy(downloadAsImage, 'default');
    spyExportChart = sinon.spy(exploreUtils, 'exportChart');
  });
  afterEach(() => {
    spyDownloadAsImage.restore();
    spyExportChart.restore();
  });
  test('Should call downloadAsImage when click on "Download as image"', async () => {
    const props = createProps();
    const spy = jest.spyOn(downloadAsImage, 'default');
    render(<ExploreAdditionalActionsMenu {...props} />, {
      useRedux: true,
    });

    expect(spy).toBeCalledTimes(0);
    userEvent.click(screen.getByRole('button'));
    expect(spy).toBeCalledTimes(0);

    userEvent.hover(screen.getByText('Download'));
    const downloadAsImageElement = await screen.findByText('Download as image');
    userEvent.click(downloadAsImageElement);

    expect(spy).toBeCalledTimes(1);
  });

  test('Should not export to CSV if canDownloadCSV=false', async () => {
    const props = createProps();
    render(<ExploreAdditionalActionsMenu {...props} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByRole('button'));
    userEvent.hover(screen.getByText('Download'));
    const exportCSVElement = await screen.findByText('Export to .CSV');
    userEvent.click(exportCSVElement);
    expect(spyExportChart.callCount).toBe(0);
    spyExportChart.restore();
  });

  test('Should export to CSV if canDownloadCSV=true', async () => {
    const props = createProps();
    props.canDownloadCSV = true;
    render(<ExploreAdditionalActionsMenu {...props} />, {
      useRedux: true,
    });

    userEvent.click(screen.getByRole('button'));
    userEvent.hover(screen.getByText('Download'));
    const exportCSVElement = await screen.findByText('Export to .CSV');
    userEvent.click(exportCSVElement);
    expect(spyExportChart.callCount).toBe(1);
    spyExportChart.restore();
  });

  test('Should export to JSON', async () => {
    const props = createProps();
    render(<ExploreAdditionalActionsMenu {...props} />, {
      useRedux: true,
    });

    userEvent.click(screen.getByRole('button'));
    userEvent.hover(screen.getByText('Download'));
    const exportJsonElement = await screen.findByText('Export to .JSON');
    userEvent.click(exportJsonElement);
    expect(spyExportChart.callCount).toBe(1);
  });

  test('Should export to pivoted CSV if canDownloadCSV=true and viz_type=pivot_table_v2', async () => {
    const props = createProps();
    props.canDownloadCSV = true;
    props.latestQueryFormData.viz_type = 'pivot_table_v2';
    render(<ExploreAdditionalActionsMenu {...props} />, {
      useRedux: true,
    });

    userEvent.click(screen.getByRole('button'));
    userEvent.hover(screen.getByText('Download'));
    const exportCSVElement = await screen.findByText('Export to pivoted .CSV');
    userEvent.click(exportCSVElement);
    expect(spyExportChart.callCount).toBe(1);
  });
});
