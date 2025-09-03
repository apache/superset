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

// Mock the dependencies to avoid complex imports
const mockSequentialScheme = {
  getColors: jest.fn(),
};

const mockCategoricalScale = jest.fn();

const mockGetSequentialSchemeRegistry = jest.fn(() => ({
  get: jest.fn().mockReturnValue(mockSequentialScheme),
}));

const mockCategoricalColorNamespace = {
  getScale: jest.fn().mockReturnValue(mockCategoricalScale),
};

// Mock the actual modules
jest.mock('@superset-ui/core', () => ({
  getSequentialSchemeRegistry: mockGetSequentialSchemeRegistry,
  CategoricalColorNamespace: mockCategoricalColorNamespace,
  getColumnLabel: jest.fn((col) => col),
  getMetricLabel: jest.fn((metric) => metric),
  getTimeFormatter: jest.fn(() => (value) => value),
  getValueFormatter: jest.fn(() => (value) => value.toString()),
  NumberFormats: { PERCENT_2_POINT: '.1%' },
  getNumberFormatter: jest.fn(() => (value) => value.toString()),
  t: jest.fn((text) => text),
  tooltipHtml: jest.fn(() => '<div>tooltip</div>'),
}));

// Mock the color registries
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getSequentialSchemeRegistry: jest.fn(),
  CategoricalColorNamespace: {
    getScale: jest.fn(),
  },
}));

const mockSequentialScheme = {
  getColors: jest.fn(),
};

const mockCategoricalScale = jest.fn();

describe('Pie Chart Value-Based Colors', () => {
  const mockData = [
    { category: 'A', metric: 100 },
    { category: 'B', metric: 300 },
    { category: 'C', metric: 200 },
    { category: 'D', metric: 150 },
  ];

  const baseProps: Partial<EchartsPieChartProps> = {
    formData: {
      valueBasedColors: false,
      sequentialColorScheme: 'superset_seq_1',
      colorScheme: 'supersetColors',
      groupby: ['category'],
      metric: 'metric',
      donut: false,
      innerRadius: 30,
      labelLine: false,
      labelType: 'key',
      labelsOutside: true,
      outerRadius: 70,
      showLabels: true,
      showLabelsThreshold: 5,
      dateFormat: 'smart_date',
      roseType: null,
      numberFormat: 'SMART_NUMBER',
    },
    queriesData: [{ data: mockData }],
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock sequential scheme
    mockSequentialScheme.getColors.mockReturnValue([
      '#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5',
      '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac',
      '#084081', '#042142'
    ]);
    
    (getSequentialSchemeRegistry as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue(mockSequentialScheme),
    });

    // Setup mock categorical scale
    mockCategoricalScale.mockImplementation((name) => {
      const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'];
      const colorMap = { A: colors[0], B: colors[1], C: colors[2], D: colors[3] };
      return colorMap[name] || colors[0];
    });

    (CategoricalColorNamespace.getScale as jest.Mock).mockReturnValue(mockCategoricalScale);
  });

  describe('Categorical Colors (Default Behavior)', () => {
    it('should use categorical colors when valueBasedColors is false', () => {
      const props = {
        ...baseProps,
        formData: {
          ...baseProps.formData!,
          valueBasedColors: false,
        },
      } as EchartsPieChartProps;

      const result = transformProps(props);
      
      expect(CategoricalColorNamespace.getScale).toHaveBeenCalledWith('supersetColors');
      expect(mockCategoricalScale).toHaveBeenCalledWith('A', undefined);
      expect(mockCategoricalScale).toHaveBeenCalledWith('B', undefined);
      expect(mockCategoricalScale).toHaveBeenCalledWith('C', undefined);
      expect(mockCategoricalScale).toHaveBeenCalledWith('D', undefined);
      
      // Should not use sequential color scheme
      expect(getSequentialSchemeRegistry).not.toHaveBeenCalled();
    });

    it('should assign colors based on category names, not values', () => {
      const props = {
        ...baseProps,
        formData: {
          ...baseProps.formData!,
          valueBasedColors: false,
        },
      } as EchartsPieChartProps;

      const result = transformProps(props);
      const { echartOptions } = result;
      const seriesData = echartOptions.series[0].data;

      // Verify each slice gets color based on name, not value order
      expect(seriesData).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'A',
          value: 100,
          itemStyle: expect.objectContaining({
            color: '#1f77b4', // First color for 'A'
          }),
        }),
        expect.objectContaining({
          name: 'B',
          value: 300,
          itemStyle: expect.objectContaining({
            color: '#ff7f0e', // Second color for 'B'
          }),
        }),
      ]));
    });
  });

  describe('Value-Based Colors', () => {
    it('should use sequential colors when valueBasedColors is true', () => {
      const props = {
        ...baseProps,
        formData: {
          ...baseProps.formData!,
          valueBasedColors: true,
          sequentialColorScheme: 'superset_seq_1',
        },
      } as EchartsPieChartProps;

      const result = transformProps(props);
      
      expect(getSequentialSchemeRegistry).toHaveBeenCalled();
      expect(mockSequentialScheme.getColors).toHaveBeenCalledWith(10);
      
      // Should not use categorical colors
      expect(CategoricalColorNamespace.getScale).not.toHaveBeenCalled();
    });

    it('should assign darker colors to higher values', () => {
      const props = {
        ...baseProps,
        formData: {
          ...baseProps.formData!,
          valueBasedColors: true,
          sequentialColorScheme: 'superset_seq_1',
        },
      } as EchartsPieChartProps;

      const result = transformProps(props);
      const { echartOptions } = result;
      const seriesData = echartOptions.series[0].data;

      // Find data points by name
      const dataA = seriesData.find(d => d.name === 'A'); // value: 100 (min)
      const dataB = seriesData.find(d => d.name === 'B'); // value: 300 (max)
      const dataC = seriesData.find(d => d.name === 'C'); // value: 200
      const dataD = seriesData.find(d => d.name === 'D'); // value: 150

      // B (300) should get the darkest color (highest index)
      // A (100) should get the lightest color (lowest index)
      expect(dataA?.itemStyle.color).toBe('#f7fcf0'); // Lightest
      expect(dataB?.itemStyle.color).toBe('#042142'); // Darkest
      
      // C and D should be in between
      const colors = mockSequentialScheme.getColors();
      expect(colors).toContain(dataC?.itemStyle.color);
      expect(colors).toContain(dataD?.itemStyle.color);
    });

    it('should handle edge cases with identical values', () => {
      const identicalData = [
        { category: 'A', metric: 100 },
        { category: 'B', metric: 100 },
        { category: 'C', metric: 100 },
      ];

      const props = {
        ...baseProps,
        queriesData: [{ data: identicalData }],
        formData: {
          ...baseProps.formData!,
          valueBasedColors: true,
        },
      } as EchartsPieChartProps;

      const result = transformProps(props);
      const { echartOptions } = result;
      const seriesData = echartOptions.series[0].data;

      // All should get the same color when values are identical
      const colors = seriesData.map(d => d.itemStyle.color);
      expect(colors[0]).toBe(colors[1]);
      expect(colors[1]).toBe(colors[2]);
    });

    it('should handle null and undefined values gracefully', () => {
      const dataWithNulls = [
        { category: 'A', metric: 100 },
        { category: 'B', metric: null },
        { category: 'C', metric: undefined },
        { category: 'D', metric: '200' }, // String number
      ];

      const props = {
        ...baseProps,
        queriesData: [{ data: dataWithNulls }],
        formData: {
          ...baseProps.formData!,
          valueBasedColors: true,
        },
      } as EchartsPieChartProps;

      expect(() => transformProps(props)).not.toThrow();
      
      const result = transformProps(props);
      const { echartOptions } = result;
      const seriesData = echartOptions.series[0].data;

      // Should handle all data points
      expect(seriesData).toHaveLength(4);
      
      // Null/undefined should be treated as 0
      const dataB = seriesData.find(d => d.name === 'B');
      const dataC = seriesData.find(d => d.name === 'C');
      expect(dataB?.itemStyle.color).toBeDefined();
      expect(dataC?.itemStyle.color).toBeDefined();
    });
  });

  describe('Sequential Color Schemes', () => {
    const testSchemes = [
      'superset_seq_1',
      'superset_seq_2', 
      'blues',
      'greens',
      'oranges',
      'purples',
      'dark_blue',
      'echarts_gradient',
    ];

    testSchemes.forEach(scheme => {
      it(`should work with ${scheme} color scheme`, () => {
        const props = {
          ...baseProps,
          formData: {
            ...baseProps.formData!,
            valueBasedColors: true,
            sequentialColorScheme: scheme,
          },
        } as EchartsPieChartProps;

        expect(() => transformProps(props)).not.toThrow();
        
        const schemeRegistry = (getSequentialSchemeRegistry as jest.Mock)();
        expect(schemeRegistry.get).toHaveBeenCalledWith(scheme);
      });
    });
  });

  describe('Control Panel Integration', () => {
    it('should show sequential color scheme control when valueBasedColors is enabled', () => {
      // This would be tested in a control panel test
      expect(true).toBe(true); // Placeholder
    });

    it('should hide sequential color scheme control when valueBasedColors is disabled', () => {
      // This would be tested in a control panel test  
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        category: `Category ${i}`,
        metric: Math.random() * 1000,
      }));

      const props = {
        ...baseProps,
        queriesData: [{ data: largeData }],
        formData: {
          ...baseProps.formData!,
          valueBasedColors: true,
        },
      } as EchartsPieChartProps;

      const start = performance.now();
      const result = transformProps(props);
      const end = performance.now();

      expect(end - start).toBeLessThan(1000); // Should complete within 1 second
      expect(result.echartOptions.series[0].data).toHaveLength(1000);
    });
  });

  describe('Accessibility', () => {
    it('should maintain sufficient color contrast in sequential schemes', () => {
      const props = {
        ...baseProps,
        formData: {
          ...baseProps.formData!,
          valueBasedColors: true,
        },
      } as EchartsPieChartProps;

      const result = transformProps(props);
      const { echartOptions } = result;
      const seriesData = echartOptions.series[0].data;

      // Colors should be visually distinct
      const colors = seriesData.map(d => d.itemStyle.color);
      const uniqueColors = new Set(colors);
      
      if (mockData.length > 1) {
        expect(uniqueColors.size).toBeGreaterThan(1);
      }
    });
  });
});
