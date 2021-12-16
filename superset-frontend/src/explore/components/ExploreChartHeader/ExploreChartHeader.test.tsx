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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import ExploreHeader from '.';

const createProps = () => ({
  chart: {
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
    chartStatus: 'rendered',
  },
  slice: {
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
  } as unknown as Slice,
  slice_name: 'Age distribution of respondents',
  actions: {
    postChartFormData: () => null,
    updateChartTitle: () => null,
    fetchFaveStar: () => null,
    saveFaveStar: () => null,
  },
  user: {
    userId: 1,
  },
});

test('Cancelling changes to the properties should reset previous properties', () => {
  const props = createProps();
  render(<ExploreHeader {...props} />, { useRedux: true });

  const openModal = screen.getByRole('button', {
    name: 'Edit chart properties',
  });
  const newChartName = 'New chart name';
  const prevChartName = props.slice_name;

  userEvent.click(openModal);

  const nameInput = screen.getByRole('textbox', { name: 'Name' });

  userEvent.clear(nameInput);
  userEvent.type(nameInput, newChartName);

  expect(screen.getByDisplayValue(newChartName)).toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  userEvent.click(openModal);

  expect(screen.getByDisplayValue(prevChartName)).toBeInTheDocument();
});
