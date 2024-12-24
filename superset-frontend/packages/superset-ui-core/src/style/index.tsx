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
import { theme as antdTheme } from 'antd-v5';

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

function adjustColor(
  color: string,
  percentage: number,
  target: string = 'white',
): string {
  const hex = tinycolor.mix(color, target, percentage).toHexString();
  return hex;
}

const generateColorVariations = (color: string) => {
  return {
    base: color,
    light1: adjustColor(color, 20, 'white'),
    light2: adjustColor(color, 45, 'white'),
    light3: adjustColor(color, 70, 'white'),
    light4: adjustColor(color, 90, 'white'),
    light5: adjustColor(color, 95, 'white'),
    dark1: adjustColor(color, 10, 'black'),
    dark2: adjustColor(color, 20, 'black'),
    dark3: adjustColor(color, 40, 'black'),
    dark4: adjustColor(color, 60, 'black'),
    dark5: adjustColor(color, 80, 'black'),
  };
};

const makeThemeDark = (theme: typeof defaultTheme): typeof defaultTheme => {
  const darkTheme = { ...theme };
  darkTheme.colors = { ...theme.colors };

  for (const [key] of Object.entries(darkTheme.colors)) {
    if (key !== 'text') {
      darkTheme.colors[key] = {
        base: theme.colors[key].base,
        dark1: theme.colors[key].light1,
        dark2: theme.colors[key].light2,
        dark3: theme.colors[key].light3,
        dark4: theme.colors[key].light4,
        dark5: theme.colors[key].light5,
        light1: theme.colors[key].dark1,
        light2: theme.colors[key].dark2,
        light3: theme.colors[key].dark3,
        light4: theme.colors[key].dark4,
        light5: theme.colors[key].dark5,
      };
    }
  }

  // Update the text-specific colors
  darkTheme.colors.text = {
    ...darkTheme.colors.text,
    label: '#D3D3D3',
    help: '#D3D3D3',
  };
  darkTheme.colors.darkest = '#FFF';
  darkTheme.colors.lightest = '#000';
  return darkTheme;
};

const generateColors = (baseColors: Record<string, string>) => {
  const colors = {};
  for (const [key, value] of Object.entries(baseColors)) {
    colors[key] = generateColorVariations(value);
  }
  return colors;
};

const computeTheme = (colors, isDarkTheme = false) => {
  let baseTheme = {
    borderRadius: 4,
    body: {
      backgroundColor: '#FFF',
      color: '#000',
    },
    colors: {
      darkest: '#000',
      lightest: '#FFF',
      text: {
        label: '#879399',
        help: '#737373',
      },
      ...generateColors(colors),
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
  if (isDarkTheme) {
    baseTheme = makeThemeDark(baseTheme);
  }

  const antdThemeSeed = {
    ...antdTheme.defaultSeed,
    colorPrimary: baseTheme.colors.primary.base,
    colorSuccess: baseTheme.colors.success.base,
    colorWarning: baseTheme.colors.warning.base,
    colorError: baseTheme.colors.error.base,
    colorInfo: baseTheme.colors.info.base,

    borderRadius: baseTheme.borderRadius,

    fontSize: baseTheme.typography.sizes.m,
    fontFamily: baseTheme.typography.families.sansSerif,
  };

  const computedAntdTheme = isDarkTheme
    ? antdTheme.darkAlgorithm(antdThemeSeed)
    : antdTheme.defaultAlgorithm(antdThemeSeed);
  // Filter out duplicated keys for colors
  const filteredAntdTheme = Object.fromEntries(
    Object.entries(computedAntdTheme).filter(([key]) => !key.includes('-')),
  );
  return {
    ...baseTheme,
    antd: filteredAntdTheme,
  };
};

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
const computedTheme = computeTheme(baseColors, false);

export type SupersetTheme = ReturnType<typeof makeThemeDark>;

export interface SupersetThemeProps {
  theme: SupersetTheme;
}
console.log('THEME', computedTheme);
export const supersetTheme = computedTheme;
