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

import { type ThemeConfig } from 'antd-v5';
import { theme as supersetTheme } from 'src/preamble';
import { lightAlgorithm } from './light';

export enum ThemeType {
  LIGHT = 'light',
}

const themes = {
  [ThemeType.LIGHT]: lightAlgorithm,
};

const baseConfig: ThemeConfig = {
  token: {
    borderRadius: supersetTheme.borderRadius,
    colorBgBase: supersetTheme.colors.primary.light4,
    colorError: supersetTheme.colors.error.base,
    colorInfo: supersetTheme.colors.info.base,
    colorLink: supersetTheme.colors.grayscale.dark1,
    colorPrimary: supersetTheme.colors.primary.base,
    colorSuccess: supersetTheme.colors.success.base,
    colorTextBase: supersetTheme.colors.grayscale.dark2,
    colorWarning: supersetTheme.colors.warning.base,
    controlHeight: supersetTheme.gridUnit * 32,
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
    Badge: {
      paddingXS: supersetTheme.gridUnit * 2,
    },
    Card: {
      colorBgContainer: supersetTheme.colors.grayscale.light4,
      paddingLG: supersetTheme.gridUnit * 6,
      fontWeightStrong: supersetTheme.typography.weights.medium,
    },
  },
};

export const getTheme = (themeType?: ThemeType) => ({
  ...baseConfig,
  algorithm: themes[themeType || ThemeType.LIGHT],
});
