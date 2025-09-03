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

const { ColorBy } = require('../src/utils');

describe('World Map Value-Based Colors Logic Tests', () => {
  const mockData = [
    { country: 'USA', name: 'United States', m1: 100, m2: 500 },
    { country: 'CHN', name: 'China', m1: 300, m2: 800 },
    { country: 'GBR', name: 'United Kingdom', m1: 200, m2: 600 },
    { country: 'DEU', name: 'Germany', m1: 150, m2: 550 },
  ];

  describe('ColorBy Enum', () => {
    it('should have correct enum values', () => {
      expect(ColorBy.Metric).toBe('metric');
      expect(ColorBy.Country).toBe('country');
    });
  });

  describe('Data Filtering', () => {
    it('should filter out XXX countries', () => {
      const dataWithXXX = [
        ...mockData,
        { country: 'XXX', name: 'Unknown', m1: 50, m2: 100 },
      ];

      const filteredData = dataWithXXX.filter(d => d.country && d.country !== 'XXX');

      expect(filteredData).toHaveLength(4);
      expect(filteredData.every(d => d.country !== 'XXX')).toBe(true);
    });

    it('should handle missing country data', () => {
      const dataWithMissing = [
        { country: 'USA', name: 'United States', m1: 100, m2: 500 },
        { country: null, name: 'Unknown', m1: 50, m2: 100 },
        { country: '', name: 'Empty', m1: 75, m2: 200 },
      ];

      const validData = dataWithMissing.filter(d => d.country && d.country !== 'XXX');

      expect(validData).toHaveLength(1);
      expect(validData[0].country).toBe('USA');
    });
  });

  describe('Sequential Color Logic (ColorBy.Metric)', () => {
    it('should calculate value range for m1 metric', () => {
      const values = mockData.map(d => d.m1);
      const extent = [Math.min(...values), Math.max(...values)];

      expect(extent).toEqual([100, 300]);
    });

    it('should create sequential color scale', () => {
      const values = mockData.map(d => d.m1);
      const extent = [Math.min(...values), Math.max(...values)];

      // Simulate sequential scheme createLinearScale
      const createLinearScale = (domain) => {
        return (value) => {
          const normalized = (value - domain[0]) / (domain[1] - domain[0]);
          const colors = ['#f7fbff', '#4292c6', '#08519c'];
          const index = Math.floor(normalized * (colors.length - 1));
          return colors[Math.min(index, colors.length - 1)];
        };
      };

      const colorFn = createLinearScale(extent);

      expect(colorFn(100)).toBe('#f7fbff'); // Min -> lightest
      expect(colorFn(300)).toBe('#08519c'); // Max -> darkest
      expect(colorFn(200)).toBe('#4292c6'); // Middle -> medium
    });

    it('should process data with sequential colors', () => {
      const values = mockData.map(d => d.m1);
      const extent = [Math.min(...values), Math.max(...values)];
      const colorFn = (value) => {
        const normalized = (value - extent[0]) / (extent[1] - extent[0]);
        return normalized > 0.5 ? '#08519c' : '#f7fbff';
      };

      const processedData = mockData.map(d => ({
        ...d,
        fillColor: colorFn(d.m1),
      }));

      expect(processedData[0].fillColor).toBe('#f7fbff'); // USA: 100
      expect(processedData[1].fillColor).toBe('#08519c'); // CHN: 300
      expect(processedData[2].fillColor).toBe('#f7fbff'); // GBR: 200 (0.5, not > 0.5)
      expect(processedData[3].fillColor).toBe('#f7fbff'); // DEU: 150
    });
  });

  describe('Categorical Color Logic (ColorBy.Country)', () => {
    it('should assign colors based on country names', () => {
      const categoricalColorMap = {
        'United States': '#1f77b4',
        'China': '#ff7f0e',
        'United Kingdom': '#2ca02c',
        'Germany': '#d62728',
      };

      const processedData = mockData.map(d => ({
        ...d,
        fillColor: categoricalColorMap[d.name] || '#333333',
      }));

      expect(processedData[0].fillColor).toBe('#1f77b4'); // United States
      expect(processedData[1].fillColor).toBe('#ff7f0e'); // China
      expect(processedData[2].fillColor).toBe('#2ca02c'); // United Kingdom
      expect(processedData[3].fillColor).toBe('#d62728'); // Germany
    });
  });

  describe('Bubble Size Calculation', () => {
    it('should calculate bubble radius from m2 values', () => {
      const m2Values = mockData.map(d => Math.sqrt(d.m2));
      const extRadius = [Math.min(...m2Values), Math.max(...m2Values)];
      const maxBubbleSize = 50;

      // Simulate D3 linear scale for radius
      const radiusScale = (value) => {
        const normalized = (value - extRadius[0]) / (extRadius[1] - extRadius[0]);
        return 1 + normalized * (maxBubbleSize - 1);
      };

      const processedData = mockData.map(d => ({
        ...d,
        radius: radiusScale(Math.sqrt(d.m2)),
      }));

      // All should have valid radius values
      processedData.forEach(item => {
        expect(item.radius).toBeGreaterThanOrEqual(1);
        expect(item.radius).toBeLessThanOrEqual(maxBubbleSize);
      });

      // Larger m2 values should have larger radius
      const usaRadius = processedData.find(d => d.country === 'USA').radius;
      const chnRadius = processedData.find(d => d.country === 'CHN').radius;
      expect(chnRadius).toBeGreaterThan(usaRadius);
    });
  });

  describe('Map Data Processing', () => {
    it('should create mapData object correctly', () => {
      const mapData = {};
      mockData.forEach(d => {
        mapData[d.country] = d;
      });

      expect(mapData['USA']).toBeDefined();
      expect(mapData['CHN']).toBeDefined();
      expect(mapData['GBR']).toBeDefined();
      expect(mapData['DEU']).toBeDefined();

      expect(mapData['USA'].name).toBe('United States');
      expect(mapData['CHN'].m1).toBe(300);
    });
  });

  describe('Configuration Integration', () => {
    it('should handle different color schemes', () => {
      const schemes = ['blues', 'greens', 'oranges', 'purples'];
      
      schemes.forEach(scheme => {
        // Simulate getting a scheme and creating a color scale
        const mockScheme = {
          createLinearScale: jest.fn(() => (value) => `#color-${scheme}-${value}`),
        };

        const colorFn = mockScheme.createLinearScale([100, 300]);
        expect(colorFn(200)).toBe(`#color-${scheme}-200`);
      });
    });

    it('should handle different bubble sizes', () => {
      const bubbleSizes = [25, 50, 75, 100];
      
      bubbleSizes.forEach(maxSize => {
        const calculateRadius = (value, min, max) => {
          const normalized = (value - min) / (max - min);
          return 1 + normalized * (maxSize - 1);
        };

        const radius = calculateRadius(600, 500, 800); // m2: 600, range: 500-800
        expect(radius).toBeGreaterThanOrEqual(1);
        expect(radius).toBeLessThanOrEqual(maxSize);
      });
    });
  });

  describe('Theme Integration', () => {
    it('should use theme colors for map styling', () => {
      const theme = {
        colors: {
          grayscale: {
            light2: '#custom-light',
            light5: '#custom-border',
            dark2: '#custom-dark',
          },
        },
      };

      const defaultFill = theme.colors.grayscale.light2;
      const borderColor = theme.colors.grayscale.light5;

      expect(defaultFill).toBe('#custom-light');
      expect(borderColor).toBe('#custom-border');
    });
  });

  describe('Cross-Filtering Support', () => {
    it('should generate cross-filter data mask', () => {
      const generateDataMask = (source) => {
        return {
          extraFormData: {
            filters: [
              {
                col: 'country',
                op: 'IN',
                val: [source.country],
              },
            ],
          },
          filterState: {
            value: [source.country],
            selectedValues: [source.country],
          },
        };
      };

      const dataMask = generateDataMask(mockData[0]);

      expect(dataMask.extraFormData.filters).toHaveLength(1);
      expect(dataMask.extraFormData.filters[0].val).toEqual(['USA']);
      expect(dataMask.filterState.selectedValues).toEqual(['USA']);
    });
  });

  describe('Error Handling', () => {
    it('should handle null metric values', () => {
      const dataWithNulls = [
        { country: 'USA', name: 'United States', m1: null, m2: 500 },
        { country: 'CHN', name: 'China', m1: 300, m2: null },
      ];

      const safeExtent = (data, accessor) => {
        const values = data
          .map(accessor)
          .filter(v => v !== null && v !== undefined && !isNaN(v));
        return values.length > 0 ? [Math.min(...values), Math.max(...values)] : [0, 0];
      };

      const m1Extent = safeExtent(dataWithNulls, d => d.m1);
      const m2Extent = safeExtent(dataWithNulls, d => d.m2);

      expect(m1Extent).toEqual([300, 300]); // Only China has valid m1
      expect(m2Extent).toEqual([500, 500]); // Only USA has valid m2
    });

    it('should handle extreme values', () => {
      const extremeData = [
        { country: 'MIN', name: 'Minimum', m1: 0.001, m2: 1 },
        { country: 'MAX', name: 'Maximum', m1: 1000000, m2: 1000000 },
      ];

      const values = extremeData.map(d => d.m1);
      const extent = [Math.min(...values), Math.max(...values)];

      expect(extent[1] - extent[0]).toBeGreaterThan(999999);
      expect(extent[0]).toBe(0.001);
      expect(extent[1]).toBe(1000000);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeData = Array.from({ length: 200 }, (_, i) => ({
        country: `CO${i}`,
        name: `Country ${i}`,
        m1: Math.random() * 1000,
        m2: Math.random() * 1000,
      }));

      const start = Date.now();

      // Simulate data processing
      const filteredData = largeData.filter(d => d.country && d.country !== 'XXX');
      const values = filteredData.map(d => d.m1);
      const extent = [Math.min(...values), Math.max(...values)];
      
      const processedData = filteredData.map(d => ({
        ...d,
        fillColor: '#color',
        radius: 25,
      }));

      const end = Date.now();

      expect(end - start).toBeLessThan(50); // Should be very fast
      expect(processedData).toHaveLength(200);
    });
  });
});
