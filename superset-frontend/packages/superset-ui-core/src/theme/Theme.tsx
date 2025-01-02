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

import { theme as antdThemeImport, ThemeConfig, ConfigProvider } from 'antd-v5';
import tinycolor from 'tinycolor2';
import { merge } from 'lodash';

import {
  ThemeProvider as EmotionThemeProvider,
  CacheProvider as EmotionCacheProvider,
} from '@emotion/react';
import createCache from '@emotion/cache';

/* eslint-disable theme-colors/no-literal-colors */

const DEFAULT_SYSTEM_COLORS = {
  primary: '#20a7c9',
  secondary: '#444e7c',
  error: '#e04355',
  warning: '#fcc700',
  alert: '#fcc700',
  success: '#5ac189',
  info: '#66bcfe',
  grayscale: '#666666',
};

interface SystemColors {
  primary: string;
  secondary: string;
  error: string;
  warning: string;
  alert: string;
  success: string;
  info: string;
  grayscale: string;
}

interface ColorVariations {
  base: string;
  light1: string;
  light2: string;
  light3: string;
  light4: string;
  light5: string;
  dark1: string;
  dark2: string;
  dark3: string;
  dark4: string;
  dark5: string;
}
interface ThemeColors {
  darkest: string;
  lightest: string;
  text: {
    label: string;
    help: string;
  };
  primary: ColorVariations;
  secondary: ColorVariations;
  error: ColorVariations;
  warning: ColorVariations;
  alert: ColorVariations;
  success: ColorVariations;
  info: ColorVariations;
  grayscale: ColorVariations;
}

interface LegacySupersetTheme {
  borderRadius: number;
  body: {
    backgroundColor: string;
    color: string;
  };
  colors: ThemeColors;
  opacity: {
    light: string;
    mediumLight: string;
    mediumHeavy: string;
    heavy: string;
  };
  typography: {
    families: {
      sansSerif: string;
      serif: string;
      monospace: string;
    };
    weights: {
      light: number;
      normal: number;
      medium: number;
      bold: number;
    };
    sizes: {
      xxs: number;
      xs: number;
      s: number;
      m: number;
      l: number;
      xl: number;
      xxl: number;
    };
  };
  zIndex: {
    aboveDashboardCharts: number;
    dropdown: number;
    max: number;
  };
  transitionTiming: number;
  gridUnit: number;
  brandIconMaxWidth: number;
}

export interface SupersetTheme extends LegacySupersetTheme {
  antd: Record<string, any>;
}
export class Theme {
  private readonly isDarkMode: boolean;

  private legacyTheme: LegacySupersetTheme | null = null;

  private theme: SupersetTheme | null = null;

  private antdTheme: Record<string, any> | null = null;

  public antdConfig: ThemeConfig | undefined = undefined;

  private static readonly denyList: RegExp[] = [
    /purple.*/,
    /dragon.*/,
    /geekblue.*/,
    /magenta.*/,
    /volcano.*/,
    /gold.*/,
    /lime.*/,
    /cyan.*/,
    /blue.*/,
    /green.*/,
    /red.*/,
    /yellow.*/,
    /pink.*/,
    /orange.*/,
  ];

  constructor(systemColors?: Partial<SystemColors>, isDarkMode = false) {
    this.isDarkMode = isDarkMode;
    this.setThemeWithSystemColors(systemColors || {}, isDarkMode);

    this.getTheme = this.getTheme.bind(this);
    this.SupersetThemeProvider = this.SupersetThemeProvider.bind(this);
  }

  getTheme(): SupersetTheme {
    if (!this.legacyTheme) {
      throw new Error('Legacy theme is not initialized.');
    }
    return {
      ...this.legacyTheme,
      antd: this.getFilteredAntdTheme(),
    };
  }

  private adjustColor(
    color: string,
    percentage: number,
    target: string,
  ): string {
    return tinycolor.mix(color, target, percentage).toHexString();
  }

  private generateColorVariations(
    color: string,
    isDarkMode: boolean,
  ): ColorVariations {
    const colors = {
      base: color,
      light1: this.adjustColor(color, 20, 'white'),
      light2: this.adjustColor(color, 45, 'white'),
      light3: this.adjustColor(color, 70, 'white'),
      light4: this.adjustColor(color, 90, 'white'),
      light5: this.adjustColor(color, 95, 'white'),
      dark1: this.adjustColor(color, 10, 'black'),
      dark2: this.adjustColor(color, 20, 'black'),
      dark3: this.adjustColor(color, 40, 'black'),
      dark4: this.adjustColor(color, 60, 'black'),
      dark5: this.adjustColor(color, 80, 'black'),
    };
    if (isDarkMode) {
      return this.swapLightAndDark(colors);
    }
    return colors;
  }

  private swapLightAndDark(colorVariations: ColorVariations): ColorVariations {
    return {
      ...colorVariations,
      light1: colorVariations.dark1,
      light2: colorVariations.dark2,
      light3: colorVariations.dark3,
      light4: colorVariations.dark4,
      light5: colorVariations.dark5,
      dark1: colorVariations.light1,
      dark2: colorVariations.light2,
      dark3: colorVariations.light3,
      dark4: colorVariations.light4,
      dark5: colorVariations.light5,
    };
  }

  private generateColors(
    systemColors: SystemColors,
    isDarkTheme = false,
  ): ThemeColors {
    return {
      darkest: isDarkTheme ? '#FFF' : '#000',
      lightest: isDarkTheme ? '#000' : '#FFF',
      text: {
        label: '#879399',
        help: '#737373',
      },
      primary: this.generateColorVariations(systemColors.primary, isDarkTheme),
      secondary: this.generateColorVariations(
        systemColors.secondary,
        isDarkTheme,
      ),
      error: this.generateColorVariations(systemColors.error, isDarkTheme),
      warning: this.generateColorVariations(systemColors.warning, isDarkTheme),
      alert: this.generateColorVariations(systemColors.alert, isDarkTheme),
      success: this.generateColorVariations(systemColors.success, isDarkTheme),
      info: this.generateColorVariations(systemColors.info, isDarkTheme),
      grayscale: this.generateColorVariations(
        systemColors.grayscale,
        isDarkTheme,
      ),
    };
  }

  private getLegacySupersetTheme(
    systemColors: Partial<SystemColors>,
    isDarkTheme = false,
  ): LegacySupersetTheme {
    const allSystemColors: SystemColors = {
      ...DEFAULT_SYSTEM_COLORS,
      ...systemColors,
    };
    const colors = this.generateColors(allSystemColors, isDarkTheme);
    let theme: LegacySupersetTheme = {
      colors,
      borderRadius: 4,
      body: {
        backgroundColor: '#FFF',
        color: '#000',
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
    return theme;
  }

  private getAntdSeedFromLegacyTheme(
    theme: LegacySupersetTheme,
  ): Record<string, any> {
    return {
      ...antdThemeImport.defaultSeed,

      borderRadius: theme.borderRadius,

      colorPrimary: theme.colors.primary.base,
      colorError: theme.colors.error.base,
      colorInfo: theme.colors.info.base,
      colorSuccess: theme.colors.success.base,
      colorWarning: theme.colors.warning.base,
      colorBgLayout: theme.colors.grayscale.light5,

      colorLink: theme.colors.primary.dark1,

      controlHeight: 32,
      fontFamily: theme.typography.families.sansSerif,
      fontFamilyCode: theme.typography.families.monospace,
      fontSize: theme.typography.sizes.m,
      lineType: 'solid',
      lineWidth: 1,
      sizeStep: theme.gridUnit,
      sizeUnit: theme.gridUnit,
      zIndexBase: 0,
      zIndexPopupBase: theme.zIndex.max,
    };
  }

  private getFilteredAntdTheme(): Record<string, any> {
    const theme = this.antdTheme!;
    const filteredTheme: Record<string, any> = {};

    Object.entries(theme).forEach(([key, value]) => {
      if (!Theme.denyList.some(deny => deny.test(key))) {
        filteredTheme[key] = value;
      }
    });

    return filteredTheme;
  }

  private setAntdThemeFromLegacyTheme(legacyTheme: LegacySupersetTheme): void {
    const seed = this.getAntdSeedFromLegacyTheme(legacyTheme);
    const algorithm = this.isDarkMode
      ? antdThemeImport.darkAlgorithm
      : antdThemeImport.defaultAlgorithm;

    this.antdConfig = {
      token: seed,
      algorithm,
    };

    this.antdTheme = algorithm(seed as any);
  }

  private updateLegacyTheme(legacyTheme: LegacySupersetTheme): void {
    this.legacyTheme = legacyTheme;
    this.setAntdThemeFromLegacyTheme(legacyTheme);
    this.theme = this.getTheme();
  }

  setThemeWithSystemColors(
    systemColors: Partial<SystemColors>,
    isDarkMode: boolean,
  ): void {
    this.updateLegacyTheme(
      this.getLegacySupersetTheme(systemColors, isDarkMode),
    );
  }

  mergeTheme(partialTheme: Partial<LegacySupersetTheme>): void {
    this.updateLegacyTheme(merge({}, this.legacyTheme, partialTheme));
  }

  SupersetThemeProvider({ children }: { children: React.ReactNode }) {
    if (!this.theme || !this.antdConfig) {
      throw new Error('Theme is not initialized.');
    }
    const emotionCache = createCache({
      key: 'superset',
    });
    return (
      <EmotionCacheProvider value={emotionCache}>
        <EmotionThemeProvider theme={this.theme}>
          <ConfigProvider theme={this.antdConfig} prefixCls="antd5">
            {children}
          </ConfigProvider>
        </EmotionThemeProvider>
      </EmotionCacheProvider>
    );
  }
}
