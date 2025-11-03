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
import { Children, ReactElement, Fragment } from 'react';
import cx from 'classnames';
import { Button as AntdButton } from 'antd';
import { useTheme } from '@superset-ui/core';
import { Tooltip } from '../Tooltip';
import type {
  ButtonColorType,
  ButtonProps,
  ButtonStyle,
  ButtonType,
  ButtonVariantType,
  OnClickHandler,
} from './types';

export function Button(props: ButtonProps) {
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
    ...restProps
  } = props;

  const theme = useTheme();
  const { fontSizeSM, fontWeightStrong } = theme;

  let height = 32;
  let padding = 18;
  if (buttonSize === 'xsmall') {
    height = 22;
    padding = 5;
  } else if (buttonSize === 'small') {
    height = 30;
    padding = 10;
  }
  if (buttonStyle === 'link') {
    padding = 4;
  }

  let antdType: ButtonType = 'default';
  let variant: ButtonVariantType = 'solid';
  let color: ButtonColorType = 'primary';

  if (!buttonStyle || buttonStyle === 'primary') {
    variant = 'solid';
    antdType = 'primary';
  } else if (buttonStyle === 'secondary') {
    variant = 'filled';
    color = 'primary';
  } else if (buttonStyle === 'tertiary') {
    variant = 'outlined';
    color = 'default';
  } else if (buttonStyle === 'dashed') {
    variant = 'dashed';
    antdType = 'dashed';
  } else if (buttonStyle === 'danger') {
    color = 'danger';
  } else if (buttonStyle === 'link') {
    variant = 'link';
  }

  const element = children as ReactElement;

  let renderedChildren = [];

  if (element && element.type === Fragment) {
    renderedChildren = Children.toArray(element.props.children);
  } else {
    renderedChildren = Children.toArray(children);
  }
  const firstChildMargin =
    showMarginRight && renderedChildren.length > 1 ? theme.sizeUnit * 2 : 0;

  const effectiveButtonStyle: ButtonStyle = buttonStyle ?? 'primary';

  const button = (
    <AntdButton
      href={disabled ? undefined : href}
      disabled={disabled}
      type={antdType}
      variant={variant}
      danger={effectiveButtonStyle === 'danger'}
      color={color}
      className={cx(
        className,
        'superset-button',
        // A static class name containing the button style is available to
        // support customizing button styles in embedded dashboards.
        `superset-button-${buttonStyle}`,
        { cta: !!cta },
      )}
      css={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        fontSize: fontSizeSM,
        fontWeight: fontWeightStrong,
        height,
        padding: `0px ${padding}px`,
        minWidth: cta ? theme.sizeUnit * 36 : undefined,
        minHeight: cta ? theme.sizeUnit * 8 : undefined,
        marginLeft: 0,
        '& + .superset-button': {
          marginLeft: theme.sizeUnit * 2,
        },
        '& > span > :first-of-type': {
          marginRight: firstChildMargin,
        },
        ':not(:hover)': effectiveButtonStyle === 'secondary' &&
          !disabled && {
            // NOTE: This is the best we can do contrast wise for the secondary button using antd tokens
            // and abusing the semantics. Should be revisited when possible. https://github.com/apache/superset/pull/34253#issuecomment-3104834692
            color: `${theme.colorPrimaryTextHover} !important`,
          },
      }}
      icon={icon}
      {...restProps}
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

export type { ButtonProps, OnClickHandler };
