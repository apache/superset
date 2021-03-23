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
import { render, screen, act } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import * as chartAction from 'src/chart/chartAction';
import * as downloadAsImage from 'src/utils/downloadAsImage';
// eslint-disable-next-line import/no-named-as-default
import DisplayQueryButton from '.';

let props = {
  latestQueryFormData: {
    viz_type: 'histogram',
    datasource: '49__table',
    slice_id: 318,
    url_params: {},
    time_range_endpoints: ['inclusive', 'exclusive'],
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
      time_range_endpoints: ['inclusive', 'exclusive'],
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
};

beforeEach(() => {
  props = {
    latestQueryFormData: {
      viz_type: 'histogram',
      datasource: '49__table',
      slice_id: 318,
      url_params: {},
      time_range_endpoints: ['inclusive', 'exclusive'],
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
        time_range_endpoints: ['inclusive', 'exclusive'],
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
  };
});

test('Shoud render a button', () => {
  render(<DisplayQueryButton {...props} />, { useRedux: true });
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('Shoud open a menu', () => {
  render(<DisplayQueryButton {...props} />, {
    useRedux: true,
  });

  expect(props.onOpenInEditor).toBeCalledTimes(0);
  expect(props.onOpenPropertiesModal).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button'));
  expect(props.onOpenInEditor).toBeCalledTimes(0);
  expect(props.onOpenPropertiesModal).toBeCalledTimes(0);

  expect(
    screen.getByRole('menuitem', { name: 'Edit properties' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('menuitem', { name: 'View query' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('menuitem', { name: 'Run in SQL Lab' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('menuitem', { name: 'Download as image' }),
  ).toBeInTheDocument();
});

test('Shoud call onOpenPropertiesModal when click on "Edit properties"', () => {
  render(<DisplayQueryButton {...props} />, {
    useRedux: true,
  });
  expect(props.onOpenInEditor).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button'));
  userEvent.click(screen.getByRole('menuitem', { name: 'Edit properties' }));
  expect(props.onOpenPropertiesModal).toBeCalledTimes(1);
});

test('Shoud call getChartDataRequest when click on "View query"', async () => {
  const getChartDataRequest = jest.spyOn(chartAction, 'getChartDataRequest');
  render(<DisplayQueryButton {...props} />, {
    useRedux: true,
  });

  expect(getChartDataRequest).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button'));
  expect(getChartDataRequest).toBeCalledTimes(0);

  await act(async () => {
    const menuItem = screen.getByText('View query').parentElement;
    if (menuItem) {
      userEvent.click(menuItem);
    }
  });

  expect(getChartDataRequest).toBeCalledTimes(1);
});

test('Shoud call onOpenInEditor when click on "Run in SQL Lab"', () => {
  render(<DisplayQueryButton {...props} />, {
    useRedux: true,
  });

  expect(props.onOpenInEditor).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button'));
  expect(props.onOpenInEditor).toBeCalledTimes(0);

  userEvent.click(screen.getByRole('menuitem', { name: 'Run in SQL Lab' }));
  expect(props.onOpenInEditor).toBeCalledTimes(1);
});

test('Shoud call downloadAsImage when click on "Download as image"', () => {
  const spy = jest.spyOn(downloadAsImage, 'default');
  render(<DisplayQueryButton {...props} />, {
    useRedux: true,
  });

  expect(spy).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button'));
  expect(spy).toBeCalledTimes(0);

  userEvent.click(screen.getByRole('menuitem', { name: 'Download as image' }));

  expect(spy).toBeCalledTimes(1);
});
