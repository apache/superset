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
import EchartsSunburstChartPlugin from '../../src/Sunburst';

describe('Sunburst - plugin metadata', () => {
  test('is a ChartPlugin subclass', () => {
    const plugin = new EchartsSunburstChartPlugin();
    expect(plugin).toBeInstanceOf(ChartPlugin);
  });

  test('has the expected name and category', () => {
    const plugin = new EchartsSunburstChartPlugin();
    const metadata = (plugin as unknown as { metadata: Record<string, unknown> })
      .metadata;
    expect(metadata.name).toBe('Sunburst Chart');
    expect(metadata.category).toBe('Part of a Whole');
  });

  test('declares cross-filter + drill behaviors', () => {
    const plugin = new EchartsSunburstChartPlugin();
    const metadata = (plugin as unknown as {
      metadata: { behaviors: string[] };
    }).metadata;
    expect(metadata.behaviors).toEqual(
      expect.arrayContaining([
        Behavior.InteractiveChart,
        Behavior.DrillToDetail,
        Behavior.DrillBy,
      ]),
    );
  });
});

describe('Sunburst - controlPanel + overrides + formDataOverrides', () => {
  test('controlPanel has the Query + Chart Options sections', () => {
    const plugin = new EchartsSunburstChartPlugin();
    const cp = (plugin as unknown as { controlPanel: Record<string, unknown> })
      .controlPanel;
    const sections = cp.controlPanelSections as Array<{ label?: string }>;
    const labels = sections.map(s => s?.label);
    expect(labels).toContain('Query');
    expect(labels).toContain('Chart Options');
  });

  test('formDataOverrides is preserved (Sunburst uses getStandardizedControls)', () => {
    const plugin = new EchartsSunburstChartPlugin();
    const cp = (plugin as unknown as {
      controlPanel: { formDataOverrides?: unknown };
    }).controlPanel;
    expect(typeof cp.formDataOverrides).toBe('function');
  });

  test('additionalControlOverrides land on controlPanel.controlOverrides', () => {
    const plugin = new EchartsSunburstChartPlugin();
    const cp = (plugin as unknown as {
      controlPanel: { controlOverrides?: Record<string, unknown> };
    }).controlPanel;
    // Sunburst sets additionalControlOverrides for at least one control;
    // simply assert the merged map is present and non-empty.
    expect(cp.controlOverrides).toBeDefined();
    expect(Object.keys(cp.controlOverrides as object).length).toBeGreaterThan(0);
  });

  test('_glyphArgs is attached', () => {
    const plugin = new EchartsSunburstChartPlugin();
    const cp = (plugin as unknown as {
      controlPanel: { _glyphArgs?: Record<string, unknown> };
    }).controlPanel;
    expect(cp._glyphArgs).toBeDefined();
  });
});

describe('Sunburst - loaders', () => {
  test('exposes chart + transformProps + buildQuery loaders', () => {
    const plugin = new EchartsSunburstChartPlugin();
    expect(
      (plugin as unknown as { loadChart?: unknown }).loadChart,
    ).toBeDefined();
    expect(
      (plugin as unknown as { loadTransformProps?: unknown }).loadTransformProps,
    ).toBeDefined();
    expect(
      (plugin as unknown as { loadBuildQuery?: unknown }).loadBuildQuery,
    ).toBeDefined();
  });
});
