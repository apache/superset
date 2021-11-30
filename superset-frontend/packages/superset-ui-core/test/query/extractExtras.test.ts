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
import extractExtras from '@superset-ui/core/src/query/extractExtras';

describe('extractExtras', () => {
  const baseQueryFormData = {
    datasource: '1__table',
    granularity_sqla: 'ds',
    time_grain_sqla: 'PT1M',
    viz_type: 'my_viz',
  };

  it('should populate time range endpoints and override formData with double underscored date options', () => {
    expect(
      extractExtras({
        ...baseQueryFormData,
        time_range_endpoints: ['inclusive', 'exclusive'],
        extra_filters: [
          {
            col: '__time_col',
            op: '==',
            val: 'ds2',
          },
          {
            col: '__time_grain',
            op: '==',
            val: 'PT5M',
          },
          {
            col: '__time_range',
            op: '==',
            val: '2009-07-17T00:00:00 : 2020-07-17T00:00:00',
          },
        ],
      }),
    ).toEqual({
      applied_time_extras: {
        __time_col: 'ds2',
        __time_grain: 'PT5M',
        __time_range: '2009-07-17T00:00:00 : 2020-07-17T00:00:00',
      },
      extras: {
        time_grain_sqla: 'PT5M',
        time_range_endpoints: ['inclusive', 'exclusive'],
      },
      filters: [],
      granularity: 'ds2',
      time_range: '2009-07-17T00:00:00 : 2020-07-17T00:00:00',
    });
  });

  it('should create regular filters from non-reserved columns', () => {
    expect(
      extractExtras({
        ...baseQueryFormData,
        extra_filters: [
          {
            col: 'gender',
            op: '==',
            val: 'girl',
          },
          {
            col: 'name',
            op: 'IN',
            val: ['Eve', 'Evelyn'],
          },
        ],
      }),
    ).toEqual({
      applied_time_extras: {},
      extras: {
        time_grain_sqla: 'PT1M',
      },
      filters: [
        {
          col: 'gender',
          op: '==',
          val: 'girl',
        },
        {
          col: 'name',
          op: 'IN',
          val: ['Eve', 'Evelyn'],
        },
      ],
      granularity: 'ds',
    });
  });

  it('should create regular filters from reserved and non-reserved columns', () => {
    expect(
      extractExtras({
        ...baseQueryFormData,
        time_range_endpoints: ['inclusive', 'exclusive'],
        extra_filters: [
          {
            col: 'gender',
            op: '==',
            val: 'girl',
          },
          {
            col: '__time_col',
            op: '==',
            val: 'ds2',
          },
          {
            col: '__time_grain',
            op: '==',
            val: 'PT5M',
          },
          {
            col: '__time_range',
            op: '==',
            val: '2009-07-17T00:00:00 : 2020-07-17T00:00:00',
          },
        ],
      }),
    ).toEqual({
      applied_time_extras: {
        __time_col: 'ds2',
        __time_grain: 'PT5M',
        __time_range: '2009-07-17T00:00:00 : 2020-07-17T00:00:00',
      },
      extras: {
        time_grain_sqla: 'PT5M',
        time_range_endpoints: ['inclusive', 'exclusive'],
      },
      filters: [
        {
          col: 'gender',
          op: '==',
          val: 'girl',
        },
      ],
      granularity: 'ds2',
      time_range: '2009-07-17T00:00:00 : 2020-07-17T00:00:00',
    });
  });
});
