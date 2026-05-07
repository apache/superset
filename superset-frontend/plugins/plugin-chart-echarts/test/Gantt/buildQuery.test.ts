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
import { QueryFormData } from '@superset-ui/core';
import buildQuery from '../../src/Gantt/buildQuery';

describe('Gantt buildQuery', () => {
  const formData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'gantt_chart',
    start_time: 'start_time',
    end_time: 'end_time',
    y_axis: {
      label: 'Y Axis',
      sqlExpression: 'SELECT 1',
      expressionType: 'SQL',
    },
    series: 'series',
    tooltip_metrics: ['tooltip_metric'],
    tooltip_columns: ['tooltip_column'],
    order_by_cols: [
      JSON.stringify(['start_time', true]),
      JSON.stringify(['order_col', false]),
    ],
  };

  it('should build query', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.metrics).toStrictEqual(['tooltip_metric']);
    expect(query.columns).toStrictEqual([
      'start_time',
      'end_time',
      {
        label: 'Y Axis',
        sqlExpression: 'SELECT 1',
        expressionType: 'SQL',
      },
      'series',
      'tooltip_column',
      'order_col',
    ]);
    expect(query.series_columns).toStrictEqual(['series']);
    expect(query.orderby).toStrictEqual([
      ['start_time', true],
      ['order_col', false],
    ]);
  });
});
