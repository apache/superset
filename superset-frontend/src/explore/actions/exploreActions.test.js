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
/* eslint-disable no-unused-expressions */
import { defaultState } from 'src/explore/store';
import exploreReducer from 'src/explore/reducers/exploreReducer';
import * as actions from 'src/explore/actions/exploreActions';

const METRICS = [
  {
    expressionType: 'SIMPLE',
    column: {
      advanced_data_type: null,
      certification_details: null,
      certified_by: null,
      column_name: 'a',
      description: null,
      expression: null,
      filterable: true,
      groupby: true,
      id: 1,
      is_certified: false,
      is_dttm: false,
      python_date_format: null,
      type: 'DOUBLE PRECISION',
      type_generic: 0,
      verbose_name: null,
      warning_markdown: null,
    },
    aggregate: 'SUM',
    sqlExpression: null,
    datasourceWarning: false,
    hasCustomLabel: false,
    label: 'SUM(a)',
    optionName: 'metric_1a2b3c4d5f_1a2b3c4d5f',
  },
  {
    expressionType: 'SIMPLE',
    column: {
      advanced_data_type: null,
      certification_details: null,
      certified_by: null,
      column_name: 'b',
      description: null,
      expression: null,
      filterable: true,
      groupby: true,
      id: 2,
      is_certified: false,
      is_dttm: false,
      python_date_format: null,
      type: 'BIGINT',
      type_generic: 0,
      verbose_name: null,
      warning_markdown: null,
    },
    aggregate: 'AVG',
    sqlExpression: null,
    datasourceWarning: false,
    hasCustomLabel: false,
    label: 'AVG(b)',
    optionName: 'metric_6g7h8i9j0k_6g7h8i9j0k',
  },
];

describe('reducers', () => {
  it('Does not set a control value if control does not exist', () => {
    const newState = exploreReducer(
      defaultState,
      actions.setControlValue('NEW_FIELD', 'x', []),
    );
    expect(newState.controls.NEW_FIELD).toBeUndefined();
  });
  it('setControlValue works as expected with a Select control', () => {
    const newState = exploreReducer(
      defaultState,
      actions.setControlValue('y_axis_format', '$,.2f', []),
    );
    expect(newState.controls.y_axis_format.value).toBe('$,.2f');
    expect(newState.form_data.y_axis_format).toBe('$,.2f');
  });
  it('Keeps the column config when metric column positions are swapped', () => {
    const mockedState = {
      ...defaultState,
      controls: {
        ...defaultState.controls,
        metrics: {
          ...defaultState.controls.metrics,
          value: METRICS,
        },
        column_config: {
          ...defaultState.controls.column_config,
          value: {
            'AVG(b)': {
              currencyFormat: {
                symbolPosition: 'prefix',
                symbol: 'USD',
              },
            },
          },
        },
      },
      form_data: {
        ...defaultState.form_data,
        metrics: METRICS,
        column_config: {
          'AVG(b)': {
            currencyFormat: {
              symbolPosition: 'prefix',
              symbol: 'USD',
            },
          },
        },
      },
    };

    const swappedMetrics = [METRICS[1], METRICS[0]];
    const newState = exploreReducer(
      mockedState,
      actions.setControlValue('metrics', swappedMetrics, []),
    );

    const expectedColumnConfig = {
      'AVG(b)': {
        currencyFormat: {
          symbolPosition: 'prefix',
          symbol: 'USD',
        },
      },
    };

    expect(newState.controls.metrics.value).toStrictEqual(swappedMetrics);
    expect(newState.form_data.metrics).toStrictEqual(swappedMetrics);
    expect(newState.controls.column_config.value).toStrictEqual(
      expectedColumnConfig,
    );
    expect(newState.form_data.column_config).toStrictEqual(
      expectedColumnConfig,
    );
  });

  it('Keeps the column config when metric column name is updated', () => {
    const mockedState = {
      ...defaultState,
      controls: {
        ...defaultState.controls,
        metrics: {
          ...defaultState.controls.metrics,
          value: METRICS,
        },
        column_config: {
          ...defaultState.controls.column_config,
          value: {
            'AVG(b)': {
              currencyFormat: {
                symbolPosition: 'prefix',
                symbol: 'USD',
              },
            },
          },
        },
      },
      form_data: {
        ...defaultState.form_data,
        metrics: METRICS,
        column_config: {
          'AVG(b)': {
            currencyFormat: {
              symbolPosition: 'prefix',
              symbol: 'USD',
            },
          },
        },
      },
    };

    const updatedMetrics = [
      METRICS[0],
      {
        ...METRICS[1],
        hasCustomLabel: true,
        label: 'AVG of b',
      },
    ];

    const newState = exploreReducer(
      mockedState,
      actions.setControlValue('metrics', updatedMetrics, []),
    );

    const expectedColumnConfig = {
      'AVG of b': {
        currencyFormat: {
          symbolPosition: 'prefix',
          symbol: 'USD',
        },
      },
    };
    expect(newState.controls.metrics.value).toStrictEqual(updatedMetrics);
    expect(newState.form_data.metrics).toStrictEqual(updatedMetrics);
    expect(newState.form_data.column_config).toStrictEqual(
      expectedColumnConfig,
    );
  });
});
