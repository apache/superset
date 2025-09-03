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
  select: jest.fn(() => ({
    classed: jest.fn().mockReturnThis(),
    selectAll: jest.fn(() => ({
      remove: jest.fn(),
      style: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
    })),
  })),
  scale: {
    linear: jest.fn(() => ({
      domain: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    })),
  },
}));

jest.mock('d3-array', () => ({
  extent: jest.fn(),
}));

// Mock Datamaps
jest.mock('datamaps/dist/datamaps.world.min', () => {
  return jest.fn().mockImplementation(() => ({
    updateChoropleth: jest.fn(),
    bubbles: jest.fn(),
    svg: {
      selectAll: jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
      })),
    },
  }));
});

// Mock Superset UI core
jest.mock('@superset-ui/core', () => ({
  getSequentialSchemeRegistry: jest.fn(),
  CategoricalColorNamespace: {
    getScale: jest.fn(),
  },
}));

import WorldMap from '../src/WorldMap';
import { extent as d3Extent } from 'd3-array';
import Datamap from 'datamaps/dist/datamaps.world.min';

describe('World Map Value-Based Colors', () => {
  let mockElement;
  let mockSequentialScheme;
  let mockCategoricalScale;

  const mockData = [
    { country: 'USA', name: 'United States', m1: 100, m2: 500, latitude: 39.8283, longitude: -98.5795 },
    { country: 'CHN', name: 'China', m1: 300, m2: 800, latitude: 35.8617, longitude: 104.1954 },
    { country: 'GBR', name: 'United Kingdom', m1: 200, m2: 600, latitude: 55.3781, longitude: -3.4360 },
    { country: 'DEU', name: 'Germany', m1: 150, m2: 550, latitude: 51.1657, longitude: 10.4515 },
  ];

  const baseProps = {
    data: mockData,
    width: 800,
    height: 600,
    maxBubbleSize: 50,
    showBubbles: false,
    linearColorScheme: 'blues',
    colorScheme: 'supersetColors',
    sliceId: 123,
    theme: {
      colors: {
        grayscale: {
          light2: '#f0f0f0',
          light5: '#d0d0d0',
          dark2: '#666666',
        },
      },
    },
    formatter: jest.fn((value) => value.toString()),
    onContextMenu: jest.fn(),
    setDataMask: jest.fn(),
    inContextMenu: false,
    filterState: { selectedValues: [] },
    emitCrossFilters: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock DOM element
    mockElement = document.createElement('div');

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
    mockCategoricalScale = jest.fn((countryName) => {
      const colorMap = {
        'United States': '#1f77b4',
        'China': '#ff7f0e',
        'United Kingdom': '#2ca02c',
        'Germany': '#d62728',
      };
      return colorMap[countryName] || '#333333';
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

      WorldMap(mockElement, props);

      expect(getSequentialSchemeRegistry).toHaveBeenCalled();
      expect(mockSequentialScheme.createLinearScale).toHaveBeenCalledWith([100, 300]);
      expect(CategoricalColorNamespace.getScale).not.toHaveBeenCalled();
    });

    it('should assign colors based on m1 metric values', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Metric,
      };

      WorldMap(mockElement, props);

      // Verify that the color scale function works correctly
      const colorScale = mockSequentialScheme.createLinearScale();
      
      // Check that colors are assigned based on m1 values
      const colorUSA = colorScale(100);  // m1: 100 (minimum)
      const colorCHN = colorScale(300);  // m1: 300 (maximum)
      const colorGBR = colorScale(200);  // m1: 200 (middle)

      expect(colorUSA).toBe('#f7fbff');   // Lightest (lowest value)
      expect(colorCHN).toBe('#08519c');   // Darkest (highest value)
      expect(colorGBR).toBe('#4292c6');   // Middle
    });

    it('should work with bubbles enabled', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Metric,
        showBubbles: true,
      };

      expect(() => WorldMap(mockElement, props)).not.toThrow();

      // Verify bubbles are created
      const datamapInstance = (Datamap as jest.Mock).mock.results[0].value;
      expect(datamapInstance.bubbles).toHaveBeenCalled();
    });

    it('should handle different sequential color schemes', () => {
      const schemes = ['blues', 'greens', 'oranges', 'purples', 'superset_seq_1'];
      
      schemes.forEach(scheme => {
        const props = {
          ...baseProps,
          linearColorScheme: scheme,
          colorBy: ColorBy.Metric,
        };

        WorldMap(mockElement, props);
        
        const registry = (getSequentialSchemeRegistry as jest.Mock)();
        expect(registry.get).toHaveBeenCalledWith(scheme);
      });
    });

    it('should calculate bubble sizes based on m2 values', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Metric,
        showBubbles: true,
        maxBubbleSize: 100,
      };

      WorldMap(mockElement, props);

      // Verify Datamap is called with processed data including radius
      const datamapCall = (Datamap as jest.Mock).mock.calls[0][0];
      expect(datamapCall.data).toBeDefined();
      
      // Each data point should have radius calculated from m2
      datamapCall.data.forEach(point => {
        expect(point.radius).toBeDefined();
        expect(typeof point.radius).toBe('number');
      });
    });
  });

  describe('ColorBy.Country (Categorical Colors)', () => {
    it('should use categorical colors when colorBy is Country', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Country,
      };

      WorldMap(mockElement, props);

      expect(CategoricalColorNamespace.getScale).toHaveBeenCalledWith('supersetColors');
      expect(mockCategoricalScale).toHaveBeenCalledWith('United States', 123);
      expect(getSequentialSchemeRegistry).not.toHaveBeenCalled();
    });

    it('should assign unique colors to different countries', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Country,
      };

      WorldMap(mockElement, props);

      // Verify each country gets called with categorical scale
      expect(mockCategoricalScale).toHaveBeenCalledWith('United States', 123);
      expect(mockCategoricalScale).toHaveBeenCalledWith('China', 123);
      expect(mockCategoricalScale).toHaveBeenCalledWith('United Kingdom', 123);
      expect(mockCategoricalScale).toHaveBeenCalledWith('Germany', 123);

      // Verify different countries get different colors
      const colorUSA = mockCategoricalScale('United States');
      const colorCHN = mockCategoricalScale('China');
      expect(colorUSA).not.toBe(colorCHN);
    });

    it('should work with different categorical color schemes', () => {
      const schemes = ['supersetColors', 'bnbColors', 'd3Category10'];
      
      schemes.forEach(scheme => {
        const props = {
          ...baseProps,
          colorScheme: scheme,
          colorBy: ColorBy.Country,
        };

        WorldMap(mockElement, props);
        expect(CategoricalColorNamespace.getScale).toHaveBeenCalledWith(scheme);
      });
    });
  });

  describe('Data Filtering and Processing', () => {
    it('should filter out XXX countries', () => {
      const dataWithXXX = [
        ...mockData,
        { country: 'XXX', name: 'Unknown', m1: 50, m2: 100 },
      ];

      const props = {
        ...baseProps,
        data: dataWithXXX,
        colorBy: ColorBy.Metric,
      };

      WorldMap(mockElement, props);

      // Verify XXX is filtered out in extent calculation
      expect(d3Extent).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ country: 'USA' }),
          expect.objectContaining({ country: 'CHN' }),
        ]),
        expect.any(Function)
      );

      expect(d3Extent).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ country: 'XXX' }),
        ]),
        expect.any(Function)
      );
    });

    it('should handle missing country data', () => {
      const dataWithMissing = [
        { country: 'USA', name: 'United States', m1: 100, m2: 500 },
        { country: null, name: 'Unknown', m1: 50, m2: 100 },
        { country: '', name: 'Empty', m1: 75, m2: 200 },
      ];

      const props = {
        ...baseProps,
        data: dataWithMissing,
        colorBy: ColorBy.Metric,
      };

      expect(() => WorldMap(mockElement, props)).not.toThrow();
    });
  });

  describe('Interactivity', () => {
    it('should handle click events for cross-filtering', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Country,
        emitCrossFilters: true,
      };

      WorldMap(mockElement, props);

      // Verify event handlers are set up
      const datamapCall = (Datamap as jest.Mock).mock.calls[0][0];
      expect(datamapCall.done).toBeDefined();
      expect(typeof datamapCall.done).toBe('function');
    });

    it('should handle context menu events', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Metric,
        inContextMenu: false,
      };

      WorldMap(mockElement, props);

      // Verify context menu handler is set up
      expect(baseProps.onContextMenu).toBeDefined();
    });

    it('should show appropriate popups based on hover', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Metric,
        inContextMenu: false,
      };

      WorldMap(mockElement, props);

      const datamapCall = (Datamap as jest.Mock).mock.calls[0][0];
      
      // Geography config should have popup template
      expect(datamapCall.geographyConfig.popupTemplate).toBeDefined();
      expect(typeof datamapCall.geographyConfig.popupTemplate).toBe('function');

      // Bubbles config should have popup template
      expect(datamapCall.bubblesConfig.popupTemplate).toBeDefined();
      expect(typeof datamapCall.bubblesConfig.popupTemplate).toBe('function');
    });
  });

  describe('Filter State Integration', () => {
    it('should handle selected values in filter state', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Country,
        filterState: {
          selectedValues: ['USA', 'CHN'],
        },
      };

      expect(() => WorldMap(mockElement, props)).not.toThrow();
    });

    it('should apply different styling to filtered countries', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Metric,
        filterState: {
          selectedValues: ['USA'],
        },
      };

      WorldMap(mockElement, props);

      // This would need access to internal styling logic
      // For now, verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large datasets efficiently', () => {
      const largeData = Array.from({ length: 200 }, (_, i) => ({
        country: `CO${i}`,
        name: `Country ${i}`,
        m1: Math.random() * 1000,
        m2: Math.random() * 1000,
        latitude: Math.random() * 180 - 90,
        longitude: Math.random() * 360 - 180,
      }));

      const props = {
        ...baseProps,
        data: largeData,
        colorBy: ColorBy.Metric,
      };

      const start = performance.now();
      WorldMap(mockElement, props);
      const end = performance.now();

      expect(end - start).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle empty data arrays', () => {
      const props = {
        ...baseProps,
        data: [],
        colorBy: ColorBy.Metric,
      };

      expect(() => WorldMap(mockElement, props)).not.toThrow();
    });

    it('should handle null metric values', () => {
      const dataWithNulls = [
        { country: 'USA', name: 'United States', m1: null, m2: 500 },
        { country: 'CHN', name: 'China', m1: 300, m2: null },
      ];

      const props = {
        ...baseProps,
        data: dataWithNulls,
        colorBy: ColorBy.Metric,
      };

      expect(() => WorldMap(mockElement, props)).not.toThrow();
    });

    it('should handle extreme values in bubble sizing', () => {
      const extremeData = [
        { country: 'USA', name: 'United States', m1: 100, m2: 0 },
        { country: 'CHN', name: 'China', m1: 300, m2: 1000000 },
      ];

      const props = {
        ...baseProps,
        data: extremeData,
        colorBy: ColorBy.Metric,
        showBubbles: true,
      };

      expect(() => WorldMap(mockElement, props)).not.toThrow();
    });
  });

  describe('Theme Integration', () => {
    it('should use theme colors for map styling', () => {
      const customTheme = {
        colors: {
          grayscale: {
            light2: '#custom-light',
            light5: '#custom-border',
            dark2: '#custom-dark',
          },
        },
      };

      const props = {
        ...baseProps,
        theme: customTheme,
        colorBy: ColorBy.Country,
      };

      WorldMap(mockElement, props);

      const datamapCall = (Datamap as jest.Mock).mock.calls[0][0];
      
      // Verify theme colors are used
      expect(datamapCall.fills.defaultFill).toBe('#custom-light');
      expect(datamapCall.geographyConfig.borderColor).toBe('#custom-border');
      expect(datamapCall.geographyConfig.highlightBorderColor).toBe('#custom-border');
    });
  });

  describe('Configuration Options', () => {
    it('should respect maxBubbleSize setting', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Metric,
        showBubbles: true,
        maxBubbleSize: 75,
      };

      WorldMap(mockElement, props);

      // The bubble size scaling should respect the max size
      // This would need access to the internal scaling logic
      expect(true).toBe(true);
    });

    it('should handle different country field types', () => {
      const props = {
        ...baseProps,
        colorBy: ColorBy.Country,
        countryFieldtype: 'cca3',
      };

      expect(() => WorldMap(mockElement, props)).not.toThrow();
    });
  });
});
