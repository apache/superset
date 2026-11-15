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
 * @fileoverview The canvas theme as the frame gets it (R9): a short list of
 * tokens and light or dark mode, never the host's whole theme object.
 */

// Review findings M9 and M10 (pending): the MCP Apps names for theme
// variables.

import type { ArtifactTheme } from '@apache-superset/artifact-sdk';

export const FRAME_THEME_TOKENS = [
  'colorPrimary',
  'colorText',
  'colorTextSecondary',
  'colorBgContainer',
  'colorBgLayout',
  'colorBorder',
  'colorSuccess',
  'colorWarning',
  'colorError',
  'fontFamily',
  'fontFamilyCode',
  'fontSize',
  'borderRadius',
] as const;

/** Whether a `#rrggbb` background is dark, by its perceived luminance. */
function isDark(background: unknown): boolean {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(background ?? ''));
  if (!match) return false;
  const value = parseInt(match[1], 16);
  const luminance =
    0.299 * ((value >> 16) & 255) +
    0.587 * ((value >> 8) & 255) +
    0.114 * (value & 255);
  return luminance < 128;
}

export function frameTheme(theme: object): ArtifactTheme {
  const source = theme as Record<string, unknown>;
  const tokens: Record<string, string | number> = {};
  FRAME_THEME_TOKENS.forEach(name => {
    const value = source[name];
    if (typeof value === 'string' || typeof value === 'number') {
      tokens[name] = value;
    }
  });
  return { mode: isDark(source.colorBgContainer) ? 'dark' : 'light', tokens };
}
