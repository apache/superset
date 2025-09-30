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

import { allowedAntdTokens } from '@superset-ui/core/theme/types';
import type { AnyThemeConfig } from '@superset-ui/core/theme/types';

type TokenValue = string | number | boolean;

export interface ValidationError {
  tokenName: string;
  tokenValue: TokenValue;
  category: TokenCategory;
  errorType: ErrorType;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validTokens: Record<string, TokenValue>;
  invalidTokens: Record<string, TokenValue>;
}

export enum TokenCategory {
  COLOR = 'color',
  SIZE = 'size',
  FONT = 'font',
  SHADOW = 'shadow',
  BRAND = 'brand',
  MOTION = 'motion',
  NUMERIC = 'numeric',
  BOOLEAN = 'boolean',
  TEXT = 'text',
  UNKNOWN = 'unknown',
}

export enum ErrorType {
  InvalidColor = 'invalid_color',
  InvalidSize = 'invalid_size',
  InvalidFont = 'invalid_font',
  InvalidShadow = 'invalid_shadow',
  InvalidUrl = 'invalid_url',
  InvalidMotion = 'invalid_motion',
  InvalidNumeric = 'invalid_numeric',
  InvalidBoolean = 'invalid_boolean',
  InvalidString = 'invalid_string',
  UnknownToken = 'unknown_token',
  TypeMismatch = 'type_mismatch',
}

const COLOR_TOKENS = new Set([
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
  'controlOutline',
  'controlTmpOutline',
  'controlItemBgActive',
  'controlItemBgActiveDisabled',
  'controlItemBgActiveHover',
  'controlItemBgHover',
]);

const SIZE_TOKENS = new Set([
  'borderRadius',
  'borderRadiusLG',
  'borderRadiusOuter',
  'borderRadiusSM',
  'borderRadiusXS',
  'controlHeight',
  'controlHeightLG',
  'controlHeightSM',
  'controlHeightXS',
  'controlInteractiveSize',
  'controlOutlineWidth',
  'controlPaddingHorizontal',
  'controlPaddingHorizontalSM',
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
  'lineHeight',
  'lineHeightHeading1',
  'lineHeightHeading2',
  'lineHeightHeading3',
  'lineHeightHeading4',
  'lineHeightHeading5',
  'lineHeightLG',
  'lineHeightSM',
  'lineWidth',
  'lineWidthBold',
  'lineWidthFocus',
  'margin',
  'marginLG',
  'marginMD',
  'marginSM',
  'marginXL',
  'marginXS',
  'marginXXL',
  'marginXXS',
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
  'fontSizeXS',
  'fontSizeXXL',
  'brandIconMaxWidth',
  'brandLogoHeight',
]);

const FONT_TOKENS = new Set([
  'fontFamily',
  'fontFamilyCode',
  'fontWeightStrong',
  'fontWeightNormal',
  'fontWeightLight',
]);

const SHADOW_TOKENS = new Set([
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
]);

const BRAND_TOKENS = new Set([
  'brandLogoAlt',
  'brandLogoUrl',
  'brandLogoMargin',
  'brandLogoHref',
  'brandSpinnerUrl',
  'brandSpinnerSvg',
]);

const MOTION_TOKENS = new Set([
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
]);

const NUMERIC_TOKENS = new Set([
  'opacityImage',
  'opacityLoading',
  'zIndexBase',
  'zIndexPopupBase',
]);

const BOOLEAN_TOKENS = new Set(['wireframe']);

const TEXT_TOKENS = new Set([
  'lineType',
  'linkDecoration',
  'linkFocusDecoration',
  'linkHoverDecoration',
]);

function getTokenCategory(tokenName: string): TokenCategory {
  if (COLOR_TOKENS.has(tokenName)) return TokenCategory.COLOR;
  if (SIZE_TOKENS.has(tokenName)) return TokenCategory.SIZE;
  if (FONT_TOKENS.has(tokenName)) return TokenCategory.FONT;
  if (SHADOW_TOKENS.has(tokenName)) return TokenCategory.SHADOW;
  if (BRAND_TOKENS.has(tokenName)) return TokenCategory.BRAND;
  if (MOTION_TOKENS.has(tokenName)) return TokenCategory.MOTION;
  if (NUMERIC_TOKENS.has(tokenName)) return TokenCategory.NUMERIC;
  if (BOOLEAN_TOKENS.has(tokenName)) return TokenCategory.BOOLEAN;
  if (TEXT_TOKENS.has(tokenName)) return TokenCategory.TEXT;
  return TokenCategory.UNKNOWN;
}

function isValidColor(value: TokenValue): boolean {
  if (typeof value !== 'string') return false;

  const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
  if (hexPattern.test(value)) return true;

  const rgbPattern = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/;
  const rgbaPattern =
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0|1|0?\.\d+)\s*\)$/;
  if (rgbPattern.test(value) || rgbaPattern.test(value)) {
    const matches = value.match(/\d+(\.\d+)?/g);
    if (matches) {
      const nums = matches.map(Number);
      return (
        nums[0] <= 255 &&
        nums[1] <= 255 &&
        nums[2] <= 255 &&
        (nums.length === 3 || (nums[3] >= 0 && nums[3] <= 1))
      );
    }
  }

  const hslPattern = /^hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/;
  const hslaPattern =
    /^hsla\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*(0|1|0?\.\d+)\s*\)$/;
  if (hslPattern.test(value) || hslaPattern.test(value)) {
    const matches = value.match(/\d+(\.\d+)?/g);
    if (matches) {
      const nums = matches.map(Number);
      return (
        nums[0] <= 360 &&
        nums[1] <= 100 &&
        nums[2] <= 100 &&
        (nums.length === 3 || (nums[3] >= 0 && nums[3] <= 1))
      );
    }
  }

  const namedColors = new Set([
    'transparent',
    'inherit',
    'currentColor',
    'initial',
    'unset',
    'black',
    'white',
    'red',
    'green',
    'blue',
    'yellow',
    'cyan',
    'magenta',
    'gray',
    'grey',
    'darkgray',
    'darkgrey',
    'lightgray',
    'lightgrey',
    'orange',
    'purple',
    'brown',
    'pink',
    'lime',
    'navy',
    'teal',
    'silver',
    'maroon',
    'olive',
    'aqua',
    'fuchsia',
  ]);

  return namedColors.has(value.toLowerCase());
}

function isValidSize(value: TokenValue): boolean {
  if (typeof value === 'number') return value >= 0;
  if (typeof value !== 'string') return false;

  const cssUnitPattern =
    /^-?\d*\.?\d+(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$/;
  return (
    cssUnitPattern.test(value) ||
    value === '0' ||
    value === 'auto' ||
    value === 'inherit' ||
    value === 'initial' ||
    value === 'unset'
  );
}

function isValidFont(value: TokenValue, tokenName: string): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;

  if (tokenName.includes('Weight')) {
    if (typeof value === 'number') return value >= 100 && value <= 900;
    if (typeof value === 'string') {
      const validWeights = new Set([
        'normal',
        'bold',
        'bolder',
        'lighter',
        'inherit',
        'initial',
        'unset',
      ]);
      return validWeights.has(value) || /^[1-9]00$/.test(value);
    }
  }

  return typeof value === 'string' && value.length > 0;
}

function isValidShadow(value: TokenValue): boolean {
  if (typeof value !== 'string') return false;
  if (
    value === 'none' ||
    value === 'inherit' ||
    value === 'initial' ||
    value === 'unset'
  )
    return true;

  const simpleShadowPattern =
    /^(-?\d+(\.\d+)?(px|em|rem|%|\w*)\s+){2,4}(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+|transparent)(\s*,\s*(-?\d+(\.\d+)?(px|em|rem|%|\w*)\s+){2,4}(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+|transparent))*$/;
  const insetShadowPattern =
    /^inset\s+(-?\d+(\.\d+)?(px|em|rem|%|\w*)\s+){2,4}(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+|transparent)$/;

  return (
    simpleShadowPattern.test(value.trim()) ||
    insetShadowPattern.test(value.trim())
  );
}

function isValidUrl(value: TokenValue): boolean {
  if (typeof value !== 'string') return false;
  if (value === '') return true;

  try {
    const url = new URL(value);
    return Boolean(url);
  } catch {
    return /^\//.test(value) || /^\.\//.test(value) || /^\.\.\//.test(value);
  }
}

function isValidMotion(value: TokenValue, tokenName: string): boolean {
  if (typeof value !== 'string') return false;

  if (tokenName.includes('Duration')) {
    return /^\d+(\.\d+)?(ms|s)$/.test(value);
  }

  if (tokenName.includes('Ease')) {
    const validEasings = new Set([
      'linear',
      'ease',
      'ease-in',
      'ease-out',
      'ease-in-out',
      'step-start',
      'step-end',
      'inherit',
      'initial',
      'unset',
    ]);
    return (
      validEasings.has(value) ||
      /^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/.test(
        value,
      ) ||
      /^steps\(\s*\d+\s*(,\s*(start|end))?\s*\)$/.test(value)
    );
  }

  return typeof value === 'string' && value.length > 0;
}

function isValidNumeric(value: TokenValue): boolean {
  return typeof value === 'number' && value >= 0;
}

function isValidBoolean(value: TokenValue): boolean {
  return typeof value === 'boolean';
}

function isValidText(value: TokenValue, tokenName: string): boolean {
  if (typeof value !== 'string') return false;

  if (tokenName.includes('Decoration')) {
    const validDecorations = new Set([
      'none',
      'underline',
      'overline',
      'line-through',
      'inherit',
      'initial',
      'unset',
    ]);
    return validDecorations.has(value);
  }

  if (tokenName === 'lineType') {
    const validLineTypes = new Set([
      'solid',
      'dashed',
      'dotted',
      'double',
      'groove',
      'ridge',
      'inset',
      'outset',
      'none',
      'hidden',
    ]);
    return validLineTypes.has(value);
  }

  return typeof value === 'string' && value.length > 0;
}

function validateToken(
  tokenName: string,
  tokenValue: TokenValue,
): ValidationError | null {
  const category = getTokenCategory(tokenName);

  if (
    category === TokenCategory.UNKNOWN &&
    !allowedAntdTokens.includes(tokenName as any)
  ) {
    return {
      tokenName,
      tokenValue,
      category,
      errorType: ErrorType.UnknownToken,
      message: `Unknown token '${tokenName}' is not in the allowed tokens list`,
    };
  }

  let isValid = false;
  let errorType = ErrorType.TypeMismatch;

  switch (category) {
    case TokenCategory.COLOR:
      isValid = isValidColor(tokenValue);
      errorType = ErrorType.InvalidColor;
      break;
    case TokenCategory.SIZE:
      isValid = isValidSize(tokenValue);
      errorType = ErrorType.InvalidSize;
      break;
    case TokenCategory.FONT:
      isValid = isValidFont(tokenValue, tokenName);
      errorType = ErrorType.InvalidFont;
      break;
    case TokenCategory.SHADOW:
      isValid = isValidShadow(tokenValue);
      errorType = ErrorType.InvalidShadow;
      break;
    case TokenCategory.BRAND:
      if (tokenName.includes('Url') || tokenName.includes('Href')) {
        isValid = isValidUrl(tokenValue);
        errorType = ErrorType.InvalidUrl;
      } else {
        isValid = typeof tokenValue === 'string';
        errorType = ErrorType.InvalidString;
      }
      break;
    case TokenCategory.MOTION:
      isValid = isValidMotion(tokenValue, tokenName);
      errorType = ErrorType.InvalidMotion;
      break;
    case TokenCategory.NUMERIC:
      isValid = isValidNumeric(tokenValue);
      errorType = ErrorType.InvalidNumeric;
      break;
    case TokenCategory.BOOLEAN:
      isValid = isValidBoolean(tokenValue);
      errorType = ErrorType.InvalidBoolean;
      break;
    case TokenCategory.TEXT:
      isValid = isValidText(tokenValue, tokenName);
      errorType = ErrorType.InvalidString;
      break;
    default:
      isValid = true;
  }

  if (!isValid) {
    return {
      tokenName,
      tokenValue,
      category,
      errorType,
      message: `Token '${tokenName}' has invalid value '${tokenValue}' for category '${category}'`,
    };
  }

  return null;
}

export function validateThemeTokens(
  themeConfig: AnyThemeConfig,
): ValidationResult {
  const errors: ValidationError[] = [];
  const validTokens: Record<string, TokenValue> = {};
  const invalidTokens: Record<string, TokenValue> = {};

  // Null safety checks
  if (!themeConfig || typeof themeConfig !== 'object') {
    return {
      isValid: true, // Empty/null config is considered valid
      errors,
      validTokens,
      invalidTokens,
    };
  }

  const tokensToValidate = themeConfig.token || {};

  // Additional safety check for tokens object
  if (!tokensToValidate || typeof tokensToValidate !== 'object') {
    return {
      isValid: true,
      errors,
      validTokens,
      invalidTokens,
    };
  }

  Object.entries(tokensToValidate).forEach(([tokenName, tokenValue]) => {
    const error = validateToken(tokenName, tokenValue as TokenValue);

    if (error) {
      errors.push(error);
      invalidTokens[tokenName] = tokenValue as TokenValue;
    } else {
      validTokens[tokenName] = tokenValue as TokenValue;
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validTokens,
    invalidTokens,
  };
}

export function getPartialThemeConfig(
  themeConfig: AnyThemeConfig,
): AnyThemeConfig {
  const validationResult = validateThemeTokens(themeConfig);

  return {
    ...themeConfig,
    token: validationResult.validTokens,
  };
}

export function formatValidationErrors(
  errors: ValidationError[],
  themeName?: string,
): string[] {
  return errors.map(error => {
    const themePrefix = themeName ? `Theme "${themeName}": ` : '';
    return `${themePrefix}Token '${error.tokenName}' was unable to be loaded - ${error.message}`;
  });
}
