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

/**
 * WCAG 2.1 Accessibility utilities for theme contrast analysis.
 *
 * This module provides functions to analyze theme configurations for
 * accessibility compliance, specifically contrast ratios between
 * text and background colors.
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */

// eslint-disable-next-line no-restricted-syntax
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';

/**
 * WCAG contrast ratio requirements
 */
export const WCAG_REQUIREMENTS = {
  AA_NORMAL_TEXT: 4.5,
  AA_LARGE_TEXT: 3.0,
  AAA_NORMAL_TEXT: 7.0,
  AAA_LARGE_TEXT: 4.5,
} as const;

/**
 * Contrast issue severity levels
 */
export type ContrastSeverity = 'error' | 'warning';

/**
 * Represents a single contrast issue found during analysis
 */
export interface ContrastIssue {
  /** Token name of the foreground color (e.g., 'colorText') */
  foreground: string;
  /** Token name of the background color (e.g., 'colorBgBase') */
  background: string;
  /** Actual hex color value of the foreground */
  foregroundColor: string;
  /** Actual hex color value of the background */
  backgroundColor: string;
  /** Calculated contrast ratio */
  ratio: number;
  /** Required ratio for AA compliance */
  required: number;
  /** Severity: error (fails AA) or warning (fails AAA) */
  severity: ContrastSeverity;
  /** Human-readable description of the issue */
  description: string;
}

/**
 * WCAG compliance level
 */
export type WCAGLevel = 'AAA' | 'AA' | 'A' | 'Fail';

/**
 * Complete accessibility analysis result
 */
export interface AccessibilityAnalysis {
  /** Overall score from 0-100 */
  score: number;
  /** WCAG compliance level achieved */
  level: WCAGLevel;
  /** List of contrast issues found */
  issues: ContrastIssue[];
  /** Number of checks that passed AA requirements */
  passedChecks: number;
  /** Total number of contrast checks performed */
  totalChecks: number;
}

/**
 * Contrast pairs to check in theme analysis.
 * Each pair represents a foreground/background color combination
 * that should meet WCAG contrast requirements.
 */
const CONTRAST_PAIRS: Array<{
  foreground: string;
  background: string;
  description: string;
  isLargeText?: boolean;
}> = [
  {
    foreground: 'colorText',
    background: 'colorBgBase',
    description: 'Primary text on base background',
  },
  {
    foreground: 'colorText',
    background: 'colorBgContainer',
    description: 'Primary text on container background',
  },
  {
    foreground: 'colorTextSecondary',
    background: 'colorBgBase',
    description: 'Secondary text on base background',
  },
  {
    foreground: 'colorTextSecondary',
    background: 'colorBgContainer',
    description: 'Secondary text on container background',
  },
  {
    foreground: 'colorTextDescription',
    background: 'colorBgBase',
    description: 'Description text on base background',
  },
  {
    foreground: 'colorPrimary',
    background: 'colorBgBase',
    description: 'Primary color (buttons/links) on base background',
  },
  {
    foreground: 'colorPrimary',
    background: 'colorBgContainer',
    description: 'Primary color on container background',
  },
  {
    foreground: 'colorError',
    background: 'colorBgBase',
    description: 'Error text on base background',
  },
  {
    foreground: 'colorError',
    background: 'colorBgContainer',
    description: 'Error text on container background',
  },
  {
    foreground: 'colorWarning',
    background: 'colorBgBase',
    description: 'Warning text on base background',
  },
  {
    foreground: 'colorSuccess',
    background: 'colorBgBase',
    description: 'Success text on base background',
  },
  {
    foreground: 'colorLink',
    background: 'colorBgBase',
    description: 'Link text on base background',
  },
  {
    foreground: 'colorTextHeading',
    background: 'colorBgBase',
    description: 'Heading text on base background',
    isLargeText: true,
  },
];

/**
 * Converts a hex color string to RGB values (0-255).
 * Supports 3-char, 6-char, and 8-char (with alpha) hex formats.
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const cleanHex = hex.replace(/^#/, '');

  let fullHex = cleanHex;

  // Handle shorthand (#fff -> #ffffff)
  if (cleanHex.length === 3) {
    fullHex = cleanHex
      .split('')
      .map(c => c + c)
      .join('');
  }

  // Handle 8-char hex (with alpha) - just take the first 6 chars
  if (fullHex.length === 8) {
    fullHex = fullHex.substring(0, 6);
  }

  if (fullHex.length !== 6) {
    return null;
  }

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }

  return [r, g, b];
}

/**
 * Parses an rgba() color string to RGB values.
 */
function rgbaToRgb(rgba: string): [number, number, number] | null {
  const match = rgba.match(
    /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/,
  );
  if (!match) return null;
  return [
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    parseInt(match[3], 10),
  ];
}

/**
 * Converts any color format to a normalized hex string.
 * Handles hex (3, 6, or 8 char), rgb(), and rgba() formats.
 */
function normalizeColor(color: string): string | null {
  if (!color || typeof color !== 'string') return null;

  const trimmed = color.trim();

  // Handle hex colors
  if (trimmed.startsWith('#')) {
    const rgb = hexToRgb(trimmed);
    if (!rgb) return null;
    return `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }

  // Handle rgb/rgba colors
  if (trimmed.startsWith('rgb')) {
    const rgb = rgbaToRgb(trimmed);
    if (!rgb) return null;
    return `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;
  }

  return null;
}

/**
 * Converts algorithm string to Ant Design algorithm function(s).
 */
function getAlgorithm(
  algorithmConfig: string | string[] | undefined,
): ThemeConfig['algorithm'] {
  const { darkAlgorithm, compactAlgorithm, defaultAlgorithm } = antdTheme;

  if (!algorithmConfig) {
    return defaultAlgorithm;
  }

  const algorithms = Array.isArray(algorithmConfig)
    ? algorithmConfig
    : [algorithmConfig];

  const algorithmFns = algorithms
    .map(alg => {
      switch (alg) {
        case 'dark':
          return darkAlgorithm;
        case 'compact':
          return compactAlgorithm;
        default:
          return defaultAlgorithm;
      }
    })
    .filter(Boolean);

  return algorithmFns.length === 1 ? algorithmFns[0] : algorithmFns;
}

/**
 * Flattens nested color tokens from custom theme structures.
 * Handles formats like { neutrals: { colorText: '#000' }, brand: { colorPrimary: '#00f' } }
 */
function flattenColorTokens(
  themeConfig: Record<string, unknown>,
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  // First, add any root-level color tokens
  for (const [key, value] of Object.entries(themeConfig)) {
    if (key.startsWith('color') && typeof value === 'string') {
      flattened[key] = value;
    }
  }

  // Then, flatten nested objects that might contain color tokens
  for (const [, value] of Object.entries(themeConfig)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedObj = value as Record<string, unknown>;
      for (const [nestedKey, nestedValue] of Object.entries(nestedObj)) {
        if (nestedKey.startsWith('color') && typeof nestedValue === 'string') {
          // Don't overwrite if already exists (root takes precedence)
          if (!(nestedKey in flattened)) {
            flattened[nestedKey] = nestedValue;
          }
        }
      }
    }
  }

  return flattened;
}

/**
 * Resolves a theme configuration to computed design tokens using Ant Design.
 * This allows us to analyze themes that only define seed colors.
 * Also handles custom nested structures by flattening color tokens first.
 */
function resolveThemeTokens(
  themeConfig: Record<string, unknown>,
): Record<string, unknown> {
  // First, flatten any custom nested color structures
  const flattenedColors = flattenColorTokens(themeConfig);

  try {
    // Build Ant Design ThemeConfig from the user's config
    // Merge flattened colors with existing token object
    const tokenConfig = {
      ...(themeConfig.token as Record<string, unknown>),
      ...flattenedColors,
    };

    const antdConfig: ThemeConfig = {
      token: tokenConfig as ThemeConfig['token'],
      algorithm: getAlgorithm(themeConfig.algorithm as string | string[]),
    };

    // Use Ant Design's getDesignToken to compute all tokens
    const resolvedTokens = antdTheme.getDesignToken(antdConfig);

    // Merge flattened colors back in case Ant Design didn't recognize them
    return {
      ...(resolvedTokens as unknown as Record<string, unknown>),
      ...flattenedColors,
    };
  } catch {
    // If resolution fails, return the flattened colors plus original token object
    return {
      ...(themeConfig.token as Record<string, unknown>),
      ...flattenedColors,
    };
  }
}

/**
 * Calculates relative luminance per WCAG 2.1 specification.
 * @see https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : ((sRGB + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates WCAG contrast ratio between two colors.
 * @see https://www.w3.org/WAI/GL/wiki/Contrast_ratio
 *
 * @param color1 - First color in hex format
 * @param color2 - Second color in hex format
 * @returns Contrast ratio (1 to 21), or 0 if colors are invalid
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    return 0;
  }

  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Checks if a contrast ratio meets WCAG requirements.
 *
 * @param ratio - The contrast ratio to check
 * @param level - WCAG level ('AA' or 'AAA')
 * @param isLargeText - Whether the text is large (14pt bold or 18pt+)
 * @returns True if the ratio meets requirements
 */
export function meetsWCAG(
  ratio: number,
  level: 'AA' | 'AAA',
  isLargeText = false,
): boolean {
  if (level === 'AAA') {
    return ratio >= (isLargeText ? 4.5 : 7.0);
  }
  return ratio >= (isLargeText ? 3.0 : 4.5);
}

/**
 * Gets a color value from resolved tokens.
 * Normalizes the color to hex format.
 */
function getColorFromTokens(
  tokens: Record<string, unknown>,
  tokenName: string,
): string | null {
  const value = tokens[tokenName];
  if (typeof value === 'string') {
    return normalizeColor(value);
  }
  return null;
}

/**
 * Checks if a string looks like a valid hex color.
 */
function isValidHexColor(color: string | null): color is string {
  if (!color) return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}

/**
 * Analyzes a theme configuration for WCAG accessibility compliance.
 * Uses Ant Design's getDesignToken() to resolve computed colors,
 * allowing analysis even when only seed colors are defined.
 *
 * @param themeConfig - The theme configuration object to analyze
 * @returns Complete accessibility analysis with score, level, and issues
 */
export function analyzeThemeAccessibility(
  themeConfig: Record<string, unknown>,
): AccessibilityAnalysis {
  // Resolve theme tokens using Ant Design's algorithm
  const resolvedTokens = resolveThemeTokens(themeConfig);

  const issues: ContrastIssue[] = [];
  let passedChecks = 0;
  let totalChecks = 0;
  let passedAAA = 0;

  for (const pair of CONTRAST_PAIRS) {
    const fgColor = getColorFromTokens(resolvedTokens, pair.foreground);
    const bgColor = getColorFromTokens(resolvedTokens, pair.background);

    // Skip if colors are not defined or invalid
    if (!isValidHexColor(fgColor) || !isValidHexColor(bgColor)) {
      continue;
    }

    totalChecks += 1;
    const ratio = getContrastRatio(fgColor, bgColor);
    const requiredAA = pair.isLargeText
      ? WCAG_REQUIREMENTS.AA_LARGE_TEXT
      : WCAG_REQUIREMENTS.AA_NORMAL_TEXT;
    const requiredAAA = pair.isLargeText
      ? WCAG_REQUIREMENTS.AAA_LARGE_TEXT
      : WCAG_REQUIREMENTS.AAA_NORMAL_TEXT;

    if (ratio >= requiredAA) {
      passedChecks += 1;
      if (ratio >= requiredAAA) {
        passedAAA += 1;
      }
    } else {
      issues.push({
        foreground: pair.foreground,
        background: pair.background,
        foregroundColor: fgColor,
        backgroundColor: bgColor,
        ratio: Math.round(ratio * 100) / 100,
        required: requiredAA,
        severity: 'error',
        description: pair.description,
      });
    }
  }

  // Calculate score (0-100)
  const score =
    totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

  // Determine WCAG level
  let level: WCAGLevel;
  if (totalChecks === 0) {
    level = 'AA'; // No checkable pairs, assume OK
  } else if (passedAAA === totalChecks) {
    level = 'AAA';
  } else if (passedChecks === totalChecks) {
    level = 'AA';
  } else if (score >= 70) {
    level = 'A';
  } else {
    level = 'Fail';
  }

  // Sort issues by severity (errors first) then by ratio (worst first)
  issues.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'error' ? -1 : 1;
    }
    return a.ratio - b.ratio;
  });

  return {
    score,
    level,
    issues,
    passedChecks,
    totalChecks,
  };
}

/**
 * Formats a contrast ratio for display.
 * @param ratio - The ratio to format
 * @returns Formatted string like "4.5:1"
 */
export function formatContrastRatio(ratio: number): string {
  return `${ratio.toFixed(1)}:1`;
}

/**
 * Returns a color code based on score for visual feedback.
 */
export function getScoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 100) return 'success';
  if (score >= 70) return 'warning';
  return 'error';
}
