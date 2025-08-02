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
import {
  getChartMetadataRegistry,
  ChartMetadata,
  Behavior,
} from '@superset-ui/core';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';

/**
 * Unit tests for chart registry filtering and option generation logic.
 * This tests the pure functions used in ChartList for filtering chart types.
 */

describe('Chart Registry Utils', () => {
  describe('Type filter option generation', () => {
    let registry: ReturnType<typeof getChartMetadataRegistry>;

    beforeEach(() => {
      registry = getChartMetadataRegistry();
      registry.clear();
    });

    it('generates correct options from chart metadata registry', () => {
      // Register test chart types
      registry
        .registerValue(
          'table',
          new ChartMetadata({
            name: 'Table',
            thumbnail: '',
            behaviors: [],
          }),
        )
        .registerValue(
          'line',
          new ChartMetadata({
            name: 'Line Chart',
            thumbnail: '',
            behaviors: [],
          }),
        )
        .registerValue(
          'native_filter',
          new ChartMetadata({
            name: 'Native Filter Chart',
            thumbnail: '',
            behaviors: [Behavior.NativeFilter],
          }),
        );

      // Generate options like ChartList does
      const options = registry
        .keys()
        .filter(k => nativeFilterGate(registry.get(k)?.behaviors || []))
        .map(k => ({ label: registry.get(k)?.name || k, value: k }))
        .sort((a, b) => {
          if (!a.label || !b.label) return 0;
          if (a.label > b.label) return 1;
          if (a.label < b.label) return -1;
          return 0;
        });

      expect(options).toEqual([
        { label: 'Line Chart', value: 'line' },
        { label: 'Table', value: 'table' },
      ]);

      // Native filter chart should be filtered out
      expect(
        options.find(opt => opt.value === 'native_filter'),
      ).toBeUndefined();
    });

    it('handles empty registry gracefully', () => {
      const options = registry
        .keys()
        .filter(k => nativeFilterGate(registry.get(k)?.behaviors || []))
        .map(k => ({ label: registry.get(k)?.name || k, value: k }));

      expect(options).toEqual([]);
    });

    it('falls back to chart key when name is missing', () => {
      registry.registerValue(
        'custom_chart',
        new ChartMetadata({
          name: '', // Empty name
          thumbnail: '',
          behaviors: [],
        }),
      );

      const options = registry
        .keys()
        .filter(k => nativeFilterGate(registry.get(k)?.behaviors || []))
        .map(k => ({ label: registry.get(k)?.name || k, value: k }));

      expect(options).toEqual([
        { label: 'custom_chart', value: 'custom_chart' },
      ]);
    });

    it('sorts options alphabetically by label', () => {
      registry
        .registerValue(
          'zebra',
          new ChartMetadata({
            name: 'Zebra Chart',
            thumbnail: '',
            behaviors: [],
          }),
        )
        .registerValue(
          'apple',
          new ChartMetadata({
            name: 'Apple Chart',
            thumbnail: '',
            behaviors: [],
          }),
        )
        .registerValue(
          'banana',
          new ChartMetadata({
            name: 'Banana Chart',
            thumbnail: '',
            behaviors: [],
          }),
        );

      const options = registry
        .keys()
        .filter(k => nativeFilterGate(registry.get(k)?.behaviors || []))
        .map(k => ({ label: registry.get(k)?.name || k, value: k }))
        .sort((a, b) => {
          if (!a.label || !b.label) return 0;
          if (a.label > b.label) return 1;
          if (a.label < b.label) return -1;
          return 0;
        });

      expect(options).toEqual([
        { label: 'Apple Chart', value: 'apple' },
        { label: 'Banana Chart', value: 'banana' },
        { label: 'Zebra Chart', value: 'zebra' },
      ]);
    });

    it('handles mixed chart behaviors correctly', () => {
      registry
        .registerValue(
          'regular',
          new ChartMetadata({
            name: 'Regular Chart',
            thumbnail: '',
            behaviors: [],
          }),
        )
        .registerValue(
          'interactive',
          new ChartMetadata({
            name: 'Interactive Chart',
            thumbnail: '',
            behaviors: [Behavior.InteractiveChart],
          }),
        )
        .registerValue(
          'native_with_interactive',
          new ChartMetadata({
            name: 'Native Filter with Interactive',
            thumbnail: '',
            behaviors: [Behavior.NativeFilter, Behavior.InteractiveChart],
          }),
        )
        .registerValue(
          'pure_native',
          new ChartMetadata({
            name: 'Pure Native Filter',
            thumbnail: '',
            behaviors: [Behavior.NativeFilter],
          }),
        );

      const options = registry
        .keys()
        .filter(k => nativeFilterGate(registry.get(k)?.behaviors || []))
        .map(k => ({ label: registry.get(k)?.name || k, value: k }))
        .sort((a, b) => {
          if (!a.label || !b.label) return 0;
          if (a.label > b.label) return 1;
          if (a.label < b.label) return -1;
          return 0;
        });

      // Should include regular, interactive, and native with interactive
      // Should exclude pure native filter
      expect(options).toEqual([
        { label: 'Interactive Chart', value: 'interactive' },
        {
          label: 'Native Filter with Interactive',
          value: 'native_with_interactive',
        },
        { label: 'Regular Chart', value: 'regular' },
      ]);

      expect(options.find(opt => opt.value === 'pure_native')).toBeUndefined();
    });
  });
});
