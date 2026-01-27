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
import { renderHook } from '@testing-library/react-hooks';
import { useResultsPane } from './useResultsPane';
import { TimeGranularity } from '@superset-ui/core';
import { ResultsPaneProps } from '../types';
import * as chartAction from 'src/components/Chart/chartAction';
import { screen, waitFor } from '@testing-library/dom';
import { render } from '@testing-library/react';
import { ThemeProvider, supersetTheme } from '@apache-superset/core/ui';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

// Mock the Redux store
const mockStore = createStore(() => ({}));

const args: ResultsPaneProps = {
  queryFormData: {
    datasource: '2__table',
    viz_type: 'echarts_timeseries_line',
    slice_id: 346,
    url_params: {
      native_filters_key: 'QxTpEx9EJ00',
    },
    x_axis: 'ds',
    time_grain_sqla: TimeGranularity.YEAR,
    x_axis_sort_asc: true,
    metrics: ['sum__num', 'testing_count'],
    groupby: ['gender', 'state'],
    adhoc_filters: [
      {
        clause: 'WHERE',
        comparator: 'No filter',
        expressionType: 'SIMPLE',
        operator: 'TEMPORAL_RANGE',
        subject: 'ds',
      },
    ],
  },
  queryForce: false,
  isRequest: true,
  dataSize: 20,
  isVisible: true,
  canDownload: true,
};

const mockedGetChartDataResponse = {
  result: [
    {
      status: 'success',
      rowcount: 44,
      sql_rowcount: 968,
      label_map: {
        ds: ['ds'],
        'sum__num, boy, CA': ['sum__num', 'boy', 'CA'],
        'sum__num, boy, FL': ['sum__num', 'boy', 'FL'],
        'sum__num, girl, CA': ['sum__num', 'girl', 'CA'],
        'sum__num, girl, FL': ['sum__num', 'girl', 'FL'],
        'testing_count, boy, CA': ['testing_count', 'boy', 'CA'],
        'testing_count, boy, FL': ['testing_count', 'boy', 'FL'],
        'testing_count, girl, CA': ['testing_count', 'girl', 'CA'],
        'testing_count, girl, FL': ['testing_count', 'girl', 'FL'],
        gender: ['gender'],
        state: ['state'],
        sum__num: ['sum__num'],
        'Testing count': ['testing_count'],
      },
      colnames: [
        'ds',
        'sum__num, boy, CA',
        'sum__num, boy, FL',
        'sum__num, girl, CA',
        'sum__num, girl, FL',
        'testing_count, boy, CA',
        'testing_count, boy, FL',
        'testing_count, girl, CA',
        'testing_count, girl, FL',
      ],
      indexnames: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      coltypes: [2, 0, 0, 0, 0, 0, 0, 0, 0],
      data: [
        {
          ds: -157766400000,
          'sum__num, boy, CA': 110334,
          'sum__num, boy, FL': 30628,
          'sum__num, girl, CA': 81367,
          'sum__num, girl, FL': 23627,
          'testing_count, boy, CA': 65,
          'testing_count, boy, FL': 60,
          'testing_count, girl, CA': 73,
          'testing_count, girl, FL': 67,
        },
        {
          ds: -126230400000,
          'sum__num, boy, CA': 106402,
          'sum__num, boy, FL': 30233,
          'sum__num, girl, CA': 78271,
          'sum__num, girl, FL': 22929,
          'testing_count, boy, CA': 66,
          'testing_count, boy, FL': 62,
          'testing_count, girl, CA': 75,
          'testing_count, girl, FL': 67,
        },
      ],
      result_format: 'json',
      detected_currency: null,
      applied_filters: [
        {
          column: 'ds',
        },
      ],
      rejected_filters: [],
    },
  ],
};

const getChartDataRequestSpy = jest.spyOn(chartAction, 'getChartDataRequest');

describe('useResultsPane', () => {
  beforeEach(() => {
    getChartDataRequestSpy.mockClear();
  });

  it('Should format table columns and props successfully', async () => {
    getChartDataRequestSpy.mockResolvedValue({
      response: {},
      json: mockedGetChartDataResponse,
    });

    const hookResult = renderHook(() => useResultsPane(args));

    await waitFor(() => {
      expect(getChartDataRequestSpy).toHaveBeenCalledWith({
        force: false,
        formData: args.queryFormData,
        ownState: undefined,
        resultFormat: 'json',
        resultType: 'full',
      });
    });

    render(
      <Provider store={mockStore}>
        <ThemeProvider theme={supersetTheme}>
          {hookResult.result.all}
        </ThemeProvider>
      </Provider>,
    );

    expect(await screen.findAllByText('ds')).toHaveLength(2);
    expect(screen.getAllByText('sum__num, boy, CA')).toHaveLength(2);
    expect(screen.getAllByText('sum__num, boy, FL')).toHaveLength(2);
    expect(screen.getAllByText('sum__num, girl, CA')).toHaveLength(2);
    expect(screen.getAllByText('sum__num, girl, FL')).toHaveLength(2);
    expect(screen.getAllByText('Testing count, boy, CA')).toHaveLength(2);
    expect(screen.getAllByText('Testing count, boy, FL')).toHaveLength(2);
    expect(screen.getAllByText('Testing count, girl, CA')).toHaveLength(2);
    expect(screen.getAllByText('Testing count, girl, FL')).toHaveLength(2);
  });
});
