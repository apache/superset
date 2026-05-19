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
import { ChartPlugin } from '@superset-ui/core';
import BigNumberPeriodOverPeriodChartPlugin from '../../src/BigNumber/BigNumberPeriodOverPeriod';

describe('BigNumberPeriodOverPeriod - plugin metadata', () => {
  test('is a ChartPlugin subclass', () => {
    const plugin = new BigNumberPeriodOverPeriodChartPlugin();
    expect(plugin).toBeInstanceOf(ChartPlugin);
  });

  test('has the expected name and category', () => {
    const plugin = new BigNumberPeriodOverPeriodChartPlugin();
    const metadata = (plugin as unknown as { metadata: Record<string, unknown> })
      .metadata;
    expect(metadata.name).toBe('Big Number with Time Period Comparison');
    expect(metadata.category).toBe('KPI');
  });

  test('has thumbnail', () => {
    const plugin = new BigNumberPeriodOverPeriodChartPlugin();
    const metadata = (plugin as unknown as {
      metadata: { thumbnail?: string };
    }).metadata;
    expect(metadata.thumbnail).toBeTruthy();
  });
});

describe('BigNumberPeriodOverPeriod - additionalSections wiring', () => {
  test('a Time Comparison section is appended to the controlPanel', () => {
    const plugin = new BigNumberPeriodOverPeriodChartPlugin();
    const cp = (plugin as unknown as { controlPanel: Record<string, unknown> })
      .controlPanel;
    const sections = cp.controlPanelSections as Array<{ label?: string }>;
    // The exact label depends on the shared timeComparisonControls() helper,
    // but at least one section should have come from additionalSections and
    // landed AFTER Chart Options.
    const chartOptsIdx = sections.findIndex(s => s?.label === 'Chart Options');
    expect(chartOptsIdx).toBeGreaterThanOrEqual(0);
    // After Chart Options, there must be at least one more section
    // (the time-comparison one).
    expect(sections.length).toBeGreaterThan(chartOptsIdx + 1);
  });

  test('the Time Comparison section has its own controlSetRows', () => {
    const plugin = new BigNumberPeriodOverPeriodChartPlugin();
    const cp = (plugin as unknown as { controlPanel: Record<string, unknown> })
      .controlPanel;
    const sections = cp.controlPanelSections as Array<{
      label?: string;
      controlSetRows?: unknown[];
    }>;
    const last = sections[sections.length - 1];
    expect(last).toBeDefined();
    expect(Array.isArray(last.controlSetRows)).toBe(true);
  });
});

describe('BigNumberPeriodOverPeriod - controlOverrides', () => {
  test('controlOverrides are present and merged into controlPanel', () => {
    const plugin = new BigNumberPeriodOverPeriodChartPlugin();
    const cp = (plugin as unknown as {
      controlPanel: { controlOverrides?: Record<string, unknown> };
    }).controlPanel;
    expect(cp.controlOverrides).toBeDefined();
  });
});

describe('BigNumberPeriodOverPeriod - loaders + _glyphArgs', () => {
  test('exposes chart + transformProps + buildQuery loaders', () => {
    const plugin = new BigNumberPeriodOverPeriodChartPlugin();
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

  test('_glyphArgs is attached for native renderer use', () => {
    const plugin = new BigNumberPeriodOverPeriodChartPlugin();
    const cp = (plugin as unknown as {
      controlPanel: { _glyphArgs?: Record<string, unknown> };
    }).controlPanel;
    expect(cp._glyphArgs).toBeDefined();
  });
});
