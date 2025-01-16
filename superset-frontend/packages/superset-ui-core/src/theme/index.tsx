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
import emotionStyled from '@emotion/styled';
import { useTheme as useThemeBasic } from '@emotion/react';
import { theme as antdThemeImport } from 'antd-v5';
import { Theme } from './Theme';
import type { SupersetTheme } from './Theme';

export {
  css,
  keyframes,
  jsx,
  ThemeProvider,
  CacheProvider as EmotionCacheProvider,
  withTheme,
} from '@emotion/react';
export { default as createEmotionCache } from '@emotion/cache';

declare module '@emotion/react' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Theme extends ReturnType<typeof themeObject.getTheme> {}
}

export function useTheme() {
  const theme = useThemeBasic();
  // in the case there is no theme, useTheme returns an empty object
  if (Object.keys(theme).length === 0 && theme.constructor === Object) {
    throw new Error(
      'useTheme() could not find a ThemeContext. The <ThemeProvider/> component is likely missing from the app.',
    );
  }
  return theme;
}

const styled = emotionStyled;

// launching in in dark mode for now while iterating
const themeObject = Theme.fromSystemColors({}, true);
/*
const themeObject = Theme.fromAntdConfig({
  token: {
    colorPrimary: '#20a7c9',
    // secondary: '#444e7c',
    colorError: '#e04355',
    colorWarning: '#fcc700',
    colorSuccess: '#5ac189',
    colorInfo: '#66bcfe',
  },
  algorithm: antdThemeImport.darkAlgorithm,
});
 */

const { theme } = themeObject;
const supersetTheme = theme;

export { Theme, SupersetTheme, themeObject, styled, theme, supersetTheme };
