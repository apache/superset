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
/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line no-restricted-syntax
import { theme as antdThemeImport } from 'antd';

/**
 * Get AntdThemeConfig type from the theme object
 */
import type { ThemeConfig } from 'antd';
import { Theme } from '.';

/**
 * Grab all antd tokens via getDesignToken(...).
 * (Same as in the original file.)
 */
export type AntdTokens = ReturnType<typeof antdThemeImport.getDesignToken>;
export type AntdThemeConfig = ThemeConfig;

/**
 * A serializable version of Ant Design's ThemeConfig
 * Compatible with theme editor exports
 */
export type SerializableThemeConfig = {
  token?: Record<string, any>;
  components?: Record<string, any>;
  algorithm?:
    | 'default'
    | 'dark'
    | 'compact'
    | ('default' | 'dark' | 'compact')[];
  hashed?: boolean;
  inherit?: boolean;
};

/**
 * A combined type that can be either a regular AntdThemeConfig or a SerializableThemeConfig
 */
export type AnyThemeConfig = AntdThemeConfig | SerializableThemeConfig;

/** Minimal color system references. */
export type FontSizeKey = 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl';

export interface SystemColors {
  colorPrimary: string;
  colorError: string;
  colorWarning: string;
  colorSuccess: string;
  colorInfo: string;
}

export interface ColorVariants {
  bg: string;
  border: string;
  hover: string;
  active: string;
  textHover: string;
  text: string;
  borderHover: string;
  bgHover: string;
  textActive: string;
}

export interface DeprecatedColorVariations {
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

export interface DeprecatedThemeColors {
  primary: DeprecatedColorVariations;
  error: DeprecatedColorVariations;
  warning: DeprecatedColorVariations;
  success: DeprecatedColorVariations;
  info: DeprecatedColorVariations;
  grayscale: DeprecatedColorVariations;
}

export interface LegacySupersetTheme {
  // Old colors structure with light/dark semantics still heavily referenced in code base
  // TODO: replace/realign with antd-type tokens
  colors: DeprecatedThemeColors;
  transitionTiming: number;
}

export interface SupersetSpecificTokens {
  // Brand-related
  brandIconMaxWidth: number;

  // Font-related
  fontSizeXS: string;
  fontSizeXXL: string;
  fontWeightNormal: string;
  fontWeightLight: string;
  fontWeightStrong: string;

  brandLogoAlt: string;
  brandLogoUrl: string;
  brandLogoMargin: string;
  brandLogoHref: string;
  brandLogoHeight: string;
}

/**
 * This array is used to define which keys from the full Antd token set
 * we actually allow in the SupersetTheme.
 */
export const allowedAntdTokens = [
  'borderRadius',
  'borderRadiusLG',
  'borderRadiusOuter',
  'borderRadiusSM',
  'borderRadiusXS',
  'boxShadow',
  'boxShadowDrawerLeft',
  'boxShadowDrawerRight',
  'boxShadowDrawerUp',
  'boxShadowPopoverArrow',
  'boxShadowSecondary',
  'boxShadowTabsOverflowBottom',
  'boxShadowTabsOverflowLeft',
  'boxShadowTabsOverflowRight',
  'boxShadowTabsOverflowTop',
  'boxShadowTertiary',
  'colorError',
  'colorErrorActive',
  'colorErrorBg',
  'colorErrorBgActive',
  'colorErrorBgHover',
  'colorErrorBorder',
  'colorErrorBorderHover',
  'colorErrorHover',
  'colorErrorOutline',
  'colorErrorText',
  'colorErrorTextActive',
  'colorErrorTextHover',
  'colorPrimary',
  'colorPrimaryActive',
  'colorPrimaryBg',
  'colorPrimaryBgHover',
  'colorPrimaryBorder',
  'colorPrimaryBorderHover',
  'colorPrimaryHover',
  'colorPrimaryText',
  'colorPrimaryTextActive',
  'colorPrimaryTextHover',
  'colorSuccess',
  'colorSuccessActive',
  'colorSuccessBg',
  'colorSuccessBgHover',
  'colorSuccessBorder',
  'colorSuccessBorderHover',
  'colorSuccessHover',
  'colorSuccessText',
  'colorSuccessTextActive',
  'colorSuccessTextHover',
  'colorBgBase',
  'colorBgBlur',
  'colorBgContainer',
  'colorBgContainerDisabled',
  'colorBgElevated',
  'colorBgLayout',
  'colorBgMask',
  'colorBgSpotlight',
  'colorBgTextActive',
  'colorBgTextHover',
  'colorBorder',
  'colorBorderBg',
  'colorBorderSecondary',
  'colorFill',
  'colorFillAlter',
  'colorFillContent',
  'colorFillContentHover',
  'colorFillQuaternary',
  'colorFillSecondary',
  'colorFillTertiary',
  'colorHighlight',
  'colorIcon',
  'colorIconHover',
  'colorInfo',
  'colorInfoActive',
  'colorInfoBg',
  'colorInfoBgHover',
  'colorInfoBorder',
  'colorInfoBorderHover',
  'colorInfoHover',
  'colorInfoText',
  'colorInfoTextActive',
  'colorInfoTextHover',
  'colorLink',
  'colorLinkActive',
  'colorLinkHover',
  'colorSplit',
  'colorText',
  'colorTextBase',
  'colorTextDescription',
  'colorTextDisabled',
  'colorTextHeading',
  'colorTextLabel',
  'colorTextLightSolid',
  'colorTextPlaceholder',
  'colorTextQuaternary',
  'colorTextSecondary',
  'colorTextTertiary',
  'colorWarning',
  'colorWarningActive',
  'colorWarningBg',
  'colorWarningBgHover',
  'colorWarningBorder',
  'colorWarningBorderHover',
  'colorWarningHover',
  'colorWarningOutline',
  'colorWarningText',
  'colorWarningTextActive',
  'colorWarningTextHover',
  'colorWhite',
  'controlHeight',
  'controlHeightLG',
  'controlHeightSM',
  'controlHeightXS',
  'controlInteractiveSize',
  'controlItemBgActive',
  'controlItemBgActiveDisabled',
  'controlItemBgActiveHover',
  'controlItemBgHover',
  'controlOutline',
  'controlOutlineWidth',
  'controlPaddingHorizontal',
  'controlPaddingHorizontalSM',
  'controlTmpOutline',
  'fontFamily',
  'fontFamilyCode',
  'fontHeight',
  'fontHeightLG',
  'fontHeightSM',
  'fontSize',
  'fontSizeHeading1',
  'fontSizeHeading2',
  'fontSizeHeading3',
  'fontSizeHeading4',
  'fontSizeHeading5',
  'fontSizeIcon',
  'fontSizeLG',
  'fontSizeSM',
  'fontSizeXL',
  'fontWeightStrong',
  'lineHeight',
  'lineHeightHeading1',
  'lineHeightHeading2',
  'lineHeightHeading3',
  'lineHeightHeading4',
  'lineHeightHeading5',
  'lineHeightLG',
  'lineHeightSM',
  'lineType',
  'lineWidth',
  'lineWidthBold',
  'lineWidthFocus',
  'linkDecoration',
  'linkFocusDecoration',
  'linkHoverDecoration',
  'margin',
  'marginLG',
  'marginMD',
  'marginSM',
  'marginXL',
  'marginXS',
  'marginXXL',
  'marginXXS',
  'motion',
  'motionBase',
  'motionDurationFast',
  'motionDurationMid',
  'motionDurationSlow',
  'motionEaseInBack',
  'motionEaseInOut',
  'motionEaseInOutCirc',
  'motionEaseInQuint',
  'motionEaseOut',
  'motionEaseOutBack',
  'motionEaseOutCirc',
  'motionEaseOutQuint',
  'motionUnit',
  'opacityImage',
  'opacityLoading',
  'padding',
  'paddingContentHorizontal',
  'paddingContentHorizontalLG',
  'paddingContentHorizontalSM',
  'paddingContentVertical',
  'paddingContentVerticalLG',
  'paddingContentVerticalSM',
  'paddingLG',
  'paddingMD',
  'paddingSM',
  'paddingXL',
  'paddingXS',
  'paddingXXS',
  'screenLG',
  'screenLGMax',
  'screenLGMin',
  'screenMD',
  'screenMDMax',
  'screenMDMin',
  'screenSM',
  'screenSMMax',
  'screenSMMin',
  'screenXL',
  'screenXLMax',
  'screenXLMin',
  'screenXS',
  'screenXSMax',
  'screenXSMin',
  'screenXXL',
  'screenXXLMin',
  'size',
  'sizeLG',
  'sizeMD',
  'sizeMS',
  'sizePopupArrow',
  'sizeSM',
  'sizeStep',
  'sizeUnit',
  'sizeXL',
  'sizeXS',
  'sizeXXL',
  'sizeXXS',
  'wireframe',
  'zIndexBase',
  'zIndexPopupBase',
] as const;

/** We build a narrower type from these allowed keys. */
export type AllowedAntdTokenKeys = Extract<
  (typeof allowedAntdTokens)[number],
  keyof AntdTokens
>;

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export type SharedAntdTokens = Pick<AntdTokens, AllowedAntdTokenKeys>;

/** The final shape for our custom theme object, combining old theme + shared antd + superset specifics. */
export type SupersetTheme = LegacySupersetTheme &
  SharedAntdTokens &
  SupersetSpecificTokens;

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ThemeControllerOptions {
  storage?: ThemeStorage;
  storageKey?: string;
  modeStorageKey?: string;
  defaultTheme?: AnyThemeConfig;
  onChange?: (theme: Theme) => void;
  canUpdateTheme?: () => boolean;
  canUpdateMode?: () => boolean;
}

export interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setTheme: (config: AnyThemeConfig) => void;
  changeThemeMode: (newMode: ThemeMode) => void;
  resetTheme: () => void;
}
