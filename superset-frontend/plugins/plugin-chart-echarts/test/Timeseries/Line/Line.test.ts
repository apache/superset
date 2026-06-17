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
import { AnnotationType, Behavior, ChartPlugin } from '@superset-ui/core';
import EchartsTimeseriesLineChartPlugin from '../../../src/Timeseries/Line';

describe('Timeseries Line - plugin metadata', () => {
  test('is a ChartPlugin subclass', () => {
    const plugin = new EchartsTimeseriesLineChartPlugin();
    expect(plugin).toBeInstanceOf(ChartPlugin);
  });

  test('has the expected name and category', () => {
    const plugin = new EchartsTimeseriesLineChartPlugin();
    const metadata = (plugin as unknown as { metadata: Record<string, unknown> })
      .metadata;
    expect(metadata.name).toBe('Line Chart');
    expect(metadata.category).toBe('Evolution');
  });

  test('declares cross-filter behaviors', () => {
    const plugin = new EchartsTimeseriesLineChartPlugin();
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

  test('declares supportedAnnotationTypes (Event, Formula, Interval, Timeseries)', () => {
    const plugin = new EchartsTimeseriesLineChartPlugin();
    const metadata = (plugin as unknown as {
      metadata: { supportedAnnotationTypes: string[] };
    }).metadata;
    expect(metadata.supportedAnnotationTypes).toEqual(
      expect.arrayContaining([
        AnnotationType.Event,
        AnnotationType.Formula,
        AnnotationType.Interval,
        AnnotationType.Timeseries,
      ]),
    );
  });

  test('has thumbnails and an example gallery', () => {
    const plugin = new EchartsTimeseriesLineChartPlugin();
    const metadata = (plugin as unknown as {
      metadata: { thumbnail?: string; exampleGallery?: unknown[] };
    }).metadata;
    expect(metadata.thumbnail).toBeTruthy();
    expect(metadata.exampleGallery?.length).toBeGreaterThan(0);
  });
});

describe('Timeseries Line - controlPanel + additionalControls', () => {
  test('controlPanel has the Query section auto-generated', () => {
    const plugin = new EchartsTimeseriesLineChartPlugin();
    const cp = (plugin as unknown as { controlPanel: Record<string, unknown> })
      .controlPanel;
    const sections = cp.controlPanelSections as Array<{ label?: string }>;
    expect(sections.some(s => s?.label === 'Query')).toBe(true);
  });

  test('formDataOverrides is present (ExtraControls/standardize pattern)', () => {
    const plugin = new EchartsTimeseriesLineChartPlugin();
    const cp = (plugin as unknown as {
      controlPanel: { formDataOverrides?: unknown };
    }).controlPanel;
    expect(typeof cp.formDataOverrides).toBe('function');
  });

  test('_glyphArgs is attached', () => {
    const plugin = new EchartsTimeseriesLineChartPlugin();
    const cp = (plugin as unknown as {
      controlPanel: { _glyphArgs?: Record<string, unknown> };
    }).controlPanel;
    expect(cp._glyphArgs).toBeDefined();
  });
});

describe('Timeseries Line - plugin loaders', () => {
  test('exposes loadChart / loadTransformProps / loadBuildQuery', () => {
    const plugin = new EchartsTimeseriesLineChartPlugin();
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
