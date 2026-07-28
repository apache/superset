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
import type { ColorScheme } from './types';

/** Superset brand accent. */
export const SUPERSET_BLUE = '#20A7C9';

/**
 * Superset-flavored categorical palette (a curated, high-contrast set that
 * reads well on both light and dark chrome — not the default ECharts colors).
 */
export const CATEGORICAL_PALETTE = [
  '#20A7C9', // superset blue
  '#1FA8C9',
  '#454E7C', // deep indigo
  '#5AC189', // green
  '#FF7F44', // orange
  '#E04355', // red
  '#A868B7', // purple
  '#3CCCCB', // teal
  '#A38F79', // taupe
  '#8FD3E8', // light blue
];

export interface ThemeTokens {
  scheme: ColorScheme;
  bg: string;
  panel: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  gridLine: string;
  axisLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  zebra: string;
  hover: string;
  skeleton: string;
  fontSans: string;
}

const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const LIGHT: ThemeTokens = {
  scheme: 'light',
  bg: '#ffffff',
  panel: '#ffffff',
  border: '#e0e0e0',
  textPrimary: '#1b2a3d',
  textSecondary: '#5f6b7a',
  textMuted: '#8c98a4',
  accent: SUPERSET_BLUE,
  gridLine: '#eef1f4',
  axisLine: '#cfd8dd',
  tooltipBg: 'rgba(255,255,255,0.98)',
  tooltipBorder: '#e0e0e0',
  zebra: '#f7f9fa',
  hover: '#eef7fa',
  skeleton: '#eef1f4',
  fontSans: FONT_SANS,
};

const DARK: ThemeTokens = {
  scheme: 'dark',
  bg: '#141b23',
  panel: '#1b232d',
  border: '#2b3947',
  textPrimary: '#e8edf2',
  textSecondary: '#9fb0bf',
  textMuted: '#6b7d8c',
  accent: '#3CCCCB',
  gridLine: '#26313c',
  axisLine: '#37475a',
  tooltipBg: 'rgba(27,35,45,0.98)',
  tooltipBorder: '#37475a',
  zebra: '#1f2831',
  hover: '#243444',
  skeleton: '#232f3a',
  fontSans: FONT_SANS,
};

export function getThemeTokens(scheme: ColorScheme): ThemeTokens {
  return scheme === 'dark' ? DARK : LIGHT;
}

/** Push theme tokens into CSS custom properties so chrome + chart stay in sync. */
export function applyThemeVars(t: ThemeTokens, root: HTMLElement = document.documentElement): void {
  const map: Record<string, string> = {
    '--sv-bg': t.bg,
    '--sv-panel': t.panel,
    '--sv-border': t.border,
    '--sv-text-primary': t.textPrimary,
    '--sv-text-secondary': t.textSecondary,
    '--sv-text-muted': t.textMuted,
    '--sv-accent': t.accent,
    '--sv-grid-line': t.gridLine,
    '--sv-zebra': t.zebra,
    '--sv-hover': t.hover,
    '--sv-skeleton': t.skeleton,
    '--sv-font-sans': t.fontSans,
  };
  for (const [k, v] of Object.entries(map)) root.style.setProperty(k, v);
  root.style.colorScheme = t.scheme;
}

/** Detect the OS-level preference as a fallback when no host theme is provided. */
export function detectPreferredScheme(): ColorScheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}
