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
import { configure, QueryMode } from '@superset-ui/core';
import extractQueryFields from '../../src/query/extractQueryFields';
import { NUM_METRIC } from '../fixtures';

configure();

describe('extractQueryFields', () => {
  it('should return default object', () => {
    expect(extractQueryFields({})).toEqual({
      columns: [],
      metrics: [],
      orderby: undefined,
    });
  });

  it('should group single value to arrays', () => {
    expect(
      extractQueryFields({
        metric: 'my_metric',
        columns: 'abc',
        orderby: '["ccc",true]',
      }),
    ).toEqual({
      metrics: ['my_metric'],
      columns: ['abc'],
      orderby: [['ccc', true]],
    });
  });

  it('should combine field aliases', () => {
    expect(
      extractQueryFields(
        {
          metric: 'metric_1',
          metric_2: 'metric_2',
          my_custom_metric: 'my_custom_metric',
        },
        { my_custom_metric: 'metrics' },
      ).metrics,
    ).toEqual(['metric_1', 'metric_2', 'my_custom_metric']);
  });

  it('should extract columns', () => {
    expect(extractQueryFields({ columns: 'col_1' })).toEqual({
      columns: ['col_1'],
      metrics: [],
      orderby: undefined,
    });
  });

  it('should extract groupby as columns and set empty metrics', () => {
    expect(extractQueryFields({ groupby: 'col_1' })).toEqual({
      columns: ['col_1'],
      metrics: [],
      orderby: undefined,
    });
  });

  it('should remove duplicate metrics', () => {
    expect(
      extractQueryFields({
        metrics: ['col_1', { ...NUM_METRIC }, { ...NUM_METRIC }],
      }),
    ).toEqual({
      columns: [],
      metrics: ['col_1', NUM_METRIC],
      orderby: undefined,
    });
  });

  it('should extract custom columns fields', () => {
    expect(
      extractQueryFields(
        { series: 'col_1', metric: 'metric_1' },
        { series: 'groupby' },
      ),
    ).toEqual({
      columns: ['col_1'],
      metrics: ['metric_1'],
      orderby: undefined,
    });
  });

  it('should merge custom groupby into columns', () => {
    expect(
      extractQueryFields(
        { groupby: 'col_1', series: 'col_2', metric: 'metric_1' },
        { series: 'groupby' },
      ),
    ).toEqual({
      columns: ['col_1', 'col_2'],
      metrics: ['metric_1'],
      orderby: undefined,
    });
  });

  it('should ignore null values', () => {
    expect(
      extractQueryFields({ series: ['a'], columns: null }).columns,
    ).toEqual(['a']);
  });

  it('should ignore groupby and metrics when in raw QueryMode', () => {
    expect(
      extractQueryFields({
        columns: ['a'],
        groupby: ['b'],
        metric: ['m'],
        query_mode: QueryMode.Raw,
      }),
    ).toEqual({
      columns: ['a'],
      metrics: undefined,
      orderby: undefined,
    });
  });

  it('should ignore columns when in aggregate QueryMode', () => {
    expect(
      extractQueryFields({
        columns: ['a'],
        groupby: [],
        metric: ['m'],
        query_mode: QueryMode.Aggregate,
      }),
    ).toEqual({
      metrics: ['m'],
      columns: [],
      orderby: undefined,
    });
    expect(
      extractQueryFields({
        columns: ['a'],
        groupby: ['b'],
        metric: ['m'],
        query_mode: QueryMode.Aggregate,
      }),
    ).toEqual({
      metrics: ['m'],
      columns: ['b'],
      orderby: undefined,
    });
  });

  it('should parse orderby if needed', () => {
    expect(
      extractQueryFields({
        columns: ['a'],
        order_by_cols: ['["foo",false]', '["bar",true]'],
        orderby: [['abc', true]],
      }),
    ).toEqual({
      columns: ['a'],
      metrics: [],
      orderby: [
        ['foo', false],
        ['bar', true],
        ['abc', true],
      ],
    });
  });

  it('should throw error if parse orderby failed', () => {
    expect(() => {
      extractQueryFields({
        orderby: ['ccc'],
      });
    }).toThrow('invalid orderby');
  });
});
