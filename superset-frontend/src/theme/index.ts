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

import { MappingAlgorithm, type ThemeConfig } from 'antd-v5';
import { theme as supersetTheme } from 'src/preamble';
import { lightAlgorithm, lightConfig } from './light';

export enum ThemeType {
  LIGHT = 'light',
}

type Theme = {
  [key in ThemeType]: {
    algorithm: MappingAlgorithm;
    config: ThemeConfig;
  };
};

const themes: Theme = {
  [ThemeType.LIGHT]: {
    algorithm: lightAlgorithm,
    config: lightConfig,
  },
};

const deepMerge = (base: any, override: any): any => {
  const merged = { ...base };

  Object.keys(override).forEach(key => {
    if (
      override[key] &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key])
    ) {
      merged[key] = deepMerge(merged[key] || {}, override[key]);
    } else {
      merged[key] = override[key];
    }
  });

  return merged;
};

// Want to figure out which tokens look like what? Try this!
// https://ant.design/theme-editor

const baseConfig: ThemeConfig = {
  token: {
    borderRadius: supersetTheme.borderRadius,
    controlHeight: 32,
    fontFamily: supersetTheme.typography.families.sansSerif,
    fontFamilyCode: supersetTheme.typography.families.monospace,
    fontSize: supersetTheme.typography.sizes.m,
    lineType: 'solid',
    lineWidth: 1,
    sizeStep: supersetTheme.gridUnit,
    sizeUnit: supersetTheme.gridUnit,
    zIndexBase: 0,
    zIndexPopupBase: supersetTheme.zIndex.max,
  },
  components: {
    Alert: {
      borderRadius: supersetTheme.borderRadius,
      fontSize: supersetTheme.typography.sizes.m,
      fontSizeLG: supersetTheme.typography.sizes.m,
      fontSizeIcon: supersetTheme.typography.sizes.l,
    },
    Avatar: {
      containerSize: 32,
      fontSize: supersetTheme.typography.sizes.s,
      lineHeight: 32,
    },
    Badge: {
      paddingXS: supersetTheme.gridUnit * 2,
    },
    Card: {
      paddingLG: supersetTheme.gridUnit * 6,
      fontWeightStrong: supersetTheme.typography.weights.medium,
    },
    List: {
      itemPadding: `${supersetTheme.gridUnit + 2}px ${supersetTheme.gridUnit * 3}px`,
      paddingLG: supersetTheme.gridUnit * 3,
    },
    Modal: {
      titleFontSize: supersetTheme.gridUnit * 4,
    },
    Tag: {
      borderRadiusSM: 2,
    },
    Progress: {
      fontSize: supersetTheme.typography.sizes.s,
    },
    Slider: {
      handleSizeHover: 10,
      handleLineWidthHover: 2,
    },
    Tooltip: {
      fontSize: supersetTheme.typography.sizes.s,
      lineHeight: 1.6,
    },
  },
};

export const getTheme = (themeType?: ThemeType) => {
  const selectedTheme = themes[themeType || ThemeType.LIGHT];

  const mergedConfig = deepMerge(baseConfig, selectedTheme.config);
  return {
    ...mergedConfig,
    algorithm: selectedTheme.algorithm,
  };
};
