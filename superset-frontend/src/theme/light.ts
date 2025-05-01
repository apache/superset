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

import { type MappingAlgorithm, theme } from 'antd-v5';
import { theme as supersetTheme } from 'src/preamble';

export const lightAlgorithm: MappingAlgorithm = seedToken => {
  const defaultTokens = theme.defaultAlgorithm(seedToken);
  return {
    // Map Tokens
    ...defaultTokens,
    borderRadiusLG: supersetTheme.borderRadius,
    borderRadiusOuter: supersetTheme.borderRadius,
    borderRadiusSM: supersetTheme.borderRadius,
    borderRadiusXS: supersetTheme.borderRadius,

    colorBgContainer: supersetTheme.colors.primary.light4,
    colorBgElevated: supersetTheme.colors.primary.base,
    colorBgLayout: supersetTheme.colors.grayscale.light4,
    colorBgMask: supersetTheme.colors.grayscale.light2,
    colorBgSpotlight: supersetTheme.colors.grayscale.dark1,

    colorBorder: supersetTheme.colors.grayscale.light2,
    colorBorderSecondary: supersetTheme.colors.grayscale.light3,

    colorErrorActive: supersetTheme.colors.error.dark1,
    colorErrorBg: supersetTheme.colors.error.light2,
    colorErrorBgActive: supersetTheme.colors.error.light1,
    colorErrorBgHover: supersetTheme.colors.error.light2,
    colorErrorBorder: supersetTheme.colors.error.light1,
    colorErrorBorderHover: supersetTheme.colors.error.light1,
    colorErrorHover: supersetTheme.colors.error.base,
    colorErrorText: supersetTheme.colors.error.base,
    colorErrorTextActive: supersetTheme.colors.error.dark1,
    colorErrorTextHover: supersetTheme.colors.error.base,

    colorFill: supersetTheme.colors.grayscale.light4,
    colorFillSecondary: supersetTheme.colors.grayscale.light2,
    colorFillTertiary: supersetTheme.colors.grayscale.light3,

    colorInfoActive: supersetTheme.colors.info.dark1,
    colorInfoBg: supersetTheme.colors.info.light2,
    colorInfoBgHover: supersetTheme.colors.info.light1,
    colorInfoBorder: supersetTheme.colors.info.light1,
    colorInfoBorderHover: supersetTheme.colors.info.dark1,
    colorInfoHover: supersetTheme.colors.info.dark1,
    colorInfoText: supersetTheme.colors.info.dark1,
    colorInfoTextActive: supersetTheme.colors.info.dark2,
    colorInfoTextHover: supersetTheme.colors.info.dark1,

    colorLinkActive: supersetTheme.colors.info.dark2,
    colorLinkHover: supersetTheme.colors.info.dark1,

    colorPrimaryActive: supersetTheme.colors.primary.dark2,
    colorPrimaryBg: supersetTheme.colors.primary.light4,
    colorPrimaryBgHover: supersetTheme.colors.primary.light3,
    colorPrimaryBorder: supersetTheme.colors.primary.light2,
    colorPrimaryBorderHover: supersetTheme.colors.primary.light1,
    colorPrimaryHover: supersetTheme.colors.primary.dark1,
    colorPrimaryText: supersetTheme.colors.primary.dark1,
    colorPrimaryTextActive: supersetTheme.colors.primary.dark2,
    colorPrimaryTextHover: supersetTheme.colors.primary.dark1,

    colorSuccessActive: supersetTheme.colors.success.dark1,
    colorSuccessBg: supersetTheme.colors.success.light2,
    colorSuccessBgHover: supersetTheme.colors.success.light1,
    colorSuccessBorder: supersetTheme.colors.success.light1,
    colorSuccessBorderHover: supersetTheme.colors.success.dark1,
    colorSuccessHover: supersetTheme.colors.success.dark1,
    colorSuccessText: supersetTheme.colors.success.dark1,
    colorSuccessTextActive: supersetTheme.colors.success.dark2,
    colorSuccessTextHover: supersetTheme.colors.success.dark1,

    colorText: supersetTheme.colors.grayscale.dark2,
    colorTextQuaternary: supersetTheme.colors.grayscale.light1,
    colorTextSecondary: supersetTheme.colors.text.label,
    colorTextTertiary: supersetTheme.colors.text.help,

    colorWarningActive: supersetTheme.colors.warning.dark1,
    colorWarningBg: supersetTheme.colors.warning.light2,
    colorWarningBgHover: supersetTheme.colors.warning.light1,
    colorWarningBorder: supersetTheme.colors.warning.light1,
    colorWarningBorderHover: supersetTheme.colors.warning.dark1,
    colorWarningHover: supersetTheme.colors.warning.dark1,
    colorWarningText: supersetTheme.colors.warning.dark1,
    colorWarningTextActive: supersetTheme.colors.warning.dark2,
    colorWarningTextHover: supersetTheme.colors.warning.dark1,

    colorWhite: supersetTheme.colors.grayscale.light5,

    fontSizeHeading1: supersetTheme.typography.sizes.xxl,
    fontSizeHeading2: supersetTheme.typography.sizes.xl,
    fontSizeHeading3: supersetTheme.typography.sizes.l,
    fontSizeHeading4: supersetTheme.typography.sizes.m,
    fontSizeHeading5: supersetTheme.typography.sizes.s,

    fontSizeLG: supersetTheme.typography.sizes.l,
    fontSizeSM: supersetTheme.typography.sizes.s,
    fontSizeXL: supersetTheme.typography.sizes.xl,

    lineWidthBold: supersetTheme.gridUnit / 2,
  };
};
