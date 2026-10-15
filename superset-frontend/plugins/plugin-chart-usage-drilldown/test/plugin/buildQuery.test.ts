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
import buildQuery from '../../src/plugin/buildQuery';
import { DURATION_RUNS, DURATION_TOTAL } from '../../src/consts';
import { UsageDrilldownFormData } from '../../src/types';

const metric = {
  expressionType: 'SQL' as const,
  sqlExpression: 'SUM(api_calls)',
  label: 'API Calls',
};

const baseFormData: UsageDrilldownFormData = {
  datasource: '22__table',
  viz_type: 'usage_drilldown',
  groupby: ['project_name', 'workflow_name', 'api_name'],
  metric,
};

describe('UsageDrilldown buildQuery', () => {
  test('queries the deepest level, sorted by the metric', () => {
    const [query] = buildQuery(baseFormData).queries;
    expect(query.columns).toEqual([
      'project_name',
      'workflow_name',
      'api_name',
    ]);
    expect(query.metrics).toEqual([metric]);
    expect(query.orderby).toEqual([[metric, false]]);
  });

  test('adds a one-row total that ignores HAVING, so an empty result still renders the chart', () => {
    const queries = buildQuery({
      ...baseFormData,
      adhoc_filters: [
        {
          clause: 'HAVING',
          expressionType: 'SQL',
          sqlExpression: 'SUM(api_calls) > 0',
        },
      ],
    }).queries;
    expect(queries).toHaveLength(2);
    expect(queries[0].extras?.having).toContain('SUM(api_calls) > 0');
    expect(queries[1]).toMatchObject({
      columns: [],
      metrics: [metric],
      row_limit: 1,
      extras: expect.objectContaining({ having: '' }),
    });
  });

  test('adds link, badge and sub-line columns after the levels', () => {
    const [query] = buildQuery({
      ...baseFormData,
      link_column: 'workflow_url',
      badge_column: 'api_badge',
      subtitle_columns: ['system_name', 'endpoint_path'],
    }).queries;
    expect(query.columns).toEqual([
      'project_name',
      'workflow_name',
      'api_name',
      'workflow_url',
      'api_badge',
      'system_name',
      'endpoint_path',
    ]);
  });

  test('adds duration total and run count when a duration column is set', () => {
    const [query] = buildQuery({
      ...baseFormData,
      duration_column: 'duration_ms',
    }).queries;
    expect(query.metrics).toEqual([
      metric,
      expect.objectContaining({
        label: DURATION_TOTAL,
        sqlExpression: 'SUM(CASE WHEN duration_ms > 0 THEN duration_ms END)',
      }),
      expect.objectContaining({
        label: DURATION_RUNS,
        sqlExpression: 'COUNT(CASE WHEN duration_ms > 0 THEN 1 END)',
      }),
    ]);
  });
});
