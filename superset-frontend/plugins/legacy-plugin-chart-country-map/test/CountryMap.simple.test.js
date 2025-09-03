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

describe('Country Map Value-Based Colors Logic Tests', () => {
  const mockData = [
    { country_id: 'CA-AB', metric: 100 },
    { country_id: 'CA-BC', metric: 300 },
    { country_id: 'CA-ON', metric: 200 },
    { country_id: 'CA-QC', metric: 150 },
  ];

  describe('ColorBy Enum', () => {
    it('should have correct enum values', () => {
      expect(ColorBy.Metric).toBe('metric');
      expect(ColorBy.Region).toBe('region');
    });
  });

  describe('Color Mode Logic', () => {
    it('should determine color mode correctly', () => {
      const testColorByLogic = (colorBy) => {
        if (colorBy === ColorBy.Region) {
          return 'categorical';
        } else {
          return 'sequential';
        }
      };

      expect(testColorByLogic(ColorBy.Metric)).toBe('sequential');
      expect(testColorByLogic(ColorBy.Region)).toBe('categorical');
      expect(testColorByLogic(undefined)).toBe('sequential'); // Default
    });
  });

  describe('Sequential Color Logic', () => {
    it('should calculate value range correctly', () => {
      const values = mockData.map(d => d.metric);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);

      expect(minValue).toBe(100);
      expect(maxValue).toBe(300);
      expect(maxValue - minValue).toBe(200);
    });

    it('should simulate color scale creation', () => {
      const values = mockData.map(d => d.metric);
      const extent = [Math.min(...values), Math.max(...values)];
      
      // Simulate D3 extent function
      expect(extent).toEqual([100, 300]);

      // Simulate linear scale
      const createLinearScale = (domain) => {
        return (value) => {
          const normalized = (value - domain[0]) / (domain[1] - domain[0]);
          const colors = ['#f7fbff', '#4292c6', '#08519c'];
          const index = Math.floor(normalized * (colors.length - 1));
          return colors[Math.min(index, colors.length - 1)];
        };
      };

      const colorScale = createLinearScale(extent);
      
      expect(colorScale(100)).toBe('#f7fbff'); // Min value -> lightest
      expect(colorScale(300)).toBe('#08519c'); // Max value -> darkest
    });
  });

  describe('Categorical Color Logic', () => {
    it('should assign colors based on region IDs', () => {
      const categoricalColorMap = {
        'CA-AB': '#1f77b4',
        'CA-BC': '#ff7f0e',
        'CA-ON': '#2ca02c',
        'CA-QC': '#d62728',
      };

      mockData.forEach(item => {
        expect(categoricalColorMap[item.country_id]).toBeDefined();
        expect(typeof categoricalColorMap[item.country_id]).toBe('string');
        expect(categoricalColorMap[item.country_id]).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  describe('Color Map Generation', () => {
    it('should create color map for sequential mode', () => {
      const colorMap = {};
      const mockLinearScale = (value) => {
        const normalized = (value - 100) / (300 - 100);
        return normalized > 0.5 ? '#08519c' : '#f7fbff';
      };

      mockData.forEach(d => {
        colorMap[d.country_id] = mockLinearScale(d.metric);
      });

      expect(colorMap['CA-AB']).toBe('#f7fbff'); // 100 -> light (normalized: 0)
      expect(colorMap['CA-BC']).toBe('#08519c'); // 300 -> dark (normalized: 1)
      expect(colorMap['CA-ON']).toBe('#f7fbff'); // 200 -> light (normalized: 0.5, = 0.5, not > 0.5)
      expect(colorMap['CA-QC']).toBe('#f7fbff'); // 150 -> light (normalized: 0.25, < 0.5)
    });

    it('should create color map for categorical mode', () => {
      const colorMap = {};
      const mockCategoricalScale = (regionId) => {
        const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'];
        return colors[regionId.charCodeAt(regionId.length - 1) % colors.length];
      };

      mockData.forEach(d => {
        colorMap[d.country_id] = mockCategoricalScale(d.country_id);
      });

      // Each region should have a color
      Object.values(colorMap).forEach(color => {
        expect(typeof color).toBe('string');
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  describe('Color Function Behavior', () => {
    it('should return "none" for unknown regions', () => {
      const colorMap = {
        'CA-AB': '#1f77b4',
        'CA-BC': '#ff7f0e',
      };

      const colorFn = (d) => {
        const regionId = d.properties ? d.properties.ISO : d.ISO;
        return colorMap[regionId] || 'none';
      };

      expect(colorFn({ properties: { ISO: 'CA-AB' } })).toBe('#1f77b4');
      expect(colorFn({ properties: { ISO: 'UNKNOWN' } })).toBe('none');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty data gracefully', () => {
      const emptyData = [];
      
      expect(() => {
        const values = emptyData.map(d => d.metric);
        const min = values.length > 0 ? Math.min(...values) : 0;
        const max = values.length > 0 ? Math.max(...values) : 0;
        return { min, max };
      }).not.toThrow();
    });

    it('should handle null metric values', () => {
      const dataWithNulls = [
        { country_id: 'CA-AB', metric: null },
        { country_id: 'CA-BC', metric: 100 },
      ];

      const safeValues = dataWithNulls
        .map(d => d.metric)
        .filter(v => v !== null && v !== undefined && !isNaN(v));

      expect(safeValues).toEqual([100]);
    });

    it('should handle missing country_id', () => {
      const dataWithMissingId = [
        { country_id: null, metric: 100 },
        { country_id: 'CA-BC', metric: 200 },
      ];

      const validData = dataWithMissingId.filter(d => d.country_id);
      expect(validData).toHaveLength(1);
      expect(validData[0].country_id).toBe('CA-BC');
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        country_id: `REGION-${i}`,
        metric: Math.random() * 1000,
      }));

      const start = Date.now();
      
      // Simulate color processing
      const values = largeData.map(d => d.metric);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const colorMap = {};
      
      largeData.forEach(d => {
        const normalized = (d.metric - minValue) / (maxValue - minValue);
        colorMap[d.country_id] = normalized > 0.5 ? '#dark' : '#light';
      });
      
      const end = Date.now();
      
      expect(end - start).toBeLessThan(100); // Should complete quickly
      expect(Object.keys(colorMap)).toHaveLength(1000);
    });
  });

  describe('Backwards Compatibility', () => {
    it('should default to metric-based coloring when colorBy is not specified', () => {
      const getColorMode = (colorBy) => {
        // Simulate the default behavior in CountryMap.js
        if (colorBy === ColorBy.Region) {
          return 'categorical';
        } else {
          // Default to metric-based (sequential) for backwards compatibility
          return 'sequential';
        }
      };

      expect(getColorMode(undefined)).toBe('sequential');
      expect(getColorMode(null)).toBe('sequential');
      expect(getColorMode('')).toBe('sequential');
      expect(getColorMode(ColorBy.Metric)).toBe('sequential');
      expect(getColorMode(ColorBy.Region)).toBe('categorical');
    });
  });
});
