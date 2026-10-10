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
import { TimeGranularity } from '@superset-ui/core';
import extractExtras from '../../src/query/extractExtras';

describe('extractExtras', () => {
  const baseQueryFormData = {
    datasource: '1__table',
    granularity_sqla: 'ds',
    time_grain_sqla: TimeGranularity.MINUTE,
    viz_type: 'my_viz',
  };

  test('should populate time range endpoints and override formData with double underscored date options', () => {
    expect(
      extractExtras({
        ...baseQueryFormData,
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
      },
      filters: [],
      granularity: 'ds2',
      time_range: '2009-07-17T00:00:00 : 2020-07-17T00:00:00',
    });
  });

  test('should create regular filters from non-reserved columns', () => {
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

  test('should create regular filters from reserved and non-reserved columns', () => {
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

test('requires selection provenance even when a historical title equals a member ID', () => {
  const form = {
    datasource: '7__semantic_view',
    viz_type: 'table',
    metrics: ['Orders.b'],
  };
  expect(extractExtras(form).extras.semantic_selection_version).toBeUndefined();
  expect(
    extractExtras({ ...form, semantic_selection_version: 'cube-member-id-v1' })
      .extras.semantic_selection_version,
  ).toBe('cube-member-id-v1');
});

test('a chart version cannot certify a stale or foreign external filter', () => {
  const form = {
    datasource: '7__semantic_view',
    viz_type: 'table',
    semantic_selection_version: 'cube-member-id-v1',
  };
  const filter = { col: 'Orders.b', op: 'IN' as const, val: ['x'] };
  expect(
    extractExtras({ ...form, extra_form_data: { filters: [filter] } }).extras
      .semantic_selection_version,
  ).toBe('unverified-external-selections');
  expect(
    extractExtras({
      ...form,
      extra_form_data: {
        filters: [filter],
        semantic_selection_sources: [
          { datasource: '7__semantic_view', version: 'cube-member-id-v1' },
        ],
      },
    }).extras.semantic_selection_version,
  ).toBe('cube-member-id-v1');
  expect(
    extractExtras({
      ...form,
      extra_form_data: {
        filters: [filter],
        semantic_selection_sources: [
          { datasource: '8__semantic_view', version: 'cube-member-id-v1' },
        ],
      },
    }).extras.semantic_selection_version,
  ).toBe('unverified-external-selections');
});

test.each(['__time_col', '__granularity', 'Orders.status'])(
  'legacy external member %s cannot borrow the chart generation',
  col => {
    expect(
      extractExtras({
        datasource: '7__semantic_view',
        viz_type: 'table',
        semantic_selection_version: 'cube-member-id-v1',
        extra_filters: [{ col, op: 'IN', val: ['Orders.created'] }],
      }).extras.semantic_selection_version,
    ).toBe('unverified-external-selections');
  },
);
