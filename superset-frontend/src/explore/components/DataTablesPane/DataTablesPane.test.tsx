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
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import * as copyUtils from 'src/utils/copy';
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from 'spec/helpers/testing-library';
import { DataTablesPane } from '.';

const createProps = () => ({
  queryFormData: {
    viz_type: 'heatmap',
    datasource: '34__table',
    slice_id: 456,
    url_params: {},
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
    extra_form_data: {},
  },
  queryForce: false,
  chartStatus: 'rendered',
  onCollapseChange: jest.fn(),
  queriesResponse: [
    {
      colnames: [],
    },
  ],
});

describe('DataTablesPane', () => {
  // Collapsed/expanded state depends on local storage
  // We need to clear it manually - otherwise initial state would depend on the order of tests
  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(() => {
    localStorage.clear();
  });

  test('Rendering DataTablesPane correctly', () => {
    const props = createProps();
    render(<DataTablesPane {...props} />, { useRedux: true });
    expect(screen.getByText('Results')).toBeVisible();
    expect(screen.getByText('Samples')).toBeVisible();
    expect(screen.getByLabelText('Expand data panel')).toBeVisible();
  });

  test('Collapse/Expand buttons', async () => {
    const props = createProps();
    render(<DataTablesPane {...props} />, {
      useRedux: true,
    });
    expect(
      screen.queryByLabelText('Collapse data panel'),
    ).not.toBeInTheDocument();
    userEvent.click(screen.getByLabelText('Expand data panel'));
    expect(await screen.findByLabelText('Collapse data panel')).toBeVisible();
    expect(
      screen.queryByLabelText('Expand data panel'),
    ).not.toBeInTheDocument();
  });

  test('Should show tabs: View results', async () => {
    const props = createProps();
    render(<DataTablesPane {...props} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByText('Results'));
    expect(await screen.findByText('0 rows')).toBeVisible();
    expect(await screen.findByLabelText('Collapse data panel')).toBeVisible();
    localStorage.clear();
  });

  test('Should show tabs: View samples', async () => {
    const props = createProps();
    render(<DataTablesPane {...props} />, {
      useRedux: true,
    });
    userEvent.click(screen.getByText('Samples'));
    expect(await screen.findByText('0 rows')).toBeVisible();
    expect(await screen.findByLabelText('Collapse data panel')).toBeVisible();
  });

  test('Should copy data table content correctly', async () => {
    fetchMock.post(
      'glob:*/api/v1/chart/data?form_data=%7B%22slice_id%22%3A456%7D',
      {
        result: [
          {
            data: [{ __timestamp: 1230768000000, genre: 'Action' }],
            colnames: ['__timestamp', 'genre'],
            coltypes: [2, 1],
          },
        ],
      },
    );
    const copyToClipboardSpy = jest.spyOn(copyUtils, 'default');
    const props = createProps();
    render(
      <DataTablesPane
        {...{
          ...props,
          chartStatus: 'success',
          queriesResponse: [
            {
              colnames: ['__timestamp', 'genre'],
              coltypes: [2, 1],
            },
          ],
        }}
      />,
      {
        useRedux: true,
        initialState: {
          explore: {
            originalFormattedTimeColumns: {
              '34__table': ['__timestamp'],
            },
          },
        },
      },
    );
    userEvent.click(screen.getByText('Results'));
    expect(await screen.findByText('1 row')).toBeVisible();

    userEvent.click(screen.getByLabelText('Copy'));
    expect(copyToClipboardSpy).toHaveBeenCalledWith(
      '2009-01-01 00:00:00\tAction\n',
    );
    copyToClipboardSpy.mockRestore();
    fetchMock.restore();
  });

  test('Search table', async () => {
    fetchMock.post(
      'glob:*/api/v1/chart/data?form_data=%7B%22slice_id%22%3A456%7D',
      {
        result: [
          {
            data: [
              { __timestamp: 1230768000000, genre: 'Action' },
              { __timestamp: 1230768000010, genre: 'Horror' },
            ],
            colnames: ['__timestamp', 'genre'],
            coltypes: [2, 1],
          },
        ],
      },
    );
    const props = createProps();
    render(
      <DataTablesPane
        {...{
          ...props,
          chartStatus: 'success',
          queriesResponse: [
            {
              colnames: ['__timestamp', 'genre'],
              coltypes: [2, 1],
            },
          ],
        }}
      />,
      {
        useRedux: true,
        initialState: {
          explore: {
            originalFormattedTimeColumns: {
              '34__table': ['__timestamp'],
            },
          },
        },
      },
    );
    userEvent.click(screen.getByText('Results'));
    expect(await screen.findByText('2 rows')).toBeVisible();
    expect(screen.getByText('Action')).toBeVisible();
    expect(screen.getByText('Horror')).toBeVisible();

    userEvent.type(screen.getByPlaceholderText('Search'), 'hor');

    await waitForElementToBeRemoved(() => screen.queryByText('Action'));
    expect(screen.getByText('Horror')).toBeVisible();
    expect(screen.queryByText('Action')).not.toBeInTheDocument();
    fetchMock.restore();
  });
});
