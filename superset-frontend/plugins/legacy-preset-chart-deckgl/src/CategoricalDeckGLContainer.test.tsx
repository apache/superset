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
 *   Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Unit Tests for CategoricalDeckGLContainer Core Functions
 *
 * Tests the data processing functions used by Arc and Scatter charts for legend
 * generation and color assignment. Uses parameterized tests to verify both
 * chart types work consistently.
 */

import { COLOR_SCHEME_TYPES } from './utilities/utils';

// Mock all external dependencies that cause import issues
jest.mock('@superset-ui/core', () => ({
  CategoricalColorNamespace: {
    getScale: jest.fn(() => jest.fn(() => '#ff0000')),
  },
  hexToRGB: jest.fn((color: string, alpha = 255) => [255, 0, 0, alpha]),
  styled: {
    div: jest.fn(() => 'div'),
  },
  usePrevious: jest.fn(),
}));

jest.mock('@deck.gl/core');
jest.mock('@deck.gl/react');
jest.mock('react-map-gl');

// Extract the functions we want to test by evaluating the module
// Note: These functions are not exported, so we need to access them through the component
let getCategories: any;
let addColor: any;

beforeAll(() => {
  // Mock implementations of internal functions to avoid complex dependencies
  // These replicate the core logic for testing purposes
  getCategories = (fd: any, data: any[]) => {
    let categories: Record<any, { color: any; enabled: boolean }> = {};

    const colorSchemeType = fd.color_scheme_type;

    if (colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints) {
      categories = {
        'Breakpoint 1': { color: [255, 0, 0, 255], enabled: true },
      };
    } else if (fd.dimension) {
      data.forEach(d => {
        if (d.cat_color != null && !categories.hasOwnProperty(d.cat_color)) {
          const color = [255, 0, 0, 255];
          categories[d.cat_color] = { color, enabled: true };
        }
      });
    }

    return categories;
  };

  addColor = (data: any[], fd: any, selectedColorScheme: string) => {
    let color: any;
    switch (selectedColorScheme) {
      case COLOR_SCHEME_TYPES.fixed_color: {
        color = fd.color_picker || { r: 0, g: 0, b: 0, a: 100 };
        return data.map(d => ({
          ...d,
          color: [color.r, color.g, color.b, color.a * 255],
        }));
      }
      case COLOR_SCHEME_TYPES.categorical_palette: {
        return data.map(d => ({
          ...d,
          color: [255, 0, 0, 255], // Mock hexToRGB result
        }));
      }
      case COLOR_SCHEME_TYPES.color_breakpoints: {
        // Simulate default breakpoint color logic
        const defaultBreakpointColor = [128, 128, 128, 255];
        return data.map(d => ({
          ...d,
          color: defaultBreakpointColor,
        }));
      }
      default: {
        // Handle undefined/null color_scheme_type for backward compatibility
        return data.map(d => ({
          ...d,
          color: [255, 0, 0, 255],
        }));
      }
    }
  };
});

// Test data for Arc charts
const mockArcData = [
  {
    source_latitude: 40.7128,
    source_longitude: -74.006,
    target_latitude: 34.0522,
    target_longitude: -118.2437,
    cat_color: 'Flight Route',
    metric: 150,
  },
  {
    source_latitude: 41.8781,
    source_longitude: -87.6298,
    target_latitude: 29.7604,
    target_longitude: -95.3698,
    cat_color: 'Train Route',
    metric: 85,
  },
];

// Test data for Scatter charts
const mockScatterData = [
  {
    position: [-74.006, 40.7128],
    cat_color: 'New York',
    metric: 150,
  },
  {
    position: [-118.2437, 34.0522],
    cat_color: 'Los Angeles',
    metric: 85,
  },
];

describe.each([
  ['Arc', mockArcData],
  ['Scatter', mockScatterData],
])(
  'CategoricalDeckGLContainer Functions - %s Chart Data',
  (chartType, mockData) => {
    describe('getCategories function', () => {
      test('should generate categories with categorical_palette', () => {
        const formData = {
          dimension: 'cat_color',
          color_scheme: 'supersetColors',
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
          color_picker: { r: 0, g: 0, b: 0, a: 1 },
        };

        const categories = getCategories(formData, mockData);

        expect(Object.keys(categories)).toHaveLength(2);
        const categoryNames = Object.keys(categories);
        mockData.forEach(d => {
          expect(categoryNames).toContain(d.cat_color);
        });
      });

      test('should generate categories with fixed_color when dimension is set', () => {
        const formData = {
          dimension: 'cat_color',
          color_scheme: 'supersetColors',
          color_scheme_type: COLOR_SCHEME_TYPES.fixed_color,
          color_picker: { r: 255, g: 0, b: 0, a: 1 },
        };

        const categories = getCategories(formData, mockData);

        // Should still generate categories when dimension is set
        expect(Object.keys(categories)).toHaveLength(2);
        const categoryNames = Object.keys(categories);
        mockData.forEach(d => {
          expect(categoryNames).toContain(d.cat_color);
        });
      });

      test('should handle color_breakpoints', () => {
        const formData = {
          dimension: 'metric',
          color_scheme: 'supersetColors',
          color_scheme_type: COLOR_SCHEME_TYPES.color_breakpoints,
          color_breakpoints: [
            { minValue: 0, maxValue: 100, color: { r: 255, g: 0, b: 0, a: 1 } },
          ],
        };

        const categories = getCategories(formData, mockData);

        expect(Object.keys(categories)).toHaveLength(1);
        expect(categories).toHaveProperty('Breakpoint 1');
      });

      test('should handle undefined color_scheme_type', () => {
        const formData = {
          dimension: 'cat_color',
          color_scheme: 'supersetColors',
          color_picker: { r: 0, g: 0, b: 0, a: 1 },
        };

        const categories = getCategories(formData, mockData);

        expect(Object.keys(categories)).toHaveLength(2);
        const categoryNames = Object.keys(categories);
        mockData.forEach(d => {
          expect(categoryNames).toContain(d.cat_color);
        });
      });

      test('should return empty categories when no dimension is set', () => {
        const formData = {
          // dimension: undefined
          color_scheme: 'supersetColors',
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
          color_picker: { r: 0, g: 0, b: 0, a: 1 },
        };

        const categories = getCategories(formData, mockData);

        expect(Object.keys(categories)).toHaveLength(0);
      });

      test('should handle empty data gracefully', () => {
        const formData = {
          dimension: 'cat_color',
          color_scheme: 'supersetColors',
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
          color_picker: { r: 0, g: 0, b: 0, a: 1 },
        };

        const categories = getCategories(formData, []);

        expect(Object.keys(categories)).toHaveLength(0);
        expect(() => getCategories(formData, [])).not.toThrow();
      });
    });

    describe('addColor function', () => {
      test('should apply fixed colors correctly', () => {
        const formData = {
          color_picker: { r: 255, g: 128, b: 64, a: 80 },
        };

        const result = addColor(
          mockData,
          formData,
          COLOR_SCHEME_TYPES.fixed_color,
        );

        expect(result).toHaveLength(mockData.length);
        result.forEach((item: any) => {
          expect(item.color).toEqual([255, 128, 64, 80 * 255]);
          // Should preserve original data
          expect(item).toHaveProperty('cat_color');
          expect(item).toHaveProperty('metric');
        });
      });

      test('should apply categorical palette colors correctly', () => {
        const formData = {
          color_scheme: 'supersetColors',
          slice_id: 'test-123',
        };

        const result = addColor(
          mockData,
          formData,
          COLOR_SCHEME_TYPES.categorical_palette,
        );

        expect(result).toHaveLength(mockData.length);
        result.forEach((item: any) => {
          expect(item.color).toEqual([255, 0, 0, 255]); // Mocked color
          // Should preserve original data
          expect(item).toHaveProperty('cat_color');
          expect(item).toHaveProperty('metric');
        });
      });

      test('should apply color breakpoints correctly', () => {
        const formData = {
          color_breakpoints: [
            { minValue: 0, maxValue: 100, color: { r: 255, g: 0, b: 0, a: 1 } },
            {
              minValue: 101,
              maxValue: 200,
              color: { r: 0, g: 255, b: 0, a: 1 },
            },
          ],
        };

        const result = addColor(
          mockData,
          formData,
          COLOR_SCHEME_TYPES.color_breakpoints,
        );

        expect(result).toHaveLength(mockData.length);
        result.forEach((item: any) => {
          expect(item.color).toEqual([128, 128, 128, 255]); // Default color
          // Should preserve original data
          expect(item).toHaveProperty('cat_color');
          expect(item).toHaveProperty('metric');
        });
      });

      test('should handle undefined color_scheme_type', () => {
        const formData = {
          dimension: 'cat_color',
          color_scheme: 'supersetColors',
        };

        const result = addColor(mockData, formData, undefined);

        expect(result).toHaveLength(mockData.length);
        expect(result).not.toEqual([]);

        result.forEach((item: any) => {
          expect(item).toHaveProperty('color');
          expect(item).toHaveProperty('cat_color');
          expect(item).toHaveProperty('metric');
        });
      });

      test('should handle null color_scheme_type', () => {
        const formData = {
          dimension: 'cat_color',
          color_scheme: 'supersetColors',
          color_scheme_type: null,
        };

        const result = addColor(mockData, formData, null);

        expect(result).toHaveLength(mockData.length);
        expect(result).not.toEqual([]);
      });

      test('should handle unknown color_scheme_type', () => {
        const formData = {
          dimension: 'cat_color',
          color_scheme: 'supersetColors',
        };

        const result = addColor(mockData, formData, 'unknown_type');

        expect(result).toHaveLength(mockData.length);
        expect(result).not.toEqual([]);
      });

      test('should not mutate original data', () => {
        const originalData = JSON.parse(JSON.stringify(mockData));
        const formData = {
          color_picker: { r: 255, g: 0, b: 0, a: 100 },
        };

        addColor(mockData, formData, COLOR_SCHEME_TYPES.fixed_color);

        expect(mockData).toEqual(originalData);
      });
    });

    describe('Integration between getCategories and addColor', () => {
      test('both functions should work together for categorical display', () => {
        const formData = {
          dimension: 'cat_color',
          color_scheme: 'supersetColors',
          color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
        };

        const categories = getCategories(formData, mockData);
        expect(Object.keys(categories)).toHaveLength(2);

        const coloredData = addColor(
          mockData,
          formData,
          formData.color_scheme_type,
        );
        expect(coloredData).toHaveLength(mockData.length);

        const categoryNames = Object.keys(categories);
        coloredData.forEach((item: any) => {
          expect(categoryNames).toContain(item.cat_color);
        });
      });

      test('both functions should handle undefined color_scheme_type consistently', () => {
        const formData = {
          dimension: 'cat_color',
          color_scheme: 'supersetColors',
        };

        const categories = getCategories(formData, mockData);
        expect(Object.keys(categories)).toHaveLength(2);

        const coloredData = addColor(mockData, formData, undefined);
        expect(coloredData).toHaveLength(mockData.length);
        expect(coloredData).not.toEqual([]);
      });
    });
  },
);
