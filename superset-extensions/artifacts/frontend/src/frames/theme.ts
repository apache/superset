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
 * @fileoverview The canvas theme as the frame gets it: a short list of tokens
 * and light or dark mode, never the host's whole theme object.
 */

// TODO: decide whether frames get the MCP Apps names for theme variables
// rather than Superset's token names.

import { theme as themeApi } from '@apache-superset/core';
import type { ArtifactTheme } from '@superset-oss/artifacts-sdk';

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
] as const satisfies readonly (keyof themeApi.SupersetTheme)[];

export function frameTheme(theme: themeApi.SupersetTheme): ArtifactTheme {
  const tokens: Record<string, string | number> = {};
  FRAME_THEME_TOKENS.forEach(name => {
    const value = theme[name];
    if (typeof value === 'string' || typeof value === 'number') {
      tokens[name] = value;
    }
  });
  return { mode: themeApi.isThemeDark(theme) ? 'dark' : 'light', tokens };
}
