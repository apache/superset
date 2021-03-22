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

import userEvent from '@testing-library/user-event';
import React from 'react';
import { render, screen, act } from 'spec/helpers/testing-library';
import { DataTablesPane } from '.';

let defaultProps = {
  queryFormData: {
    viz_type: 'heatmap',
    datasource: '34__table',
    slice_id: 456,
    url_params: {},
    time_range_endpoints: ['unknown', 'inclusive'],
    time_range: 'Last week',
    all_columns_x: 'source',
    all_columns_y: 'target',
    metric: 'sum__value',
    adhoc_filters: [],
    row_limit: 10000,
    linear_color_scheme: 'blue_white_yellow',
    xscale_interval: null,
    yscale_interval: null,
    canvas_image_rendering: 'pixelated',
    normalize_across: 'heatmap',
    left_margin: 'auto',
    bottom_margin: 'auto',
    y_axis_bounds: [null, null],
    y_axis_format: 'SMART_NUMBER',
    show_perc: true,
    sort_x_axis: 'alpha_asc',
    sort_y_axis: 'alpha_asc',
    extra_form_data: {
      custom_form_data: {},
      override_form_data: {},
      append_form_data: {},
    },
  },
  tableSectionHeight: 156.9,
  chartStatus: 'loading', // "success", "rendered"
  onCollapseChange: jest.fn(),
};

beforeEach(() => {
  defaultProps = {
    queryFormData: {
      viz_type: 'heatmap',
      datasource: '34__table',
      slice_id: 456,
      url_params: {},
      time_range_endpoints: ['unknown', 'inclusive'],
      time_range: 'Last week',
      all_columns_x: 'source',
      all_columns_y: 'target',
      metric: 'sum__value',
      adhoc_filters: [],
      row_limit: 10000,
      linear_color_scheme: 'blue_white_yellow',
      xscale_interval: null,
      yscale_interval: null,
      canvas_image_rendering: 'pixelated',
      normalize_across: 'heatmap',
      left_margin: 'auto',
      bottom_margin: 'auto',
      y_axis_bounds: [null, null],
      y_axis_format: 'SMART_NUMBER',
      show_perc: true,
      sort_x_axis: 'alpha_asc',
      sort_y_axis: 'alpha_asc',
      extra_form_data: {
        custom_form_data: {},
        override_form_data: {},
        append_form_data: {},
      },
    },
    tableSectionHeight: 156.9,
    chartStatus: 'rendered',
    onCollapseChange: jest.fn(),
  };
});

test('Rendering DataTablesPane correctly', () => {
  render(<DataTablesPane {...defaultProps} />, { useRedux: true });
  expect(screen.getByTestId('DataTablesPane')).toBeVisible();
  expect(screen.getByRole('tablist')).toBeVisible();
  expect(screen.getByRole('tab', { name: 'right Data' })).toBeVisible();
  expect(screen.getByRole('img', { name: 'right' })).toBeVisible();
});

test('Shoud show tabs', async () => {
  render(<DataTablesPane {...defaultProps} />, { useRedux: true });
  expect(screen.queryByText('View results')).not.toBeInTheDocument();
  expect(screen.queryByText('View samples')).not.toBeInTheDocument();
  userEvent.click(await screen.findByText('Data'));
  expect(screen.queryByText('View results')).toBeVisible();
  expect(screen.queryByText('View samples')).toBeVisible();
});

test('Shoud show tabs: View results', async () => {
  render(<DataTablesPane {...defaultProps} />, {
    useRedux: true,
  });
  userEvent.click(await screen.findByText('Data'));
  userEvent.click(await screen.findByText('View results'));
  expect(screen.queryByText('0 rows retrieved')).toBeVisible();
});

test('Shoud show tabs: View samples', async () => {
  render(<DataTablesPane {...defaultProps} />, {
    useRedux: true,
  });
  userEvent.click(await screen.findByText('Data'));
  expect(screen.queryByText('0 rows retrieved')).not.toBeInTheDocument();
  await act(async () => {
    userEvent.click(await screen.findByText('View samples'));
  });
  expect(screen.queryByText('0 rows retrieved')).toBeVisible();
});
