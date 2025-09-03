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
  allocateEnhancedColors,
  extractThemeColors,
  expandColorPalette,
  createValueBasedColors,
  ensureUniqueColors,
  validateColorContrast,
  generateColorVariations,
  getColorAllocationSummary,
} from '../src/utils/enhancedColorUtils';

// Mock theme matching Superset's theme structure
const mockTheme = {
  colors: {
    primary: {
      base: '#20A7C9',
      dark1: '#1A85A0', 
      dark2: '#156378',
      light1: '#79CADE',
      light2: '#A5DAE9',
      light3: '#D2EDF4',
      light4: '#E9F6F9',
      light5: '#F3F8FA',
    },
    secondary: {
      base: '#444E7C',
      dark1: '#363E63',
      dark2: '#282E4A',
      dark3: '#1B1F31',
      light1: '#8E94B0',
      light2: '#B4B8CA',
      light3: '#D9DBE4',
      light4: '#ECEEF2',
      light5: '#F5F5F8',
    },
    success: {
      base: '#5AC189',
      dark1: '#439066',
      dark2: '#2B6144',
      light1: '#ACE1C4',
      light2: '#EEF8F3',
    },
    warning: {
      base: '#FF7F44',
      dark1: '#BF5E33',
      dark2: '#7F3F21',
      light1: '#FEC0A1',
      light2: '#FFF2EC',
    },
    error: {
      base: '#E04355',
      dark1: '#A7323F',
      dark2: '#6F212A',
      light1: '#EFA1AA',
      light2: '#FAEDEE',
    },
    alert: {
      base: '#FCC700',
      dark1: '#BC9501',
      dark2: '#7D6300',
      light1: '#FDE380',
      light2: '#FEF9E6',
    },
    info: {
      base: '#66BCFE',
      dark1: '#4D8CBE',
      dark2: '#315E7E',
      light1: '#B3DEFE',
      light2: '#EFF8FE',
    },
    grayscale: {
      base: '#666666',
      dark1: '#323232',
      dark2: '#000000',
      light1: '#B2B2B2',
      light2: '#E0E0E0',
      light3: '#F0F0F0',
      light4: '#F7F7F7',
      light5: '#FFFFFF',
    },
  },
};

describe('Enhanced Color Allocation', () => {
  describe('Theme Color Extraction', () => {
    it('should extract correct theme colors in order', () => {
      const themeColors = extractThemeColors(mockTheme);
      
      expect(themeColors).toHaveLength(7);
      expect(themeColors[0]).toBe('#20A7C9'); // Primary
      expect(themeColors[1]).toBe('#444E7C'); // Secondary
      expect(themeColors[2]).toBe('#5AC189'); // Success
      expect(themeColors[3]).toBe('#FF7F44'); // Warning
      expect(themeColors[4]).toBe('#E04355'); // Error
      expect(themeColors[5]).toBe('#FCC700'); // Alert
      expect(themeColors[6]).toBe('#66BCFE'); // Info
    });
  });

  describe('Color Uniqueness - Critical Requirement', () => {
    it('should ensure no two sections get the same color with 6 theme colors and 11 sections', () => {
      const result = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 11,
        useValueBasedColors: false,
        avoidCollisions: true,
      });

      // Verify we have 11 unique colors
      expect(result.colors).toHaveLength(11);
      
      // Check for uniqueness - NO TWO SECTIONS SHOULD HAVE SAME COLOR
      const uniqueColors = new Set(result.colors);
      expect(uniqueColors.size).toBe(11); // All colors must be unique
      
      // Verify expansion happened
      expect(result.isExpanded).toBe(true);
      expect(result.expandedFromCount).toBe(7); // 7 theme colors expanded to 11
      
      console.log('11 Sections Color Allocation:');
      result.colors.forEach((color, index) => {
        console.log(`  Section ${index + 1}: ${color}`);
      });
    });

    it('should handle extreme case: 20 sections with 6 theme colors', () => {
      const result = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 20,
        useValueBasedColors: false,
        avoidCollisions: true,
      });

      expect(result.colors).toHaveLength(20);
      
      // CRITICAL: All colors must be unique
      const uniqueColors = new Set(result.colors);
      expect(uniqueColors.size).toBe(20);
      
      expect(result.isExpanded).toBe(true);
      expect(result.expandedFromCount).toBe(7);
    });

    it('should ensure uniqueness in value-based colors', () => {
      const values = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0.5]; // 11 different values
      
      const result = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 11,
        useValueBasedColors: true,
        values,
        avoidCollisions: true,
      });

      expect(result.colors).toHaveLength(11);
      
      // Even with value-based colors, all should be unique
      const uniqueColors = new Set(result.colors);
      expect(uniqueColors.size).toBe(11);
    });

    it('should handle duplicate values in value-based coloring', () => {
      const values = [10, 10, 10, 5, 5, 1, 1, 1, 1]; // Many duplicates
      
      const result = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 9,
        useValueBasedColors: true,
        values,
        avoidCollisions: true,
      });

      expect(result.colors).toHaveLength(9);
      
      // Even with duplicate values, colors should be unique
      const uniqueColors = new Set(result.colors);
      expect(uniqueColors.size).toBe(9);
    });
  });

  describe('Color Expansion Logic', () => {
    it('should create variations when sections exceed theme colors', () => {
      const themeColors = extractThemeColors(mockTheme);
      const expandedColors = expandColorPalette(themeColors, 15, mockTheme);
      
      expect(expandedColors).toHaveLength(15);
      
      // First 7 should be original theme colors
      themeColors.forEach((color, index) => {
        expect(expandedColors[index]).toBe(color);
      });
      
      // Additional colors should be variations
      expect(expandedColors.length).toBeGreaterThan(themeColors.length);
    });

    it('should generate color variations correctly', () => {
      const baseColor = '#20A7C9';
      const variations = generateColorVariations(baseColor, 5);
      
      expect(variations).toHaveLength(5);
      expect(variations[0]).not.toBe(variations[1]); // Should be different
      expect(variations[0]).not.toBe(variations[4]); // Should be different
      
      // All should be valid hex colors
      variations.forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe('Value-Based Color Creation', () => {
    it('should create sequential colors based on values', () => {
      const values = [1, 5, 10];
      const colors = createValueBasedColors(values, mockTheme);
      
      expect(colors).toHaveLength(3);
      
      // Colors should be different for different values
      expect(colors[0]).not.toBe(colors[1]);
      expect(colors[1]).not.toBe(colors[2]);
      expect(colors[0]).not.toBe(colors[2]);
    });

    it('should handle edge case: all same values', () => {
      const values = [5, 5, 5, 5];
      const colors = createValueBasedColors(values, mockTheme);
      
      expect(colors).toHaveLength(4);
      // When all values are same, should use base color
      colors.forEach(color => {
        expect(color).toBe(mockTheme.colors.primary.base);
      });
    });
  });

  describe('Color Collision Avoidance', () => {
    it('should detect and fix color collisions', () => {
      const collidingColors = [
        '#FF0000',
        '#FF0000', // Duplicate
        '#00FF00',
        '#FF0000', // Another duplicate
        '#0000FF',
      ];
      
      const uniqueColors = ensureUniqueColors(collidingColors);
      
      expect(uniqueColors).toHaveLength(5);
      
      // All colors should be unique
      const uniqueSet = new Set(uniqueColors);
      expect(uniqueSet.size).toBe(5);
      
      // First color should remain unchanged
      expect(uniqueColors[0]).toBe('#FF0000');
      
      // Duplicates should be modified
      expect(uniqueColors[1]).not.toBe('#FF0000');
      expect(uniqueColors[3]).not.toBe('#FF0000');
      expect(uniqueColors[1]).not.toBe(uniqueColors[3]); // Should be different from each other
    });
  });

  describe('Color Contrast Validation', () => {
    it('should calculate color contrast correctly', () => {
      const whiteBlackContrast = validateColorContrast('#FFFFFF', '#000000');
      const sameColorContrast = validateColorContrast('#FF0000', '#FF0000');
      
      expect(whiteBlackContrast).toBeGreaterThan(10); // High contrast
      expect(sameColorContrast).toBe(1); // Same color = no contrast
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle pie chart with a=10, b=9, c=1 (your example)', () => {
      const values = [10, 9, 1];
      const names = ['a', 'b', 'c'];
      
      // Categorical colors
      const categoricalResult = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 3,
        useValueBasedColors: false,
        avoidCollisions: true,
      });
      
      expect(categoricalResult.colors).toHaveLength(3);
      const uniqueCategorical = new Set(categoricalResult.colors);
      expect(uniqueCategorical.size).toBe(3); // All unique
      
      // Value-based colors
      const valueBasedResult = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 3,
        useValueBasedColors: true,
        values,
        avoidCollisions: true,
      });
      
      expect(valueBasedResult.colors).toHaveLength(3);
      const uniqueValueBased = new Set(valueBasedResult.colors);
      expect(uniqueValueBased.size).toBe(3); // All unique
      
      console.log('Pie Chart Example (a=10, b=9, c=1):');
      console.log('Categorical:', categoricalResult.colors);
      console.log('Value-based:', valueBasedResult.colors);
    });

    it('should handle dashboard with many charts', () => {
      // Simulate a dashboard with multiple charts having different section counts
      const chartConfigs = [
        { sections: 5, name: 'Chart 1' },
        { sections: 8, name: 'Chart 2' },
        { sections: 12, name: 'Chart 3' },
        { sections: 15, name: 'Chart 4' },
      ];
      
      chartConfigs.forEach(config => {
        const result = allocateEnhancedColors({
          theme: mockTheme,
          sectionCount: config.sections,
          useValueBasedColors: false,
          avoidCollisions: true,
        });
        
        expect(result.colors).toHaveLength(config.sections);
        
        // CRITICAL: All colors must be unique within each chart
        const uniqueColors = new Set(result.colors);
        expect(uniqueColors.size).toBe(config.sections);
        
        console.log(`${config.name} (${config.sections} sections): ${result.isExpanded ? 'Expanded' : 'Theme colors'}`);
      });
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large number of sections efficiently', () => {
      const startTime = performance.now();
      
      const result = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 100,
        useValueBasedColors: false,
        avoidCollisions: true,
      });
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      expect(result.colors).toHaveLength(100);
      const uniqueColors = new Set(result.colors);
      expect(uniqueColors.size).toBe(100); // All unique
      
      expect(executionTime).toBeLessThan(100); // Should complete in under 100ms
      
      console.log(`100 sections processed in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Color Allocation Summary', () => {
    it('should provide informative summary', () => {
      const result = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 11,
        useValueBasedColors: false,
        avoidCollisions: true,
      });
      
      const summary = getColorAllocationSummary(result);
      
      expect(summary).toContain('Allocated 11 colors');
      expect(summary).toContain('Expanded from 7 theme colors to 11 total colors');
      
      // Should list all colors
      result.colors.forEach(color => {
        expect(summary).toContain(color);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero sections', () => {
      const result = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 0,
        useValueBasedColors: false,
        avoidCollisions: true,
      });
      
      expect(result.colors).toHaveLength(0);
      expect(result.isExpanded).toBe(false);
    });

    it('should handle single section', () => {
      const result = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 1,
        useValueBasedColors: false,
        avoidCollisions: true,
      });
      
      expect(result.colors).toHaveLength(1);
      expect(result.colors[0]).toBe(mockTheme.colors.primary.base);
    });

    it('should handle empty values array for value-based colors', () => {
      const result = allocateEnhancedColors({
        theme: mockTheme,
        sectionCount: 3,
        useValueBasedColors: true,
        values: [],
        avoidCollisions: true,
      });
      
      expect(result.colors).toHaveLength(3);
      // Should fallback to categorical colors
      const uniqueColors = new Set(result.colors);
      expect(uniqueColors.size).toBe(3);
    });
  });
});
