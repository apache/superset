// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import buildQueryObject from '../query/buildQueryObject';
import { QueryFormData } from '../types';

describe('buildQueryObject', () => {
  const baseFormData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'table',
    time_range: 'No filter',
    metrics: ['count'],
    columns: ['name', 'category'],
    row_limit: 1000,
    order_desc: true,
  };

  it('should build a basic query object', () => {
    const queryObject = buildQueryObject(baseFormData);

    expect(queryObject).toEqual({
      time_range: 'No filter',
      since: undefined,
      until: undefined,
      granularity: undefined,
      columns: ['name', 'category'],
      metrics: ['count'],
      orderby: undefined,
      annotation_layers: [],
      row_limit: 1000,
      row_offset: undefined,
      series_columns: undefined,
      series_limit: 0,
      series_limit_metric: undefined,
      group_others_when_limit_reached: false,
      order_desc: true,
      url_params: undefined,
      custom_params: {},
      extras: {
        filters: [],
      },
      filters: [],
      custom_form_data: {},
    });
  });

  it('should handle adhoc filters', () => {
    const formDataWithFilters: QueryFormData = {
      ...baseFormData,
      adhoc_filters: [
        {
          clause: 'WHERE',
          expressionType: 'SIMPLE',
          subject: 'category',
          operator: '==',
          comparator: 'Electronics',
        },
      ],
    };

    const queryObject = buildQueryObject(formDataWithFilters);

    expect(queryObject.filters).toContainEqual({
      col: 'category',
      op: '==',
      val: 'Electronics',
    });
  });

  it('should handle SQL adhoc filters in extras', () => {
    const formDataWithSQLFilters: QueryFormData = {
      ...baseFormData,
      adhoc_filters: [
        {
          clause: 'WHERE',
          expressionType: 'SQL',
          sqlExpression: 'price > 100',
        },
      ],
    };

    const queryObject = buildQueryObject(formDataWithSQLFilters);

    expect(queryObject.extras?.where).toBe('(price > 100)');
  });

  it('should handle extra_form_data overrides', () => {
    const formDataWithExtraFormData: QueryFormData = {
      ...baseFormData,
      extra_form_data: {
        time_range: 'Last week',
        adhoc_filters: [
          {
            clause: 'WHERE',
            expressionType: 'SIMPLE',
            subject: 'status',
            operator: '==',
            comparator: 'active',
          },
        ],
      },
    };

    const queryObject = buildQueryObject(formDataWithExtraFormData);

    expect(queryObject.time_range).toBe('Last week');
    expect(queryObject.filters).toContainEqual({
      col: 'status',
      op: '==',
      val: 'active',
    });
  });

  it('should handle series_limit from limit field', () => {
    const formDataWithLimit: QueryFormData = {
      ...baseFormData,
      limit: 5,
    };

    const queryObject = buildQueryObject(formDataWithLimit);

    expect(queryObject.series_limit).toBe(5);
  });

  it('should handle granularity', () => {
    const formDataWithGranularity: QueryFormData = {
      ...baseFormData,
      granularity: 'created_at',
    };

    const queryObject = buildQueryObject(formDataWithGranularity);

    expect(queryObject.granularity).toBe('created_at');
  });
});
