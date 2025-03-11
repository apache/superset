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

import { addAlpha } from '@superset-ui/core';
import { type ThemeConfig } from 'antd-v5';
import { theme as supersetTheme } from 'src/preamble';
import { mix } from 'polished';
import { lightAlgorithm } from './light';

export enum ThemeType {
  LIGHT = 'light',
}

const themes = {
  [ThemeType.LIGHT]: lightAlgorithm,
};

// Want to figure out which tokens look like what? Try this!
// https://ant.design/theme-editor

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
    Avatar: {
      containerSize: 32,
      fontSize: supersetTheme.typography.sizes.s,
      lineHeight: 32,
    },
    Badge: {
      paddingXS: supersetTheme.gridUnit * 2,
    },
    Button: {
      defaultBg: supersetTheme.colors.primary.light4,
      defaultHoverBg: mix(
        0.1,
        supersetTheme.colors.primary.base,
        supersetTheme.colors.primary.light4,
      ),
      defaultActiveBg: mix(
        0.25,
        supersetTheme.colors.primary.base,
        supersetTheme.colors.primary.light4,
      ),
      defaultColor: supersetTheme.colors.primary.dark1,
      defaultHoverColor: supersetTheme.colors.primary.dark1,
      defaultBorderColor: 'transparent',
      defaultHoverBorderColor: 'transparent',
      colorPrimaryHover: supersetTheme.colors.primary.dark1,
      colorPrimaryActive: mix(
        0.2,
        supersetTheme.colors.grayscale.dark2,
        supersetTheme.colors.primary.dark1,
      ),
      primaryColor: supersetTheme.colors.grayscale.light5,
      colorPrimaryTextHover: supersetTheme.colors.grayscale.light5,
      colorError: supersetTheme.colors.error.base,
      colorErrorHover: mix(
        0.1,
        supersetTheme.colors.grayscale.light5,
        supersetTheme.colors.error.base,
      ),
      colorErrorBg: mix(
        0.2,
        supersetTheme.colors.grayscale.dark2,
        supersetTheme.colors.error.base,
      ),
      dangerColor: supersetTheme.colors.grayscale.light5,
      colorLinkHover: supersetTheme.colors.primary.base,
      linkHoverBg: 'transparent',
    },
    Card: {
      paddingLG: supersetTheme.gridUnit * 6,
      fontWeightStrong: supersetTheme.typography.weights.medium,
      colorBgContainer: supersetTheme.colors.grayscale.light4,
    },
    DatePicker: {
      colorBgContainer: supersetTheme.colors.grayscale.light5,
      colorBgElevated: supersetTheme.colors.grayscale.light5,
      borderRadiusSM: supersetTheme.gridUnit / 2,
    },
    Divider: {
      colorSplit: supersetTheme.colors.grayscale.light3,
    },
    Dropdown: {
      colorBgElevated: supersetTheme.colors.grayscale.light5,
      zIndexPopup: supersetTheme.zIndex.max,
    },
    Input: {
      colorBorder: supersetTheme.colors.secondary.light3,
      colorBgContainer: supersetTheme.colors.grayscale.light5,
      activeShadow: `0 0 0 ${supersetTheme.gridUnit / 2}px ${
        supersetTheme.colors.primary.light3
      }`,
    },
    InputNumber: {
      colorBorder: supersetTheme.colors.secondary.light3,
      colorBgContainer: supersetTheme.colors.grayscale.light5,
      activeShadow: `0 0 0 ${supersetTheme.gridUnit / 2}px ${
        supersetTheme.colors.primary.light3
      }`,
    },
    List: {
      itemPadding: `${supersetTheme.gridUnit + 2}px ${supersetTheme.gridUnit * 3}px`,
      paddingLG: supersetTheme.gridUnit * 3,
      colorSplit: supersetTheme.colors.grayscale.light3,
      colorText: supersetTheme.colors.grayscale.dark1,
    },
    Menu: {
      itemHeight: 32,
      colorBgContainer: supersetTheme.colors.grayscale.light5,
      subMenuItemBg: supersetTheme.colors.grayscale.light5,
      colorBgElevated: supersetTheme.colors.grayscale.light5,
      boxShadowSecondary: `0 3px 6px -4px ${addAlpha(supersetTheme.colors.grayscale.dark2, 0.12)}, 0 6px 16px 0 ${addAlpha(supersetTheme.colors.grayscale.dark2, 0.08)}, 0 9px 28px 8px ${addAlpha(supersetTheme.colors.grayscale.dark2, 0.05)}`,
      activeBarHeight: 0,
      itemHoverBg: supersetTheme.colors.secondary.light5,
      padding: supersetTheme.gridUnit * 2,
      subMenuItemBorderRadius: 0,
      horizontalLineHeight: 1.4,
      zIndexPopup: supersetTheme.zIndex.max,
    },
    Modal: {
      colorBgMask: `${supersetTheme.colors.grayscale.dark2}73`,
      contentBg: supersetTheme.colors.grayscale.light5,
      titleFontSize: supersetTheme.gridUnit * 4,
      titleColor: `${supersetTheme.colors.grayscale.dark2}D9`,
      headerBg: supersetTheme.colors.grayscale.light4,
    },
    Tag: {
      borderRadiusSM: 2,
      defaultBg: supersetTheme.colors.grayscale.light4,
    },
    Progress: {
      fontSize: supersetTheme.typography.sizes.s,
      colorText: supersetTheme.colors.text.label,
      remainingColor: supersetTheme.colors.grayscale.light4,
    },
    Popover: {
      colorBgElevated: supersetTheme.colors.grayscale.light5,
    },
    Slider: {
      trackBgDisabled: supersetTheme.colors.grayscale.light1,
      colorBgElevated: supersetTheme.colors.grayscale.light5,
      handleSizeHover: 10,
      handleLineWidthHover: 2,
    },
    Steps: {
      margin: supersetTheme.gridUnit * 2,
      iconSizeSM: 20,
    },
    Switch: {
      colorPrimaryHover: supersetTheme.colors.primary.base,
      colorTextTertiary: supersetTheme.colors.grayscale.light1,
    },
    Tooltip: {
      fontSize: supersetTheme.typography.sizes.s,
      lineHeight: 1.6,
    },
  },
};

export const getTheme = (themeType?: ThemeType) => ({
  ...baseConfig,
  algorithm: themes[themeType || ThemeType.LIGHT],
});
