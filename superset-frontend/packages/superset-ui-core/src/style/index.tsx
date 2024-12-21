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
import createCache from '@emotion/cache';

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
  export interface Theme extends SupersetTheme {}
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

export const emotionCache = createCache({
  key: 'superset',
});

export const styled = emotionStyled;

const defaultTheme = {
  borderRadius: 4,
  colors: {
    text: {
      label: '#879399',
      help: '#737373',
    },
    primary: {
      base: '#20a7c9',
      dark1: '#1a85a0',
      dark2: '#156378',
      light1: '#79cade',
      light2: '#a5dae9',
      light3: '#d2edf4',
      light4: '#e9f6f9',
      light5: '#f3f8fa',
    },
    secondary: {
      base: '#444e7c',
      dark1: '#363e63',
      dark2: '#282e4a',
      dark3: '#1b1f31',
      light1: '#8e94b0',
      light2: '#b4b8ca',
      light3: '#d9dbe4',
      light4: '#eceef2',
      light5: '#f5f5f8',
    },
    grayscale: {
      base: '#666666',
      dark1: '#323232',
      dark2: '#111',
      dark3: '#080808',
      dark4: '#080808',
      dark5: '#080808',
      light1: '#b2b2b2',
      light2: '#e0e0e0',
      light3: '#f0f0f0',
      light4: '#f7f7f7',
      light5: '#ffffff',
    },
    error: {
      base: '#e04355',
      dark1: '#a7323f',
      dark2: '#6f212a',
      light1: '#efa1aa',
      light2: '#faedee',
    },
    warning: {
      base: '#ff7f44',
      dark1: '#bf5e33',
      dark2: '#7f3f21',
      light1: '#fec0a1',
      light2: '#fff2ec',
    },
    alert: {
      base: '#fcc700',
      dark1: '#bc9501',
      dark2: '#7d6300',
      light1: '#fde380',
      light2: '#fef9e6',
    },
    success: {
      base: '#5ac189',
      dark1: '#439066',
      dark2: '#2b6144',
      light1: '#ace1c4',
      light2: '#eef8f3',
    },
    info: {
      base: '#66bcfe',
      dark1: '#4d8cbe',
      dark2: '#315e7e',
      light1: '#b3defe',
      light2: '#eff8fe',
    },
  },
  opacity: {
    light: '10%',
    mediumLight: '35%',
    mediumHeavy: '60%',
    heavy: '80%',
  },
  typography: {
    families: {
      sansSerif: `'Inter', Helvetica, Arial`,
      serif: `Georgia, 'Times New Roman', Times, serif`,
      monospace: `'Fira Code', 'Courier New', monospace`,
    },
    weights: {
      light: 200,
      normal: 400,
      medium: 500,
      bold: 600,
    },
    sizes: {
      xxs: 9,
      xs: 10,
      s: 12,
      m: 14,
      l: 16,
      xl: 21,
      xxl: 28,
    },
  },
  zIndex: {
    aboveDashboardCharts: 10,
    dropdown: 11,
    max: 3000,
  },
  transitionTiming: 0.3,
  gridUnit: 4,
  brandIconMaxWidth: 37,
};

export type SupersetTheme = typeof defaultTheme;

export interface SupersetThemeProps {
  theme: SupersetTheme;
}

export const supersetTheme = defaultTheme;
