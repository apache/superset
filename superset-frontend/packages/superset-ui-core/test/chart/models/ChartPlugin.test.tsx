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

import React from 'react';
import {
  ChartPlugin,
  ChartMetadata,
  ChartProps,
  BuildQueryFunction,
  TransformProps,
  getChartMetadataRegistry,
  getChartComponentRegistry,
  getChartTransformPropsRegistry,
  getChartBuildQueryRegistry,
  getChartControlPanelRegistry,
  QueryFormData,
  DatasourceType,
} from '@superset-ui/core';

describe('ChartPlugin', () => {
  const FakeChart = () => <span>test</span>;

  const metadata = new ChartMetadata({
    name: 'test-chart',
    thumbnail: '',
  });

  const buildQuery = () => ({
    datasource: { id: 1, type: DatasourceType.Table },
    queries: [{ granularity: 'day' }],
    force: false,
    result_format: 'json',
    result_type: 'full',
  });

  const controlPanel = { abc: 1 };

  it('exists', () => {
    expect(ChartPlugin).toBeDefined();
  });

  describe('new ChartPlugin()', () => {
    const FORM_DATA = {
      datasource: '1__table',
      granularity: 'day',
      viz_type: 'table',
    };

    it('creates a new plugin', () => {
      const plugin = new ChartPlugin({
        metadata,
        Chart: FakeChart,
      });
      expect(plugin).toBeInstanceOf(ChartPlugin);
    });
    describe('buildQuery', () => {
      it('defaults to undefined', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
        });
        expect(plugin.loadBuildQuery).toBeUndefined();
      });
      it('uses loadBuildQuery field if specified', () => {
        expect.assertions(2);
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
          loadBuildQuery: () => buildQuery,
        });

        const fn =
          plugin.loadBuildQuery!() as BuildQueryFunction<QueryFormData>;
        expect(fn(FORM_DATA).queries[0]).toEqual({ granularity: 'day' });
        expect(fn(FORM_DATA).force).toEqual(false);
      });
      it('uses buildQuery field if specified', () => {
        expect.assertions(1);
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
          buildQuery,
        });

        const fn =
          plugin.loadBuildQuery!() as BuildQueryFunction<QueryFormData>;
        expect(fn(FORM_DATA).queries[0]).toEqual({ granularity: 'day' });
      });
    });
    describe('Chart', () => {
      it('uses loadChart if specified', () => {
        const loadChart = () => FakeChart;
        const plugin = new ChartPlugin({
          metadata,
          loadChart,
        });
        // the loader is sanitized, so assert on the value
        expect(plugin.loadChart()).toBe(loadChart());
      });
      it('uses Chart field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
        });
        expect(plugin.loadChart()).toEqual(FakeChart);
      });
      it('throws an error if none of Chart or loadChart is specified', () => {
        expect(() => new ChartPlugin({ metadata })).toThrow(Error);
      });
    });
    describe('transformProps', () => {
      const PROPS = new ChartProps({
        formData: FORM_DATA,
        width: 400,
        height: 400,
        queriesData: [{}],
      });
      it('defaults to identity function', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
        });
        const fn = plugin.loadTransformProps() as TransformProps;
        expect(fn(PROPS)).toBe(PROPS);
      });
      it('uses loadTransformProps field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
          loadTransformProps: () => () => ({ field2: 2 }),
        });
        const fn = plugin.loadTransformProps() as TransformProps;
        expect(fn(PROPS)).toEqual({ field2: 2 });
      });
      it('uses transformProps field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
          transformProps: () => ({ field2: 2 }),
        });
        const fn = plugin.loadTransformProps() as TransformProps;
        expect(fn(PROPS)).toEqual({ field2: 2 });
      });
    });
    describe('controlPanel', () => {
      it('takes controlPanel from input', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
          controlPanel,
        });
        expect(plugin.controlPanel).toBe(controlPanel);
      });
      it('defaults to empty object', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
        });
        expect(plugin.controlPanel).toEqual({});
      });
    });
  });

  describe('.register()', () => {
    let plugin: ChartPlugin;

    beforeEach(() => {
      plugin = new ChartPlugin({
        metadata,
        Chart: FakeChart,
        buildQuery,
        controlPanel,
      });
    });

    it('throws an error if key is not provided', () => {
      expect(() => plugin.register()).toThrow(Error);
      expect(() => plugin.configure({ key: 'ab' }).register()).not.toThrow(
        Error,
      );
    });
    it('add the plugin to the registries', () => {
      plugin.configure({ key: 'cd' }).register();
      expect(getChartMetadataRegistry().get('cd')).toBe(metadata);
      expect(getChartComponentRegistry().get('cd')).toBe(FakeChart);
      expect(getChartTransformPropsRegistry().has('cd')).toEqual(true);
      expect(getChartBuildQueryRegistry().get('cd')).toBe(buildQuery);
      expect(getChartControlPanelRegistry().get('cd')).toBe(controlPanel);
    });
    it('does not register buildQuery when it is not specified in the ChartPlugin', () => {
      new ChartPlugin({
        metadata,
        Chart: FakeChart,
      })
        .configure({ key: 'ef' })
        .register();
      expect(getChartBuildQueryRegistry().has('ef')).toEqual(false);
    });
    it('returns itself', () => {
      expect(plugin.configure({ key: 'gh' }).register()).toBe(plugin);
    });
  });

  describe('.unregister()', () => {
    let plugin: ChartPlugin;

    beforeEach(() => {
      plugin = new ChartPlugin({
        metadata,
        Chart: FakeChart,
        buildQuery,
        controlPanel,
      });
    });

    it('throws an error if key is not provided', () => {
      expect(() => plugin.unregister()).toThrow(Error);
      expect(() => plugin.configure({ key: 'abc' }).unregister()).not.toThrow(
        Error,
      );
    });
    it('removes the chart from the registries', () => {
      plugin.configure({ key: 'def' }).register();
      expect(getChartMetadataRegistry().get('def')).toBe(metadata);
      expect(getChartComponentRegistry().get('def')).toBe(FakeChart);
      expect(getChartTransformPropsRegistry().has('def')).toEqual(true);
      expect(getChartBuildQueryRegistry().get('def')).toBe(buildQuery);
      expect(getChartControlPanelRegistry().get('def')).toBe(controlPanel);
      plugin.unregister();
      expect(getChartMetadataRegistry().has('def')).toBeFalsy();
      expect(getChartComponentRegistry().has('def')).toBeFalsy();
      expect(getChartTransformPropsRegistry().has('def')).toBeFalsy();
      expect(getChartBuildQueryRegistry().has('def')).toBeFalsy();
      expect(getChartControlPanelRegistry().has('def')).toBeFalsy();
    });
    it('returns itself', () => {
      expect(plugin.configure({ key: 'xyz' }).unregister()).toBe(plugin);
    });
  });
});
