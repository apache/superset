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

import { SupersetTheme } from '@superset-ui/core';

export interface ColorAllocationOptions {
  theme: SupersetTheme;
  sectionCount: number;
  useValueBasedColors: boolean;
  values?: number[];
  colorScheme?: string;
  avoidCollisions: boolean;
}

export interface ColorAllocationResult {
  colors: string[];
  colorMap: Record<string, string>;
  isExpanded: boolean;
  expandedFromCount: number;
}

/**
 * Extract theme-based colors following dashboard theme
 */
export function extractThemeColors(theme: SupersetTheme): string[] {
  return [
    theme.colors.primary.base,      // #20A7C9 - Primary blue
    theme.colors.secondary.base,    // #444E7C - Secondary purple
    theme.colors.success.base,      // #5AC189 - Success green
    theme.colors.warning.base,      // #FF7F44 - Warning orange
    theme.colors.error.base,        // #E04355 - Error red
    theme.colors.alert.base,        // #FCC700 - Alert yellow
    theme.colors.info.base,         // #66BCFE - Info blue
  ];
}

/**
 * Generate lighter/darker variations of a color
 */
export function generateColorVariations(baseColor: string, count: number): string[] {
  // Convert hex to RGB
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const variations: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Create variations by adjusting lightness
    const factor = 0.3 + (i / (count - 1)) * 0.7; // Range from 30% to 100%
    
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);
    
    const newHex = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    variations.push(newHex);
  }
  
  return variations;
}

/**
 * Expand color palette when sections exceed available theme colors
 */
export function expandColorPalette(
  themeColors: string[], 
  requiredCount: number,
  theme: SupersetTheme
): string[] {
  if (requiredCount <= themeColors.length) {
    return themeColors.slice(0, requiredCount);
  }

  const expandedColors: string[] = [...themeColors];
  const additionalNeeded = requiredCount - themeColors.length;
  
  // Strategy 1: Create variations of existing theme colors
  const colorsPerVariation = Math.ceil(additionalNeeded / themeColors.length);
  
  themeColors.forEach(baseColor => {
    if (expandedColors.length >= requiredCount) return;
    
    const variations = generateColorVariations(baseColor, colorsPerVariation + 1);
    // Skip the first variation (original color) and add the rest
    variations.slice(1).forEach(variation => {
      if (expandedColors.length < requiredCount) {
        expandedColors.push(variation);
      }
    });
  });

  // Strategy 2: If still need more colors, use grayscale variations
  if (expandedColors.length < requiredCount) {
    const grayscaleColors = [
      theme.colors.grayscale.dark1,
      theme.colors.grayscale.base,
      theme.colors.grayscale.light1,
    ];
    
    grayscaleColors.forEach(color => {
      if (expandedColors.length < requiredCount) {
        expandedColors.push(color);
      }
    });
  }

  // Strategy 3: Final fallback - generate additional variations
  while (expandedColors.length < requiredCount) {
    const baseIndex = expandedColors.length % themeColors.length;
    const baseColor = themeColors[baseIndex];
    const variationIndex = Math.floor(expandedColors.length / themeColors.length) + 1;
    
    // Create progressively lighter variations
    const factor = Math.max(0.2, 1 - (variationIndex * 0.15));
    const hex = baseColor.replace('#', '');
    const r = Math.round(parseInt(hex.substr(0, 2), 16) * factor);
    const g = Math.round(parseInt(hex.substr(2, 2), 16) * factor);
    const b = Math.round(parseInt(hex.substr(4, 2), 16) * factor);
    
    const newColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    expandedColors.push(newColor);
  }

  return expandedColors;
}

/**
 * Create value-based sequential colors using theme colors as base
 */
export function createValueBasedColors(
  values: number[],
  theme: SupersetTheme,
  baseColorScheme?: string
): string[] {
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  
  // Use theme primary color as base for sequential scheme
  const baseColor = theme.colors.primary.base;
  const lightColor = theme.colors.primary.light4;
  const darkColor = theme.colors.primary.dark2;
  
  // Create a gradient from light to dark using theme colors
  const sequentialColors = [
    lightColor,           // Lightest
    theme.colors.primary.light3,
    theme.colors.primary.light2,
    theme.colors.primary.light1,
    baseColor,            // Base
    theme.colors.primary.dark1,
    darkColor,            // Darkest
  ];

  return values.map(value => {
    if (maxValue === minValue) {
      return baseColor; // All same value, use base color
    }
    
    const normalized = (value - minValue) / (maxValue - minValue);
    const colorIndex = Math.floor(normalized * (sequentialColors.length - 1));
    return sequentialColors[Math.min(colorIndex, sequentialColors.length - 1)];
  });
}

/**
 * Ensure no color collisions by checking and adjusting similar colors
 */
export function ensureUniqueColors(colors: string[]): string[] {
  const uniqueColors: string[] = [];
  const usedColors = new Set<string>();

  colors.forEach((color, index) => {
    let finalColor = color;
    let attempts = 0;
    
    // If color is already used, create a variation
    while (usedColors.has(finalColor.toLowerCase()) && attempts < 10) {
      // Create a slight variation by adjusting the color
      const hex = finalColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      // Adjust by small amounts to create unique but similar colors
      const adjustment = (attempts + 1) * 15;
      const newR = Math.min(255, Math.max(0, r + (attempts % 2 === 0 ? adjustment : -adjustment)));
      const newG = Math.min(255, Math.max(0, g + (attempts % 3 === 0 ? adjustment : -adjustment)));
      const newB = Math.min(255, Math.max(0, b + (attempts % 5 === 0 ? adjustment : -adjustment)));
      
      finalColor = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
      attempts++;
    }
    
    usedColors.add(finalColor.toLowerCase());
    uniqueColors.push(finalColor);
  });

  return uniqueColors;
}

/**
 * Main function to allocate colors with all enhancements
 */
export function allocateEnhancedColors(options: ColorAllocationOptions): ColorAllocationResult {
  const { theme, sectionCount, useValueBasedColors, values, avoidCollisions } = options;
  
  let colors: string[];
  let isExpanded = false;
  let expandedFromCount = 0;

  if (useValueBasedColors && values && values.length > 0) {
    // Value-based coloring using theme colors
    colors = createValueBasedColors(values, theme);
  } else {
    // Categorical coloring using theme colors (fallback for empty values)
    const themeColors = extractThemeColors(theme);
    
    if (sectionCount > themeColors.length) {
      colors = expandColorPalette(themeColors, sectionCount, theme);
      isExpanded = true;
      expandedFromCount = themeColors.length;
    } else {
      colors = themeColors.slice(0, sectionCount);
    }
  }

  // Ensure uniqueness if required
  if (avoidCollisions) {
    colors = ensureUniqueColors(colors);
  }

  // Create color map
  const colorMap: Record<string, string> = {};
  colors.forEach((color, index) => {
    colorMap[`section_${index}`] = color;
  });

  return {
    colors,
    colorMap,
    isExpanded,
    expandedFromCount,
  };
}

/**
 * Validate color contrast for accessibility
 */
export function validateColorContrast(color1: string, color2: string): number {
  // Simple contrast ratio calculation
  const getLuminance = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    const sRGB = [r, g, b].map(c => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Get color allocation summary for debugging
 */
export function getColorAllocationSummary(result: ColorAllocationResult): string {
  const { colors, isExpanded, expandedFromCount } = result;
  
  let summary = `Allocated ${colors.length} colors:\n`;
  colors.forEach((color, index) => {
    summary += `  ${index + 1}. ${color}\n`;
  });
  
  if (isExpanded) {
    summary += `\nExpanded from ${expandedFromCount} theme colors to ${colors.length} total colors.\n`;
  }
  
  return summary;
}
