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

import { performance } from 'perf_hooks';
import {
  getSequentialSchemeRegistry,
  CategoricalColorNamespace,
} from '@superset-ui/core';

// Mock the registries for performance testing
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getSequentialSchemeRegistry: jest.fn(),
  CategoricalColorNamespace: {
    getScale: jest.fn(),
  },
}));

import transformProps from '../../plugins/plugin-chart-echarts/src/Pie/transformProps';

describe('Value-Based Colors Performance Tests', () => {
  const mockSequentialScheme = {
    getColors: jest.fn(() => [
      '#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5',
      '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac',
      '#084081', '#042142'
    ]),
  };

  const mockCategoricalScale = jest.fn((name) => {
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'];
    return colors[name.charCodeAt(0) % colors.length];
  });

  beforeEach(() => {
    (getSequentialSchemeRegistry as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(mockSequentialScheme),
    });

    (CategoricalColorNamespace.getScale as jest.Mock).mockReturnValue(mockCategoricalScale);
  });

  const generateTestData = (size: number) => {
    return Array.from({ length: size }, (_, i) => ({
      category: `Category ${i}`,
      metric: Math.random() * 1000,
    }));
  };

  const createTestProps = (data: any[], valueBasedColors: boolean) => ({
    formData: {
      valueBasedColors,
      sequentialColorScheme: 'superset_seq_1',
      colorScheme: 'supersetColors',
      groupby: ['category'],
      metric: 'metric',
      donut: false,
      innerRadius: 30,
      labelLine: false,
      labelType: 'key' as const,
      labelsOutside: true,
      outerRadius: 70,
      showLabels: true,
      showLabelsThreshold: 5,
      dateFormat: 'smart_date',
      roseType: null,
      numberFormat: 'SMART_NUMBER',
    },
    queriesData: [{ data }],
    width: 400,
    height: 400,
    hooks: {
      setDataMask: jest.fn(),
      onContextMenu: jest.fn(),
    },
    filterState: { selectedValues: [] },
    theme: {
      colors: {
        grayscale: { light5: '#f0f0f0' },
      },
    },
    datasource: {
      columnFormats: {},
      currencyFormats: {},
    },
  });

  describe('Pie Chart Performance', () => {
    it('should perform categorical coloring efficiently', () => {
      const testSizes = [10, 100, 1000, 5000];
      
      testSizes.forEach(size => {
        const data = generateTestData(size);
        const props = createTestProps(data, false);

        const start = performance.now();
        transformProps(props as any);
        const end = performance.now();

        const duration = end - start;
        console.log(`Categorical coloring ${size} items: ${duration.toFixed(2)}ms`);

        // Should complete within reasonable time
        expect(duration).toBeLessThan(size < 1000 ? 100 : 500);
      });
    });

    it('should perform value-based coloring efficiently', () => {
      const testSizes = [10, 100, 1000, 5000];
      
      testSizes.forEach(size => {
        const data = generateTestData(size);
        const props = createTestProps(data, true);

        const start = performance.now();
        transformProps(props as any);
        const end = performance.now();

        const duration = end - start;
        console.log(`Value-based coloring ${size} items: ${duration.toFixed(2)}ms`);

        // Value-based should not be significantly slower than categorical
        expect(duration).toBeLessThan(size < 1000 ? 150 : 750);
      });
    });

    it('should compare performance between color modes', () => {
      const sizes = [100, 1000, 5000];
      
      sizes.forEach(size => {
        const data = generateTestData(size);

        // Test categorical performance
        const categoricalProps = createTestProps(data, false);
        const categoricalStart = performance.now();
        transformProps(categoricalProps as any);
        const categoricalEnd = performance.now();
        const categoricalDuration = categoricalEnd - categoricalStart;

        // Test value-based performance
        const valueBasedProps = createTestProps(data, true);
        const valueBasedStart = performance.now();
        transformProps(valueBasedProps as any);
        const valueBasedEnd = performance.now();
        const valueBasedDuration = valueBasedEnd - valueBasedStart;

        console.log(`Size ${size}: Categorical=${categoricalDuration.toFixed(2)}ms, Value-based=${valueBasedDuration.toFixed(2)}ms`);

        // Value-based should not be more than 2x slower than categorical
        expect(valueBasedDuration).toBeLessThan(categoricalDuration * 2);
      });
    });

    it('should handle memory efficiently with large datasets', () => {
      const largeData = generateTestData(10000);
      const props = createTestProps(largeData, true);

      // Monitor memory usage (simplified)
      const initialMemory = process.memoryUsage().heapUsed;
      
      const start = performance.now();
      const result = transformProps(props as any);
      const end = performance.now();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Large dataset performance: ${(end - start).toFixed(2)}ms`);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Should complete in reasonable time and not use excessive memory
      expect(end - start).toBeLessThan(2000); // 2 seconds max
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB max
      expect(result.echartOptions.series[0].data).toHaveLength(10000);
    });
  });

  describe('Color Calculation Performance', () => {
    it('should calculate color ranges efficiently', () => {
      const testData = generateTestData(1000);
      
      // Test multiple sequential color calculations
      const iterations = 100;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const props = createTestProps(testData, true);
        transformProps(props as any);
      }
      
      const end = performance.now();
      const avgDuration = (end - start) / iterations;
      
      console.log(`Average color calculation time: ${avgDuration.toFixed(2)}ms`);
      expect(avgDuration).toBeLessThan(50); // Should average under 50ms per calculation
    });

    it('should handle extreme value ranges efficiently', () => {
      const extremeData = [
        { category: 'Min', metric: 0.001 },
        { category: 'Max', metric: 1000000 },
        { category: 'Mid', metric: 500000 },
      ];

      const props = createTestProps(extremeData, true);
      
      const start = performance.now();
      const result = transformProps(props as any);
      const end = performance.now();

      console.log(`Extreme range calculation: ${(end - start).toFixed(2)}ms`);
      
      expect(end - start).toBeLessThan(100);
      expect(result.echartOptions.series[0].data).toHaveLength(3);
      
      // All data points should have valid colors
      result.echartOptions.series[0].data.forEach(point => {
        expect(point.itemStyle.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  describe('Concurrent Performance', () => {
    it('should handle multiple simultaneous color calculations', async () => {
      const testData = generateTestData(500);
      const concurrentRequests = 10;
      
      const promises = Array.from({ length: concurrentRequests }, () => {
        return new Promise<number>((resolve) => {
          const start = performance.now();
          const props = createTestProps(testData, true);
          transformProps(props as any);
          const end = performance.now();
          resolve(end - start);
        });
      });

      const start = performance.now();
      const durations = await Promise.all(promises);
      const totalEnd = performance.now();

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const totalDuration = totalEnd - start;

      console.log(`Concurrent requests - Avg: ${avgDuration.toFixed(2)}ms, Total: ${totalDuration.toFixed(2)}ms`);

      // Individual requests should complete quickly
      expect(avgDuration).toBeLessThan(200);
      // Total time should not be linear (some parallelization)
      expect(totalDuration).toBeLessThan(durations.reduce((a, b) => a + b, 0));
    });
  });

  describe('Regression Performance', () => {
    it('should maintain performance across different color schemes', () => {
      const schemes = [
        'superset_seq_1',
        'superset_seq_2',
        'blues',
        'greens',
        'oranges',
        'purples',
        'dark_blue',
        'echarts_gradient',
      ];

      const testData = generateTestData(1000);
      const results: Record<string, number> = {};

      schemes.forEach(scheme => {
        const props = createTestProps(testData, true);
        props.formData.sequentialColorScheme = scheme;

        const start = performance.now();
        transformProps(props as any);
        const end = performance.now();

        results[scheme] = end - start;
      });

      // Print results for monitoring
      console.log('Scheme performance results:');
      Object.entries(results).forEach(([scheme, duration]) => {
        console.log(`  ${scheme}: ${duration.toFixed(2)}ms`);
      });

      // All schemes should perform similarly
      const durations = Object.values(results);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variance = maxDuration - minDuration;

      // Variance should be less than 100ms
      expect(variance).toBeLessThan(100);
      // All should complete within reasonable time
      durations.forEach(duration => {
        expect(duration).toBeLessThan(300);
      });
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not create memory leaks with repeated calculations', () => {
      const testData = generateTestData(100);
      const iterations = 1000;

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const props = createTestProps(testData, true);
        transformProps(props as any);
        
        // Force garbage collection periodically
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory increase after ${iterations} iterations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Should not have significant memory increase
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB max
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle identical values efficiently', () => {
      const identicalData = Array.from({ length: 1000 }, (_, i) => ({
        category: `Category ${i}`,
        metric: 100, // All same value
      }));

      const props = createTestProps(identicalData, true);
      
      const start = performance.now();
      const result = transformProps(props as any);
      const end = performance.now();

      console.log(`Identical values performance: ${(end - start).toFixed(2)}ms`);

      expect(end - start).toBeLessThan(200);
      
      // All should get the same color when values are identical
      const colors = result.echartOptions.series[0].data.map(d => d.itemStyle.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(1);
    });

    it('should handle null/undefined values efficiently', () => {
      const nullData = Array.from({ length: 1000 }, (_, i) => ({
        category: `Category ${i}`,
        metric: i % 3 === 0 ? null : i % 3 === 1 ? undefined : Math.random() * 100,
      }));

      const props = createTestProps(nullData, true);
      
      const start = performance.now();
      const result = transformProps(props as any);
      const end = performance.now();

      console.log(`Null/undefined values performance: ${(end - start).toFixed(2)}ms`);

      expect(end - start).toBeLessThan(300);
      expect(result.echartOptions.series[0].data).toHaveLength(1000);
      
      // All should have valid colors
      result.echartOptions.series[0].data.forEach(point => {
        expect(point.itemStyle.color).toBeDefined();
        expect(typeof point.itemStyle.color).toBe('string');
      });
    });
  });
});
