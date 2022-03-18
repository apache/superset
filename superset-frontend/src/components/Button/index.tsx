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
import React, { CSSProperties, Children, ReactElement } from 'react';
import { kebabCase } from 'lodash';
import { mix } from 'polished';
import cx from 'classnames';
import { AntdButton } from 'src/components';
import { useTheme } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';

export type OnClickHandler = React.MouseEventHandler<HTMLElement>;

export type ButtonStyle =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'default'
  | 'link'
  | 'dashed';

export interface ButtonProps {
  id?: string;
  className?: string;
  tooltip?: string;
  ghost?: boolean;
  placement?:
    | 'bottom'
    | 'left'
    | 'right'
    | 'top'
    | 'topLeft'
    | 'topRight'
    | 'bottomLeft'
    | 'bottomRight'
    | 'leftTop'
    | 'leftBottom'
    | 'rightTop'
    | 'rightBottom';
  onClick?: OnClickHandler;
  disabled?: boolean;
  buttonStyle?: ButtonStyle;
  buttonSize?: 'default' | 'small' | 'xsmall';
  style?: CSSProperties;
  children?: React.ReactNode;
  href?: string;
  htmlType?: 'button' | 'submit' | 'reset';
  cta?: boolean;
  loading?: boolean | { delay?: number | undefined } | undefined;
  showMarginRight?: boolean;
}

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
  const { colors, transitionTiming, borderRadius, typography } = theme;
  const { primary, grayscale, success, warning, error } = colors;

  let height = 32;
  let padding = 18;
  if (buttonSize === 'xsmall') {
    height = 22;
    padding = 5;
  } else if (buttonSize === 'small') {
    height = 30;
    padding = 10;
  }

  let backgroundColor = primary.light4;
  let backgroundColorHover = mix(0.1, primary.base, primary.light4);
  let backgroundColorActive = mix(0.25, primary.base, primary.light4);
  let backgroundColorDisabled = grayscale.light2;
  let color = primary.dark1;
  let colorHover = color;
  let borderWidth = 0;
  let borderStyle = 'none';
  let borderColor = 'transparent';
  let borderColorHover = 'transparent';
  let borderColorDisabled = 'transparent';

  if (buttonStyle === 'primary') {
    backgroundColor = primary.dark1;
    backgroundColorHover = mix(0.1, grayscale.light5, primary.dark1);
    backgroundColorActive = mix(0.2, grayscale.dark2, primary.dark1);
    color = grayscale.light5;
    colorHover = color;
  } else if (buttonStyle === 'tertiary' || buttonStyle === 'dashed') {
    backgroundColor = grayscale.light5;
    backgroundColorHover = grayscale.light5;
    backgroundColorActive = grayscale.light5;
    backgroundColorDisabled = grayscale.light5;
    borderWidth = 1;
    borderStyle = buttonStyle === 'dashed' ? 'dashed' : 'solid';
    borderColor = primary.dark1;
    borderColorHover = primary.light1;
    borderColorDisabled = grayscale.light2;
  } else if (buttonStyle === 'danger') {
    backgroundColor = error.base;
    backgroundColorHover = mix(0.1, grayscale.light5, error.base);
    backgroundColorActive = mix(0.2, grayscale.dark2, error.base);
    color = grayscale.light5;
    colorHover = color;
  } else if (buttonStyle === 'warning') {
    backgroundColor = warning.base;
    backgroundColorHover = mix(0.1, grayscale.dark2, warning.base);
    backgroundColorActive = mix(0.2, grayscale.dark2, warning.base);
    color = grayscale.light5;
    colorHover = color;
  } else if (buttonStyle === 'success') {
    backgroundColor = success.base;
    backgroundColorHover = mix(0.1, grayscale.light5, success.base);
    backgroundColorActive = mix(0.2, grayscale.dark2, success.base);
    color = grayscale.light5;
    colorHover = color;
  } else if (buttonStyle === 'link') {
    backgroundColor = 'transparent';
    backgroundColorHover = 'transparent';
    backgroundColorActive = 'transparent';
    colorHover = primary.base;
  }

  const element = children as ReactElement;

  let renderedChildren = [];
  if (element && element.type === React.Fragment) {
    renderedChildren = Children.toArray(element.props.children);
  } else {
    renderedChildren = Children.toArray(children);
  }
  const firstChildMargin =
    showMarginRight && renderedChildren.length > 1 ? theme.gridUnit * 2 : 0;

  const button = (
    <AntdButton
      href={disabled ? undefined : href}
      disabled={disabled}
      className={cx(className, 'superset-button', { cta: !!cta })}
      css={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1.5715,
        fontSize: typography.sizes.s,
        fontWeight: typography.weights.bold,
        height,
        textTransform: 'uppercase',
        padding: `0px ${padding}px`,
        transition: `all ${transitionTiming}s`,
        minWidth: cta ? theme.gridUnit * 36 : undefined,
        minHeight: cta ? theme.gridUnit * 8 : undefined,
        boxShadow: 'none',
        borderWidth,
        borderStyle,
        borderColor,
        borderRadius,
        color,
        backgroundColor,
        '&:hover': {
          color: colorHover,
          backgroundColor: backgroundColorHover,
          borderColor: borderColorHover,
        },
        '&:active': {
          color,
          backgroundColor: backgroundColorActive,
        },
        '&:focus': {
          color,
          backgroundColor,
          borderColor,
        },
        '&[disabled], &[disabled]:hover': {
          color: grayscale.base,
          backgroundColor:
            buttonStyle === 'link' ? 'transparent' : backgroundColorDisabled,
          borderColor:
            buttonStyle === 'link' ? 'transparent' : borderColorDisabled,
          pointerEvents: 'none',
        },
        marginLeft: 0,
        '& + .superset-button': {
          marginLeft: theme.gridUnit * 2,
        },
        '& > :first-of-type': {
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
      <Tooltip
        placement={placement}
        id={`${kebabCase(tooltip)}-tooltip`}
        title={tooltip}
      >
        {/* this ternary wraps the button in a span so that the tooltip shows up
        when the button is disabled.  */}
        {disabled ? (
          <span css={{ cursor: 'not-allowed' }}>{button}</span>
        ) : (
          button
        )}
      </Tooltip>
    );
  }

  return button;
}
