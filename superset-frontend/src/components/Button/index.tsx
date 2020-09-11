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
import React from 'react';
import { kebabCase } from 'lodash';
import { mix } from 'polished';
import cx from 'classnames';
import {
  Button as BootstrapButton,
  Tooltip,
  OverlayTrigger,
  MenuItem,
} from 'react-bootstrap';
import { styled } from '@superset-ui/core';

export type OnClickHandler = React.MouseEventHandler<BootstrapButton>;

export interface DropdownItemProps {
  label: string;
  url: string;
  icon?: string;
}

export interface ButtonProps {
  className?: string;
  tooltip?: string;
  placement?: string;
  onClick?: OnClickHandler;
  disabled?: boolean;
  buttonStyle?: string;
  btnStyles?: string;
  buttonSize?: BootstrapButton.ButtonProps['bsSize'];
  style?: BootstrapButton.ButtonProps['style'];
  children?: React.ReactNode;
  dropdownItems?: DropdownItemProps[];
  href?: string; // React-Bootstrap creates a link when this is passed in.
  target?: string; // React-Bootstrap creates a link when this is passed in.
  type?: string; // React-Bootstrap supports this when rendering an HTML button element
  cta?: boolean;
}

const BUTTON_WRAPPER_STYLE = { display: 'inline-block', cursor: 'not-allowed' };

const SupersetButton = styled(BootstrapButton)`
  &:focus,
  &:active,
  &:focus:active {
    outline: none;
    box-shadow: none;
  }
  transition: all ${({ theme }) => theme.transitionTiming}s;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: none;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  margin-left: ${({ theme }) => theme.gridUnit * 4}px;
  &:first-of-type {
    margin-left: 0;
  }

  i {
    padding: 0 ${({ theme }) => theme.gridUnit * 2}px 0 0;
  }

  /* SIP 34 colors! */
  &.btn {
    border: 1px solid transparent; /* this just makes sure the height is the same as tertiary/dashed buttons */
    &:hover,
    &:active {
      border: 1px solid transparent;
    }
    &-default,
    &-secondary {
      background-color: ${({ theme }) => theme.colors.primary.light4};
      color: ${({ theme }) => theme.colors.primary.dark1};
      &:hover {
        background-color: ${({ theme }) =>
          mix(0.1, theme.colors.grayscale.light5, theme.colors.primary.light4)};
        color: ${({ theme }) => theme.colors.primary.dark1};
      }
      &:active {
        background-color: ${({ theme }) =>
          mix(0.25, theme.colors.primary.base, theme.colors.primary.light4)};
        color: ${({ theme }) => theme.colors.primary.dark1};
      }
    }
    &-tertiary,
    &-dashed {
      border-width: 1px;
      border-style: solid;
      background-color: ${({ theme }) => theme.colors.grayscale.light5};
      color: ${({ theme }) => theme.colors.primary.dark1};
      border-color: ${({ theme }) => theme.colors.primary.dark1};
      &:hover {
        background-color: ${({ theme }) => theme.colors.grayscale.light5};
        color: ${({ theme }) => theme.colors.primary.dark1};
        border-color: ${({ theme }) => theme.colors.primary.light1};
      }
      &:active {
        background-color: ${({ theme }) => theme.colors.grayscale.light5};
        color: ${({ theme }) => theme.colors.primary.dark1};
        border-color: ${({ theme }) => theme.colors.primary.dark1};
      }
      &[disabled],
      &[disabled]:hover {
        background-color: ${({ theme }) => theme.colors.grayscale.light5};
        color: ${({ theme }) => theme.colors.grayscale.base};
        border-color: ${({ theme }) => theme.colors.grayscale.light2};
      }
    }
    &-dashed {
      border-style: dashed;
      &:hover,
      &:active {
        border-style: dashed;
      }
    }
    &-link {
      background: none;
      text-decoration: none;
      color: ${({ theme }) => theme.colors.primary.dark1};
      &:hover {
        background: none;
        color: ${({ theme }) => theme.colors.primary.base};
      }
      &:active {
        background: none;
        color: ${({ theme }) => theme.colors.primary.dark1};
      }
      &[disabled],
      &[disabled]:hover {
        background: none;
        color: ${({ theme }) => theme.colors.grayscale.base};
      }
    }
    &-primary {
      background-color: ${({ theme }) => theme.colors.primary.dark1};
      color: ${({ theme }) => theme.colors.grayscale.light5};
      &:hover {
        background-color: ${({ theme }) =>
          mix(0.1, theme.colors.grayscale.light5, theme.colors.primary.dark1)};
        color: ${({ theme }) => theme.colors.grayscale.light5};
      }
      &:active {
        background-color: ${({ theme }) =>
          mix(0.2, theme.colors.grayscale.dark2, theme.colors.primary.dark1)};
        color: ${({ theme }) => theme.colors.grayscale.light5};
      }
    }
    &-danger {
      background-color: ${({ theme }) => theme.colors.error.base};
      color: ${({ theme }) => theme.colors.grayscale.light5};
      &:hover {
        background-color: ${({ theme }) =>
          mix(0.1, theme.colors.grayscale.light5, theme.colors.error.base)};
        color: ${({ theme }) => theme.colors.grayscale.light5};
      }
      &:active {
        background-color: ${({ theme }) =>
          mix(0.2, theme.colors.grayscale.dark2, theme.colors.error.base)};
        color: ${({ theme }) => theme.colors.grayscale.light5};
      }
    }
    &-success {
      background-color: ${({ theme }) => theme.colors.success.base};
      color: ${({ theme }) => theme.colors.grayscale.light5};
      &:hover {
        background-color: ${({ theme }) =>
          mix(0.1, theme.colors.grayscale.light5, theme.colors.success.base)};
        color: ${({ theme }) => theme.colors.grayscale.light5};
      }
      &:active {
        background-color: ${({ theme }) =>
          mix(0.2, theme.colors.grayscale.dark2, theme.colors.success.base)};
        color: ${({ theme }) => theme.colors.grayscale.light5};
      }
    }
    &-warning {
      background-color: ${({ theme }) => theme.colors.warning.base};
      color: ${({ theme }) => theme.colors.grayscale.light5};
      &:hover {
        background-color: ${({ theme }) =>
          mix(0.1, theme.colors.grayscale.light5, theme.colors.warning.base)};
        color: ${({ theme }) => theme.colors.grayscale.light5};
      }
      &:active {
        background-color: ${({ theme }) =>
          mix(0.2, theme.colors.grayscale.dark2, theme.colors.warning.base)};
        color: ${({ theme }) => theme.colors.grayscale.light5};
      }
    }
    &-info {
      background-color: ${({ theme }) => theme.colors.info.dark1};
      color: ${({ theme }) => theme.colors.grayscale.light5};
      &:hover {
        background-color: ${({ theme }) =>
          mix(0.1, theme.colors.grayscale.light5, theme.colors.info.dark1)};
        color: ${({ theme }) => theme.colors.grayscale.light5};
      }
      &:active {
        background-color: ${({ theme }) =>
          mix(0.2, theme.colors.grayscale.dark2, theme.colors.info.dark1)};
        color: ${({ theme }) => theme.colors.grayscale.light5};
      }
    }
    &[disabled],
    &[disabled]:hover {
      background-color: ${({ theme }) => theme.colors.grayscale.light2};
      color: ${({ theme }) => theme.colors.grayscale.light1};
    }
  }

  /* big Call to Action buttons */
  &.cta {
    min-width: ${({ theme }) => theme.gridUnit * 36}px;
    min-height: ${({ theme }) => theme.gridUnit * 8}px;
    text-transform: uppercase;
  }
`;

export default function Button(props: ButtonProps) {
  const buttonProps = {
    ...props,
    bsSize: props.buttonSize,
    placement: props.placement || 'top',
  };
  const tooltip = props.tooltip;
  const placement = props.placement;
  const dropdownItems = props.dropdownItems;
  delete buttonProps.tooltip;
  delete buttonProps.placement;

  if (tooltip && props.disabled) {
    // Working around the fact that tooltips don't get triggered when buttons are disabled
    // https://github.com/react-bootstrap/react-bootstrap/issues/1588
    buttonProps.style = { pointerEvents: 'none' };
  }

  const officialBootstrapStyles = [
    'success',
    'warning',
    'danger',
    'info',
    'default',
    'primary',
  ];

  const transformedProps = {
    ...buttonProps,
    bsStyle: officialBootstrapStyles.includes(props.buttonStyle || '')
      ? props.buttonStyle
      : 'default',
    className: cx(props.className, {
      cta: !!buttonProps.cta,
      [`btn-${props.buttonStyle}`]: !officialBootstrapStyles.includes(
        props.buttonStyle || '',
      ),
    }),
  };
  delete transformedProps.dropdownItems;
  delete transformedProps.buttonSize;
  delete transformedProps.buttonStyle;
  delete transformedProps.cta;

  let button = (
    <SupersetButton {...transformedProps}>{props.children}</SupersetButton>
  );

  if (dropdownItems) {
    button = (
      <div style={BUTTON_WRAPPER_STYLE}>
        <SupersetButton {...transformedProps} data-toggle="dropdown">
          {props.children}
        </SupersetButton>
        <ul className="dropdown-menu">
          {dropdownItems.map((dropdownItem: DropdownItemProps) => (
            <MenuItem key={`${dropdownItem.label}`} href={dropdownItem.url}>
              <i className={`fa ${dropdownItem.icon}`} />
              &nbsp; {dropdownItem.label}
            </MenuItem>
          ))}
        </ul>
      </div>
    );
  }

  if (tooltip) {
    return (
      <OverlayTrigger
        placement={placement}
        overlay={
          <Tooltip id={`${kebabCase(tooltip)}-tooltip`}>{tooltip}</Tooltip>
        }
      >
        {button}
      </OverlayTrigger>
    );
  }

  return button;
}
