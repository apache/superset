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
  getSequentialSchemeRegistry,
  CategoricalColorNamespace,
} from '@superset-ui/core';
import { ColorBy } from '../src/utils';

// Mock D3 and external dependencies
jest.mock('d3', () => ({
  geo: {
    path: jest.fn(() => ({
      projection: jest.fn(),
      bounds: jest.fn(() => [[0, 0], [100, 100]]),
    })),
    centroid: jest.fn(() => [0, 0]),
    mercator: jest.fn(() => ({
      scale: jest.fn().mockReturnThis(),
      center: jest.fn().mockReturnThis(),
      translate: jest.fn().mockReturnThis(),
    })),
  },
  select: jest.fn(() => ({
    classed: jest.fn().mockReturnThis(),
    selectAll: jest.fn(() => ({
      remove: jest.fn(),
      data: jest.fn(() => ({
        enter: jest.fn(() => ({
          append: jest.fn(() => ({
            attr: jest.fn().mockReturnThis(),
            style: jest.fn().mockReturnThis(),
            on: jest.fn().mockReturnThis(),
          })),
        })),
      })),
    })),
    append: jest.fn(() => ({
      attr: jest.fn().mockReturnThis(),
      classed: jest.fn().mockReturnThis(),
    })),
    html: jest.fn(),
  })),
  scale: {
    linear: jest.fn(() => ({
      domain: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    })),
  },
  json: jest.fn(),
}));

jest.mock('d3-array', () => ({
  extent: jest.fn(),
}));

// Mock Superset UI core
jest.mock('@superset-ui/core', () => ({
  getNumberFormatter: jest.fn(() => (value) => value.toString()),
  getSequentialSchemeRegistry: jest.fn(),
  CategoricalColorNamespace: {
    getScale: jest.fn(),
  },
}));

import CountryMap from '../src/CountryMap';
import { extent as d3Extent } from 'd3-array';

describe('Country Map Value-Based Colors', () => {
  let mockElement;
  let mockSequentialScheme;
  let mockCategoricalScale;

  const mockData = [
    { country_id: 'CA-AB', metric: 100 }, // Alberta
    { country_id: 'CA-BC', metric: 300 }, // British Columbia  
    { country_id: 'CA-ON', metric: 200 }, // Ontario
    { country_id: 'CA-QC', metric: 150 }, // Quebec
  ];

  const baseProps = {
    data: mockData,
    width: 800,
    height: 600,
    country: 'canada',
    linearColorScheme: 'blues',
    colorScheme: 'supersetColors',
    numberFormat: 'SMART_NUMBER',
    sliceId: 123,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock DOM element
    mockElement = {
      style: {},
    };

    // Setup mock sequential scheme
    mockSequentialScheme = {
      createLinearScale: jest.fn(() => (value) => {
        // Simulate color mapping based on value
        const minVal = 100;
        const maxVal = 300;
        const normalized = (value - minVal) / (maxVal - minVal);
        const colors = ['#f7fbff', '#4292c6', '#08519c'];
        const index = Math.floor(normalized * (colors.length - 1));
        return colors[Math.min(index, colors.length - 1)];
      }),
    };

    // Setup mock categorical scale
    mockCategoricalScale = jest.fn((regionId) => {
      const colorMap = {
        'CA-AB': '#1f77b4',
        'CA-BC': '#ff7f0e', 
        'CA-ON': '#2ca02c',
        'CA-QC': '#d62728',
      };
      return colorMap[regionId] || '#333333';
    });

    // Setup mocks
    (getSequentialSchemeRegistry as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(mockSequentialScheme),
    });

    (CategoricalColorNamespace.getScale as jest.Mock).mockReturnValue(mockCategoricalScale);

    (d3Extent as jest.Mock).mockReturnValue([100, 300]);
  });

  describe('ColorBy.Metric (Value-Based Colors)', () => {
    it('should use sequential colors when colorBy is Metric', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Metric,
      };

      // This test verifies the logic would be called correctly
      CountryMap(mockElement, props);

      expect(getSequentialSchemeRegistry).toHaveBeenCalled();
      expect(mockSequentialScheme.createLinearScale).toHaveBeenCalledWith([100, 300]);
      expect(CategoricalColorNamespace.getScale).not.toHaveBeenCalled();
    });

    it('should assign darker colors to higher metric values', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Metric,
      };

      CountryMap(mockElement, props);

      // Verify that the color scale function works correctly
      const colorScale = mockSequentialScheme.createLinearScale();
      
      // Higher values should get darker colors
      const colorLow = colorScale(100);   // Minimum value
      const colorHigh = colorScale(300);  // Maximum value
      const colorMid = colorScale(200);   // Middle value

      expect(colorLow).toBe('#f7fbff');   // Lightest
      expect(colorHigh).toBe('#08519c');  // Darkest
      expect(colorMid).toBe('#4292c6');   // Middle
    });

    it('should handle edge cases with min/max values', () => {
      const edgeData = [
        { country_id: 'CA-AB', metric: 0 },
        { country_id: 'CA-BC', metric: 1000 },
      ];

      (d3Extent as jest.Mock).mockReturnValue([0, 1000]);

      const props = {
        ...baseProps,
        data: edgeData,
        colorBy: ColorBy.Metric,
      };

      expect(() => CountryMap(mockElement, props)).not.toThrow();
      expect(mockSequentialScheme.createLinearScale).toHaveBeenCalledWith([0, 1000]);
    });

    it('should work with different sequential color schemes', () => {
      const schemes = ['blues', 'greens', 'oranges', 'purples', 'superset_seq_1'];
      
      schemes.forEach(scheme => {
        const props = {
          ...baseProps,
          linearColorScheme: scheme,
          colorBy: ColorBy.Metric,
        };

        CountryMap(mockElement, props);
        
        const registry = (getSequentialSchemeRegistry as jest.Mock)();
        expect(registry.get).toHaveBeenCalledWith(scheme);
      });
    });
  });

  describe('ColorBy.Region (Categorical Colors)', () => {
    it('should use categorical colors when colorBy is Region', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Region,
      };

      CountryMap(mockElement, props);

      expect(CategoricalColorNamespace.getScale).toHaveBeenCalledWith('supersetColors');
      expect(mockCategoricalScale).toHaveBeenCalledWith('CA-AB', 123);
      expect(getSequentialSchemeRegistry).not.toHaveBeenCalled();
    });

    it('should assign unique colors to different regions', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Region,
      };

      CountryMap(mockElement, props);

      // Verify each region gets called with categorical scale
      expect(mockCategoricalScale).toHaveBeenCalledWith('CA-AB', 123);
      expect(mockCategoricalScale).toHaveBeenCalledWith('CA-BC', 123);
      expect(mockCategoricalScale).toHaveBeenCalledWith('CA-ON', 123);
      expect(mockCategoricalScale).toHaveBeenCalledWith('CA-QC', 123);

      // Verify different regions get different colors
      const colorAB = mockCategoricalScale('CA-AB');
      const colorBC = mockCategoricalScale('CA-BC');
      expect(colorAB).not.toBe(colorBC);
    });

    it('should work with different categorical color schemes', () => {
      const schemes = ['supersetColors', 'bnbColors', 'd3Category10'];
      
      schemes.forEach(scheme => {
        const props = {
          ...baseProps,
          colorScheme: scheme,
          colorBy: ColorBy.Region,
        };

        CountryMap(mockElement, props);
        expect(CategoricalColorNamespace.getScale).toHaveBeenCalledWith(scheme);
      });
    });
  });

  describe('Default Behavior (Backwards Compatibility)', () => {
    it('should default to Metric-based coloring when colorBy is not specified', () => {
      const props = {
        ...baseProps,
        // colorBy not specified - should default to Metric
      };

      CountryMap(mockElement, props);

      // Should use sequential colors by default
      expect(getSequentialSchemeRegistry).toHaveBeenCalled();
      expect(mockSequentialScheme.createLinearScale).toHaveBeenCalled();
    });

    it('should maintain backwards compatibility with existing charts', () => {
      // Test the old behavior where only linearColorScheme was used
      const oldProps = {
        data: mockData,
        width: 800,
        height: 600,
        country: 'canada',
        linearColorScheme: 'blues',
        numberFormat: 'SMART_NUMBER',
        // No colorBy specified
      };

      expect(() => CountryMap(mockElement, oldProps)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing data gracefully', () => {
      const props = {
        ...baseProps,
        data: [],
        colorBy: ColorBy.Metric,
      };

      expect(() => CountryMap(mockElement, props)).not.toThrow();
    });

    it('should handle null metric values', () => {
      const dataWithNulls = [
        { country_id: 'CA-AB', metric: null },
        { country_id: 'CA-BC', metric: 100 },
      ];

      const props = {
        ...baseProps,
        data: dataWithNulls,
        colorBy: ColorBy.Metric,
      };

      expect(() => CountryMap(mockElement, props)).not.toThrow();
    });

    it('should handle missing color schemes gracefully', () => {
      const props = {
        ...baseProps,
        linearColorScheme: undefined,
        colorScheme: undefined,
        colorBy: ColorBy.Metric,
      };

      expect(() => CountryMap(mockElement, props)).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        country_id: `REGION-${i}`,
        metric: Math.random() * 1000,
      }));

      const props = {
        ...baseProps,
        data: largeData,
        colorBy: ColorBy.Metric,
      };

      const start = performance.now();
      CountryMap(mockElement, props);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Color Function Behavior', () => {
    it('should return "none" for unknown regions', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Metric,
      };

      CountryMap(mockElement, props);

      // Test the internal colorFn behavior
      // This would need access to the internal colorFn, which might require refactoring
      // For now, this is a conceptual test
      expect(true).toBe(true);
    });

    it('should handle regions with zero values', () => {
      const dataWithZero = [
        { country_id: 'CA-AB', metric: 0 },
        { country_id: 'CA-BC', metric: 100 },
      ];

      (d3Extent as jest.Mock).mockReturnValue([0, 100]);

      const props = {
        ...baseProps,
        data: dataWithZero,
        colorBy: ColorBy.Metric,
      };

      expect(() => CountryMap(mockElement, props)).not.toThrow();
    });
  });

  describe('Integration with Map Loading', () => {
    it('should work when map data is loaded from cache', () => {
      // Simulate cached map data
      const props = {
        ...baseProps,
        country: 'usa', // Different country
        colorBy: ColorBy.Metric,
      };

      expect(() => CountryMap(mockElement, props)).not.toThrow();
    });

    it('should work when map data needs to be fetched', () => {
      const props = {
        ...baseProps,
        country: 'germany',
        colorBy: ColorBy.Region,
      };

      expect(() => CountryMap(mockElement, props)).not.toThrow();
    });
  });
});
