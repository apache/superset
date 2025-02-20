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
import {
  Children,
  ReactElement,
  ReactNode,
  Fragment,
  MouseEventHandler,
} from 'react';

import cx from 'classnames';
import { Button as AntdButton } from 'antd-v5';
import { useTheme } from '@superset-ui/core';
import { Tooltip, TooltipProps } from 'src/components/Tooltip';
import {
  ButtonProps as AntdButtonProps,
  ButtonType,
  ButtonVariantType,
  ButtonColorType,
} from 'antd-v5/lib/button';

export type OnClickHandler = MouseEventHandler<HTMLElement>;

export type ButtonStyle =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'link'
  | 'dashed';

export type ButtonSize = 'default' | 'small' | 'xsmall';

export type ButtonProps = Omit<AntdButtonProps, 'css'> &
  Pick<TooltipProps, 'placement'> & {
    tooltip?: ReactNode;
    className?: string;
    buttonSize?: ButtonSize;
    buttonStyle?: ButtonStyle;
    cta?: boolean;
    showMarginRight?: boolean;
  };

export default function Button(props: ButtonProps) {
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

  let antdType: ButtonType = 'default';
  let variant: ButtonVariantType = 'solid';
  let color: ButtonColorType = 'primary';

  if (!buttonStyle || buttonStyle === 'primary') {
    variant = 'solid';
  } else if (buttonStyle === 'secondary') {
    variant = 'outlined';
    color = 'default';
  } else if (buttonStyle === 'dashed') {
    color = 'primary';
    variant = 'dashed';
  } else if (buttonStyle === 'danger') {
    color = 'danger';
  } else if (buttonStyle === 'link') {
    variant = 'link';
    antdType = 'default';
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
        lineHeight: 1.5715,
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
      }}
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
