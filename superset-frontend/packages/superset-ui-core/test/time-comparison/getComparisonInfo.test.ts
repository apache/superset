/*
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

import { getComparisonInfo, ComparisonTimeRangeType } from '@superset-ui/core';

const form_data = {
  datasource: '22__table',
  viz_type: 'pop_kpi',
  slice_id: 97,
  url_params: {
    form_data_key:
      'TaBakyDiAx2VsQ47gLmlsJKeN4foqnoxUKdbQrM05qnKMRjO9PDe42iZN1oxmxZ8',
    save_action: 'overwrite',
    slice_id: '97',
  },
  metrics: ['count'],
  adhoc_filters: [
    {
      clause: 'WHERE',
      comparator: '2004-02-16 : 2024-02-16',
      datasourceWarning: false,
      expressionType: 'SIMPLE',
      filterOptionName: 'filter_8274fo9pogn_ihi8x28o7a',
      isExtra: false,
      isNew: false,
      operator: 'TEMPORAL_RANGE',
      sqlExpression: null,
      subject: 'order_date',
    } as any,
  ],
  time_comparison: 'y',
  adhoc_custom: [
    {
      clause: 'WHERE',
      comparator: 'No filter',
      expressionType: 'SIMPLE',
      operator: 'TEMPORAL_RANGE',
      subject: 'order_date',
    },
  ],
  row_limit: 10000,
  y_axis_format: 'SMART_NUMBER',
  header_font_size: 60,
  subheader_font_size: 26,
  comparison_color_enabled: true,
  extra_form_data: {},
  force: false,
  result_format: 'json',
  result_type: 'full',
};

const mockExtraFormData = {
  time_range: 'new and cool range from extra form data',
};

describe('getComparisonInfo', () => {
  it('Keeps the original adhoc_filters since no extra data was passed', () => {
    const resultFormData = getComparisonInfo(
      form_data,
      ComparisonTimeRangeType.Year,
      {},
    );
    expect(resultFormData).toEqual(form_data);
  });

  it('Updates the time_range of the adhoc_filters when extra form data is passed', () => {
    const resultFormData = getComparisonInfo(
      form_data,
      ComparisonTimeRangeType.Month,
      mockExtraFormData,
    );

    const expectedFilters = [
      {
        clause: 'WHERE',
        comparator: 'new and cool range from extra form data',
        datasourceWarning: false,
        expressionType: 'SIMPLE',
        filterOptionName: 'filter_8274fo9pogn_ihi8x28o7a',
        isExtra: false,
        isNew: false,
        operator: 'TEMPORAL_RANGE',
        sqlExpression: null,
        subject: 'order_date',
      } as any,
    ];

    expect(resultFormData.adhoc_filters?.length).toEqual(1);
    expect(resultFormData.adhoc_filters).toEqual(expectedFilters);
  });

  it('handles no time range filters', () => {
    const resultFormData = getComparisonInfo(
      {
        ...form_data,
        adhoc_filters: [
          {
            expressionType: 'SIMPLE',
            subject: 'address_line1',
            operator: 'IN',
            comparator: ['7734 Strong St.'],
            clause: 'WHERE',
            isExtra: false,
          },
        ],
      },
      ComparisonTimeRangeType.Week,
      {},
    );

    const expectedFilters = [
      {
        expressionType: 'SIMPLE',
        subject: 'address_line1',
        operator: 'IN',
        comparator: ['7734 Strong St.'],
        clause: 'WHERE',
        isExtra: false,
      },
    ];
    expect(resultFormData.adhoc_filters?.length).toEqual(1);
    expect(resultFormData.adhoc_filters?.[0]).toEqual(expectedFilters[0]);
  });

  it('If adhoc_filter is undefrined the code wont break', () => {
    const resultFormData = getComparisonInfo(
      {
        ...form_data,
        adhoc_filters: undefined,
      },
      ComparisonTimeRangeType.InheritedRange,
      {},
    );

    expect(resultFormData.adhoc_filters?.length).toEqual(0);
    expect(resultFormData.adhoc_filters).toEqual([]);
  });

  it('Handles the custom time filters and return the correct time shift text', () => {
    const resultFormData = getComparisonInfo(
      form_data,
      ComparisonTimeRangeType.Custom,
      {},
    );

    const expectedFilters = [
      {
        clause: 'WHERE',
        comparator: 'No filter',
        expressionType: 'SIMPLE',
        operator: 'TEMPORAL_RANGE',
        subject: 'order_date',
      },
    ];
    expect(resultFormData.adhoc_filters?.length).toEqual(1);
    expect(resultFormData.adhoc_filters).toEqual(expectedFilters);
  });
});
