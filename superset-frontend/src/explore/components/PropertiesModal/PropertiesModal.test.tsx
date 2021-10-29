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
import { Slice } from 'src/types/Chart';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import PropertiesModal from '.';

const createProps = () => ({
  slice: ({
    cache_timeout: null,
    changed_on: '2021-03-19T16:30:56.750230',
    changed_on_humanized: '7 days ago',
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
    modified: '<span class="no-wrap">7 days ago</span>',
    owners: [
      {
        text: 'Superset Admin',
        value: 1,
      },
    ],
    slice_id: 318,
    slice_name: 'Age distribution of respondents',
    slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20318%7D',
  } as unknown) as Slice,
  show: true,
  onHide: jest.fn(),
  onSave: jest.fn(),
});

fetchMock.get('http://localhost/api/v1/chart/318', {
  body: {
    description_columns: {},
    id: 318,
    label_columns: {
      cache_timeout: 'Cache Timeout',
      'dashboards.dashboard_title': 'Dashboards Dashboard Title',
      'dashboards.id': 'Dashboards Id',
      description: 'Description',
      'owners.first_name': 'Owners First Name',
      'owners.id': 'Owners Id',
      'owners.last_name': 'Owners Last Name',
      'owners.username': 'Owners Username',
      params: 'Params',
      slice_name: 'Slice Name',
      viz_type: 'Viz Type',
    },
    result: {
      cache_timeout: null,
      dashboards: [
        {
          dashboard_title: 'FCC New Coder Survey 2018',
          id: 23,
        },
      ],
      description: null,
      owners: [
        {
          first_name: 'Superset',
          id: 1,
          last_name: 'Admin',
          username: 'admin',
        },
      ],
      params:
        '{"adhoc_filters": [], "all_columns_x": ["age"], "color_scheme": "supersetColors", "datasource": "42__table", "granularity_sqla": "time_start", "groupby": null, "label_colors": {}, "link_length": "25", "queryFields": {"groupby": "groupby"}, "row_limit": 10000, "slice_id": 1380, "time_range": "No filter", "time_range_endpoints": ["inclusive", "exclusive"], "url_params": {}, "viz_type": "histogram", "x_axis_label": "age", "y_axis_label": "count"}',
      slice_name: 'Age distribution of respondents',
      viz_type: 'histogram',
    },
    show_columns: [
      'cache_timeout',
      'dashboards.dashboard_title',
      'dashboards.id',
      'description',
      'owners.first_name',
      'owners.id',
      'owners.last_name',
      'owners.username',
      'params',
      'slice_name',
      'viz_type',
    ],
    show_title: 'Show Slice',
  },
});

fetchMock.get(
  'http://localhost/api/v1/chart/related/owners?q=(filter:%27%27)',
  {
    body: {
      count: 1,
      result: [
        {
          text: 'Superset Admin',
          value: 1,
        },
      ],
    },
    sendAsJson: true,
  },
);

fetchMock.put('http://localhost/api/v1/chart/318', {
  body: {
    id: 318,
    result: {
      cache_timeout: null,
      description: null,
      owners: [],
      slice_name: 'Age distribution of respondents',
    },
  },
  sendAsJson: true,
});

afterAll(() => {
  fetchMock.resetBehavior();
});

test('Should render null when show:false', async () => {
  const props = createProps();
  props.show = false;
  render(<PropertiesModal {...props} />);

  await waitFor(() => {
    expect(
      screen.queryByRole('dialog', { name: 'Edit Chart Properties' }),
    ).not.toBeInTheDocument();
  });
});

test('Should render when show:true', async () => {
  const props = createProps();
  render(<PropertiesModal {...props} />);

  await waitFor(() => {
    expect(
      screen.getByRole('dialog', { name: 'Edit Chart Properties' }),
    ).toBeVisible();
  });
});

test('Should have modal header', async () => {
  const props = createProps();
  render(<PropertiesModal {...props} />);

  await waitFor(() => {
    expect(screen.getByText('Edit Chart Properties')).toBeVisible();
    expect(screen.getByText('×')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
  });
});

test('"Close" button should call "onHide"', async () => {
  const props = createProps();
  render(<PropertiesModal {...props} />);

  await waitFor(() => {
    expect(props.onHide).toBeCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'Close' }));

  await waitFor(() => {
    expect(props.onHide).toBeCalledTimes(1);
    expect(props.onSave).toBeCalledTimes(0);
  });
});

test('Should render all elements inside modal', async () => {
  const props = createProps();
  render(<PropertiesModal {...props} />);
  await waitFor(() => {
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Basic information' }),
    ).toBeVisible();
    expect(screen.getByText('Name')).toBeVisible();
    expect(screen.getByText('Description')).toBeVisible();

    expect(
      screen.getByRole('heading', { name: 'Configuration' }),
    ).toBeVisible();
    expect(screen.getByText('Cache timeout')).toBeVisible();

    expect(screen.getByRole('heading', { name: 'Access' })).toBeVisible();
    expect(screen.getByText('Owners')).toBeVisible();
  });
});

test('Should have modal footer', async () => {
  const props = createProps();
  render(<PropertiesModal {...props} />);

  await waitFor(() => {
    expect(screen.getByText('Cancel')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();

    expect(screen.getByText('Save')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

test('"Cancel" button should call "onHide"', async () => {
  const props = createProps();
  render(<PropertiesModal {...props} />);

  await waitFor(() => {
    expect(props.onHide).toBeCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  await waitFor(() => {
    expect(props.onHide).toBeCalledTimes(1);
    expect(props.onSave).toBeCalledTimes(0);
  });
});

test('"Save" button should call only "onSave"', async () => {
  const props = createProps();
  render(<PropertiesModal {...props} />);
  await waitFor(() => {
    expect(props.onSave).toBeCalledTimes(0);
    expect(props.onHide).toBeCalledTimes(0);

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
  userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(props.onSave).toBeCalledTimes(1);
    expect(props.onHide).toBeCalledTimes(1);
  });
});
