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
import extractQueryFields from '@superset-ui/core/src/query/extractQueryFields';
import { QueryMode } from '../../src';
import { DTTM_ALIAS } from '../../src/query/buildQueryObject';

describe('extractQueryFields', () => {
  it('should return default object', () => {
    expect(extractQueryFields({})).toEqual({
      columns: [],
      metrics: [],
    });
  });

  it('should group default metric controls to metrics', () => {
    expect(extractQueryFields({ metric: 'my_metric' }).metrics).toEqual(['my_metric']);
  });

  it('should group custom metrics with default metrics', () => {
    expect(
      extractQueryFields(
        { metric: 'metric_1', my_custom_metric: 'metric_2' },
        { my_custom_metric: 'metrics' },
      ).metrics,
    ).toEqual(['metric_1', 'metric_2']);
  });

  it('should extract columns', () => {
    expect(extractQueryFields({ columns: 'col_1' })).toEqual({
      columns: ['col_1'],
      metrics: [],
    });
  });

  it('should extract groupby', () => {
    expect(extractQueryFields({ groupby: 'col_1' })).toEqual({
      columns: ['col_1'],
      metrics: [],
    });
  });

  it('should extract custom groupby', () => {
    expect(
      extractQueryFields({ series: 'col_1', metric: 'metric_1' }, { series: 'groupby' }),
    ).toEqual({
      columns: ['col_1'],
      metrics: ['metric_1'],
    });
  });

  it('should merge custom groupby with default group', () => {
    expect(
      extractQueryFields(
        { groupby: 'col_1', series: 'col_2', metric: 'metric_1' },
        { series: 'groupby' },
      ),
    ).toEqual({
      columns: ['col_1', 'col_2'],
      metrics: ['metric_1'],
    });
  });

  it('should include time', () => {
    expect(extractQueryFields({ groupby: 'col_1', include_time: true }).columns).toEqual([
      DTTM_ALIAS,
      'col_1',
    ]);
    expect(
      extractQueryFields({ groupby: ['col_1', DTTM_ALIAS, ''], include_time: true }).columns,
    ).toEqual(['col_1', DTTM_ALIAS]);
  });

  it('should ignore null values', () => {
    expect(extractQueryFields({ series: ['a'], columns: null }).columns).toEqual(['a']);
  });

  it('should ignore groupby and metrics when in raw QueryMode', () => {
    expect(
      extractQueryFields({
        columns: ['a'],
        groupby: ['b'],
        metric: ['m'],
        query_mode: QueryMode.raw,
      }),
    ).toEqual({
      metrics: [],
      columns: ['a'],
    });
  });

  it('should ignore columns when in aggregate QueryMode', () => {
    expect(
      extractQueryFields({
        columns: ['a'],
        groupby: ['b'],
        metric: ['m'],
        query_mode: QueryMode.aggregate,
      }),
    ).toEqual({
      metrics: ['m'],
      columns: ['b'],
    });
  });
});
