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

import { VizType } from '@superset-ui/core';
import { WordCloudFormData } from '../src';
import buildQuery from '../src/plugin/buildQuery';

const basicFormData: WordCloudFormData = {
  datasource: '5__table',
  granularity_sqla: 'ds',
  series: 'foo',
  viz_type: VizType.WordCloud,
};

describe('plugin-chart-word-cloud', () => {
  describe('buildQuery', () => {
    test('should build columns from series in form data', () => {
      const queryContext = buildQuery(basicFormData);
      const [query] = queryContext.queries;
      expect(query.columns).toEqual(['foo']);
    });

    test('should not include orderby when neither sort option is enabled', () => {
      const queryContext = buildQuery({
        ...basicFormData,
        metric: 'count',
        sort_by_metric: false,
        sort_by_series: false,
        row_limit: 100,
      });
      const [query] = queryContext.queries;
      expect(query.orderby).toBeUndefined();
    });

    test('should order by metric DESC only when sort_by_metric is true', () => {
      const queryContext = buildQuery({
        ...basicFormData,
        metric: 'count',
        sort_by_metric: true,
        sort_by_series: false,
        row_limit: 100,
      });
      const [query] = queryContext.queries;
      expect(query.orderby).toEqual([['count', false]]);
    });

    test('should order by series ASC only when sort_by_series is true', () => {
      const queryContext = buildQuery({
        ...basicFormData,
        metric: 'count',
        sort_by_metric: false,
        sort_by_series: true,
        row_limit: 100,
      });
      const [query] = queryContext.queries;
      expect(query.orderby).toEqual([['foo', true]]);
    });

    test('should order by metric DESC then series ASC when both are true', () => {
      const queryContext = buildQuery({
        ...basicFormData,
        metric: 'count',
        sort_by_metric: true,
        sort_by_series: true,
        row_limit: 100,
      });
      const [query] = queryContext.queries;
      expect(query.orderby).toEqual([
        ['count', false],
        ['foo', true],
      ]);
    });

    test('should order by series ASC when sort_by_series is undefined (legacy chart)', () => {
      const queryContext = buildQuery({
        ...basicFormData,
        metric: 'count',
        sort_by_metric: false,
        row_limit: 100,
      });
      const [query] = queryContext.queries;
      expect(query.orderby).toEqual([['foo', true]]);
    });
  });
});
