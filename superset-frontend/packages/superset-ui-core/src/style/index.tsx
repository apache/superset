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


import tinycolor from 'tinycolor2';

function adjustColor(color, percentage, target = 'white') {
  const hex = tinycolor.mix(color, target, percentage).toHexString();
  return hex;
}
const generateColorVariations = (color: string) => {
  return {
    base: color,
    light1: adjustColor(color, 25),
    light2: adjustColor(color, 50),
    light3: adjustColor(color, 75),
    light4: adjustColor(color, 85),
    light5: adjustColor(color, 95),
    dark1: adjustColor(color, 15, 'black'),
    dark2: adjustColor(color, 30, 'black'),
    dark3: adjustColor(color, 45, 'black'),
    dark4: adjustColor(color, 60, 'black'),
    dark5: adjustColor(color, 75, 'black'),
  };
}
const makeThemeDark = (theme) => {
  const darkTheme = { ...theme };
  darkTheme.colors = { ...theme.colors };
  for (const [key, colorSet] of Object.entries(darkTheme.colors)) {
    darkTheme.colors[key].dark1 = theme.colors[key].light1;
    darkTheme.colors[key].dark2 = theme.colors[key].light2;
    darkTheme.colors[key].dark3 = theme.colors[key].light3;
    darkTheme.colors[key].dark4 = theme.colors[key].light4;
    darkTheme.colors[key].dark5 = theme.colors[key].light5;
    darkTheme.colors[key].light1 = theme.colors[key].dark1;
    darkTheme.colors[key].light2 = theme.colors[key].dark2;
    darkTheme.colors[key].light3 = theme.colors[key].dark3;
    darkTheme.colors[key].light4 = theme.colors[key].dark4;
    darkTheme.colors[key].light5 = theme.colors[key].dark5;
  }
  darkTheme.colors.label = "#D3D3D3";
  darkTheme.colors.help = "#D3D3D3";
  return darkTheme;
}
const baseColors = {
  primary: '#20A7C9',
  secondary: '#444E7C',
  error: '#E04355',
  warning: '#FF7F44',
  alert: '#FCC700',
  success: '#5AC189',
  info: '#66BCFE',
  grayscale: '#666666',
};
const generateColors = (baseColors: Record<string, string>) => {
  const colors = {};
  for (const [key, value] of Object.entries(baseColors)) {
    colors[key] = generateColorVariations(value);
  }
  return colors;
}
const colors = generateColors(baseColors);
console.log(colors);

const defaultTheme = {
  borderRadius: 4,
  body: {
    background: '#000',
    color: '#fff',
  },
  colors: {
    text: {
      label: '#879399',
      help: '#737373',
    },
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
    ...colors,
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
console.log(defaultTheme);

export type SupersetTheme = typeof makeThemeDark(defaultTheme);

export interface SupersetThemeProps {
  theme: SupersetTheme;
}

export const supersetTheme = defaultTheme;
