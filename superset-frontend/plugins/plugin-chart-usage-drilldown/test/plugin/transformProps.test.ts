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
import { ChartProps, QueryFormData } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import transformProps from '../../src/plugin/transformProps';

const metric = {
  expressionType: 'SQL' as const,
  sqlExpression: 'SUM(api_calls)',
  label: 'API Calls',
};
const data = [
  {
    project_name: 'Acorn',
    workflow_name: 'Order sync',
    api_name: 'List orders',
    'API Calls': 10,
  },
];

function props(formData: Partial<QueryFormData>, verboseMap = {}) {
  return transformProps(
    new ChartProps<QueryFormData>({
      formData: {
        datasource: '22__table',
        viz_type: 'usage_drilldown',
        groupby: ['project_name', 'workflow_name', 'api_name'],
        metric,
        ...formData,
      },
      datasource: { verboseMap },
      width: 800,
      height: 600,
      queriesData: [{ data }],
      theme: supersetTheme,
    }),
  );
}

describe('UsageDrilldown transformProps', () => {
  test('passes data and size through', () => {
    expect(props({})).toEqual(
      expect.objectContaining({ width: 800, height: 600, data }),
    );
  });

  test('uses verbose names for levels, humanized names otherwise', () => {
    const { levels } = props(
      {},
      // Superset maps a column to its own name when it has no verbose name.
      { project_name: 'Project', workflow_name: 'workflow_name' },
    );
    expect(levels).toEqual([
      { key: 'project_name', label: 'Project' },
      { key: 'workflow_name', label: 'Workflow' },
      { key: 'api_name', label: 'API' },
    ]);
  });

  test('starts at the level named by the drilldown_from URL param', () => {
    const keys = (from?: string) =>
      props({ url_params: from ? { drilldown_from: from } : {} }).levels.map(
        level => level.key,
      );
    expect(keys('workflow')).toEqual(['workflow_name', 'api_name']);
    expect(keys('api_name')).toEqual(['api_name']);
    expect(keys('unknown')).toEqual([
      'project_name',
      'workflow_name',
      'api_name',
    ]);
    expect(keys()).toEqual(['project_name', 'workflow_name', 'api_name']);
  });

  test('maps optional columns and defaults', () => {
    expect(
      props({
        link_column: 'workflow_url',
        badge_column: 'api_badge',
        subtitle_columns: ['system_name', 'endpoint_path'],
        duration_column: 'duration_ms',
      }),
    ).toEqual(
      expect.objectContaining({
        metricKey: 'API Calls',
        linkKey: 'workflow_url',
        badgeKey: 'api_badge',
        subtitleKeys: ['system_name', 'endpoint_path'],
        hasDuration: true,
        titlePrefix: 'Usage by',
      }),
    );
  });

  test('has no optional columns by default', () => {
    expect(props({})).toEqual(
      expect.objectContaining({
        linkKey: undefined,
        badgeKey: undefined,
        subtitleKeys: [],
        hasDuration: false,
      }),
    );
  });
});
