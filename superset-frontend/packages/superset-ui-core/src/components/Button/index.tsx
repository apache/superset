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
import { Children, ReactElement, Fragment, forwardRef, Ref } from 'react';
import cx from 'classnames';
import { Button as AntdButton } from 'antd';
import { useTheme } from '@apache-superset/core/theme';
import { Tooltip } from '../Tooltip';
import type { SupersetTheme } from '@apache-superset/core/theme';
import type {
  ButtonColorType,
  ButtonProps,
  ButtonStyleConfig,
  ButtonStyle,
  ButtonType,
  ButtonVariantType,
  OnClickHandler,
} from './types';

/**
 * Secondary Button Theming
 *
 * Ant Design's "filled" variant (used for secondary buttons) has no component-level
 * tokens for customization. To enable full theming of secondary buttons, we use
 * Superset-specific tokens (buttonSecondary*) with fallbacks to Ant Design's
 * colorPrimary* derived tokens.
 *
 * Implementation approach (follows PR #38679 pattern for label tokens):
 * - Default state: Applied via inline `style` prop (higher specificity than CSS classes)
 * - Hover/Active states: Applied via `css` prop with !important (pseudo-selectors
 *   cannot be applied via inline styles)
 *
 * Available tokens (all optional, with sensible fallbacks):
 * - buttonSecondaryColor: Text color (fallback: colorPrimary)
 * - buttonSecondaryBg: Background color (fallback: colorPrimaryBg)
 * - buttonSecondaryBorderColor: Border color (fallback: transparent)
 * - buttonSecondaryHoverColor: Hover text color (fallback: colorPrimary)
 * - buttonSecondaryHoverBg: Hover background (fallback: colorPrimaryBgHover)
 * - buttonSecondaryHoverBorderColor: Hover border (fallback: transparent)
 * - buttonSecondaryActiveColor: Active/pressed text color (fallback: colorPrimary)
 * - buttonSecondaryActiveBg: Active/pressed background (fallback: colorPrimaryBorder)
 * - buttonSecondaryActiveBorderColor: Active/pressed border (fallback: transparent)
 */

/**
 * Generates inline styles for secondary buttons (default state).
 * Inline styles have higher specificity than CSS classes, so no !important needed.
 */
export const getSecondaryButtonStyle = (theme: SupersetTheme) => ({
  color: theme.buttonSecondaryColor || theme.colorPrimary,
  backgroundColor: theme.buttonSecondaryBg || theme.colorPrimaryBg,
  borderColor: theme.buttonSecondaryBorderColor || 'transparent',
});

/**
 * Generates CSS styles for secondary button hover/active states.
 * Must use CSS (not inline styles) since pseudo-selectors cannot be applied via style prop.
 * Uses !important to override Ant Design's default styles.
 */
export const getSecondaryButtonHoverStyles = (theme: SupersetTheme) => ({
  '&:hover': {
    color: `${theme.buttonSecondaryHoverColor || theme.colorPrimary} !important`,
    backgroundColor: `${theme.buttonSecondaryHoverBg || theme.colorPrimaryBgHover} !important`,
    borderColor: `${theme.buttonSecondaryHoverBorderColor || 'transparent'} !important`,
  },
  '&:active': {
    color: `${theme.buttonSecondaryActiveColor || theme.colorPrimary} !important`,
    backgroundColor: `${theme.buttonSecondaryActiveBg || theme.colorPrimaryBorder} !important`,
    borderColor: `${theme.buttonSecondaryActiveBorderColor || 'transparent'} !important`,
  },
});

type ButtonStyleMapping = {
  type?: ButtonType;
  variant?: ButtonVariantType;
  color?: ButtonColorType;
};

const BUTTON_STYLE_MAP: Record<ButtonStyle, ButtonStyleMapping> = {
  primary: { type: 'primary', variant: 'solid', color: 'primary' },
  secondary: { variant: 'filled', color: 'primary' },
  tertiary: { variant: 'outlined', color: 'default' },
  dashed: { type: 'dashed', variant: 'dashed', color: 'primary' },
  danger: { variant: 'solid', color: 'danger' },
  link: { type: 'link' },
};

function ButtonInner(props: ButtonProps, ref: Ref<HTMLElement>) {
  const {
    tooltip,
    placement,
    disabled = false,
    buttonSize,
    buttonStyle,
    className,
    cta,
    children,
    href,
    showMarginRight = true,
    icon,
    styleConfig,
    ...restProps
  } = props;

  const theme = useTheme();
  const { fontWeightStrong } = theme;
  const btnFontSize = theme.buttonFontSize ?? theme.fontSizeSM;

  const resolvedStyleMap: Record<ButtonStyle, ButtonStyleMapping> =
    theme.buttonStyleMap
      ? (Object.fromEntries(
          Object.entries(BUTTON_STYLE_MAP).map(([key, value]) => [
            key,
            { ...value, ...theme.buttonStyleMap?.[key as ButtonStyle] },
          ]),
        ) as Record<ButtonStyle, ButtonStyleMapping>)
      : BUTTON_STYLE_MAP;

  let defaultHeight = theme.buttonControlHeight ?? 32;
  let defaultPaddingInline = theme.buttonPaddingInline ?? 18;
  let defaultBorderRadius = theme.buttonBorderRadius ?? theme.borderRadius;
  if (buttonSize === 'xsmall') {
    defaultHeight = theme.buttonControlHeightXS ?? 22;
    defaultPaddingInline = 5;
    defaultBorderRadius = theme.buttonBorderRadius ?? theme.borderRadiusSM;
  } else if (buttonSize === 'small') {
    defaultHeight = theme.buttonControlHeightSM ?? 30;
    defaultPaddingInline = theme.buttonPaddingInlineSM ?? 10;
    defaultBorderRadius = theme.buttonBorderRadius ?? theme.borderRadiusSM;
  }
  if (buttonStyle === 'link') {
    defaultPaddingInline = 4;
  }

  const resolvedStyleConfig: Required<ButtonStyleConfig> = {
    controlHeight: styleConfig?.controlHeight ?? defaultHeight,
    paddingInline: styleConfig?.paddingInline ?? defaultPaddingInline,
    fontSize: styleConfig?.fontSize ?? btnFontSize,
    fontWeight: styleConfig?.fontWeight ?? fontWeightStrong,
    ctaMinWidth: styleConfig?.ctaMinWidth ?? theme.sizeUnit * 36,
    ctaMinHeight: styleConfig?.ctaMinHeight ?? theme.sizeUnit * 8,
    iconGap: styleConfig?.iconGap ?? theme.sizeUnit * 2,
    borderRadius: styleConfig?.borderRadius ?? defaultBorderRadius,
  };

  const {
    type: antdType = 'default',
    variant,
    color,
  } = resolvedStyleMap[buttonStyle ?? 'primary'] ?? BUTTON_STYLE_MAP.primary;

  const element = children as ReactElement;

  let renderedChildren = [];

  if (element && element.type === Fragment) {
    renderedChildren = Children.toArray(element.props.children);
  } else {
    renderedChildren = Children.toArray(children);
  }
  const firstChildMargin =
    showMarginRight && renderedChildren.length > 1
      ? resolvedStyleConfig.iconGap
      : 0;

  const effectiveButtonStyle: ButtonStyle = buttonStyle ?? 'primary';

  // Secondary button inline styles (default state) - inline styles override CSS classes
  const secondaryStyle =
    effectiveButtonStyle === 'secondary' && !disabled
      ? getSecondaryButtonStyle(theme)
      : undefined;

  const button = (
    <AntdButton
      ref={ref as Ref<HTMLButtonElement & HTMLAnchorElement>}
      href={disabled ? undefined : href}
      disabled={disabled}
      type={antdType}
      variant={variant}
      danger={effectiveButtonStyle === 'danger'}
      color={color}
      // Static class names for embedded-dashboard CSS targeting
      className={cx(
        className,
        'superset-button',
        `superset-button-${buttonStyle}`,
        { cta: !!cta },
      )}
      css={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        fontSize: resolvedStyleConfig.fontSize,
        fontWeight: resolvedStyleConfig.fontWeight,
        height: resolvedStyleConfig.controlHeight,
        padding: `0px ${resolvedStyleConfig.paddingInline}px`,
        borderRadius: resolvedStyleConfig.borderRadius,
        minWidth: cta ? resolvedStyleConfig.ctaMinWidth : undefined,
        minHeight: cta ? resolvedStyleConfig.ctaMinHeight : undefined,
        marginLeft: 0,
        '& + .superset-button:not(.ant-btn-compact-item)': {
          marginLeft: theme.sizeUnit * 2,
        },
        '& > span > :first-of-type': {
          marginRight: firstChildMargin,
        },
        // Secondary button hover/active states via CSS
        ...(effectiveButtonStyle === 'secondary' &&
          !disabled &&
          getSecondaryButtonHoverStyles(theme)),
      }}
      icon={icon}
      {...restProps}
      style={
        secondaryStyle
          ? { ...secondaryStyle, ...restProps.style }
          : restProps.style
      }
    >
      {children}
    </AntdButton>
  );

  if (tooltip) {
    return (
      <Tooltip placement={placement} title={tooltip}>
        {/* wrap the button in a span so that the tooltip shows up
        when the button is disabled. */}
        {disabled ? (
          <span
            css={{
              cursor: 'not-allowed',
              '& > .superset-button': {
                marginLeft: theme.sizeUnit * 2,
              },
            }}
          >
            {button}
          </span>
        ) : (
          button
        )}
      </Tooltip>
    );
  }

  return button;
}

export const Button = forwardRef<HTMLElement, ButtonProps>(ButtonInner);

export type { ButtonProps, OnClickHandler };
