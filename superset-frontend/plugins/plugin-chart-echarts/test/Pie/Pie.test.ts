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
import { Behavior, ChartPlugin } from '@superset-ui/core';
import EchartsPieChartPlugin, {
  buildQuery,
} from '../../src/Pie';

describe('Pie chart - plugin metadata', () => {
  test('is a ChartPlugin subclass', () => {
    const plugin = new EchartsPieChartPlugin();
    expect(plugin).toBeInstanceOf(ChartPlugin);
  });

  test('exposes the expected metadata', () => {
    const plugin = new EchartsPieChartPlugin();
    const metadata = (plugin as unknown as { metadata: Record<string, unknown> })
      .metadata;
    expect(metadata.name).toBe('Pie Chart');
    expect(metadata.category).toBe('Part of a Whole');
    expect(metadata.tags).toEqual(
      expect.arrayContaining(['Categorical', 'Featured', 'Proportional']),
    );
  });

  test('declares the expected behaviors (InteractiveChart, DrillBy, DrillToDetail)', () => {
    const plugin = new EchartsPieChartPlugin();
    const metadata = (plugin as unknown as { metadata: { behaviors: string[] } })
      .metadata;
    expect(metadata.behaviors).toEqual(
      expect.arrayContaining([
        Behavior.InteractiveChart,
        Behavior.DrillToDetail,
        Behavior.DrillBy,
      ]),
    );
  });
});

describe('Pie chart - controlPanel auto-generation', () => {
  test('controlPanel has Query and Chart Options sections', () => {
    const plugin = new EchartsPieChartPlugin();
    const cp = (plugin as unknown as { controlPanel: Record<string, unknown> })
      .controlPanel;
    const sections = cp.controlPanelSections as Array<{ label?: string }>;
    const labels = sections.map(s => s?.label);
    expect(labels).toContain('Query');
    expect(labels).toContain('Chart Options');
  });

  test('_glyphArgs is attached for native renderer use', () => {
    const plugin = new EchartsPieChartPlugin();
    const cp = (plugin as unknown as { controlPanel: Record<string, unknown> })
      .controlPanel;
    expect(cp._glyphArgs).toBeDefined();
    expect(typeof cp._glyphArgs).toBe('object');
  });
});

describe('Pie chart - buildQuery', () => {
  test('adds a contribution post-processing operation', () => {
    const formData = {
      datasource: '1__table',
      viz_type: 'pie',
      metric: 'count',
      groupby: ['name'],
    };
    const result = buildQuery(formData as never);
    const [query] = result.queries;
    expect(query.post_processing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'contribution',
        }),
      ]),
    );
  });

  test('adds orderby when sort_by_metric is set', () => {
    const formData = {
      datasource: '1__table',
      viz_type: 'pie',
      metric: 'count',
      groupby: ['name'],
      sort_by_metric: true,
    };
    const result = buildQuery(formData as never);
    const [query] = result.queries;
    expect(query.orderby).toEqual([['count', false]]);
  });

  test('omits orderby when sort_by_metric is not set', () => {
    const formData = {
      datasource: '1__table',
      viz_type: 'pie',
      metric: 'count',
      groupby: ['name'],
    };
    const result = buildQuery(formData as never);
    const [query] = result.queries;
    expect(query.orderby).toBeUndefined();
  });
});

describe('Pie chart - loaders', () => {
  test('exposes a loadChart loader', () => {
    const plugin = new EchartsPieChartPlugin();
    expect(
      (plugin as unknown as { loadChart?: unknown }).loadChart,
    ).toBeDefined();
  });

  test('exposes a loadTransformProps loader', () => {
    const plugin = new EchartsPieChartPlugin();
    expect(
      (plugin as unknown as { loadTransformProps?: unknown }).loadTransformProps,
    ).toBeDefined();
  });

  test('exposes a loadBuildQuery loader', () => {
    const plugin = new EchartsPieChartPlugin();
    expect(
      (plugin as unknown as { loadBuildQuery?: unknown }).loadBuildQuery,
    ).toBeDefined();
  });
});
