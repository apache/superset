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
import {
  Button as BootstrapButton,
  Tooltip,
  OverlayTrigger,
} from 'react-bootstrap';
import styled from '@superset-ui/style';

export type OnClickHandler = React.MouseEventHandler<BootstrapButton>;

export interface ButtonProps {
  className?: string;
  tooltip?: string;
  placement?: string;
  onClick?: OnClickHandler;
  disabled?: boolean;
  bsStyle?: string;
  btnStyles?: string;
  bsSize?: BootstrapButton.ButtonProps['bsSize'];
  style?: BootstrapButton.ButtonProps['style'];
  children?: React.ReactNode;
}

const BUTTON_WRAPPER_STYLE = { display: 'inline-block', cursor: 'not-allowed' };

const SupersetButton = styled(BootstrapButton)`
  &.supersetButton {
    border-radius: ${({ theme }) => theme.borderRadius}px;
    border: none;
    color: ${({ theme }) => theme.colors.secondary.light5};
    font-size: ${({ theme }) => theme.typography.sizes.s};
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    min-width: ${({ theme }) => theme.gridUnit * 36}px;
    min-height: ${({ theme }) => theme.gridUnit * 8}px;
    text-transform: uppercase;
    margin-left: ${({ theme }) => theme.gridUnit * 4}px;
    &:first-of-type {
      margin-left: 0;
    }

    i {
      padding: 0 ${({ theme }) => theme.gridUnit * 2}px 0 0;
    }

    &.primary {
      background-color: ${({ theme }) => theme.colors.primary.base};
    }
    &.secondary {
      color: ${({ theme }) => theme.colors.primary.base};
      background-color: ${({ theme }) => theme.colors.primary.light4};
    }
    &.danger {
      background-color: ${({ theme }) => theme.colors.error.base};
    }
  }
`;

export default function Button(props: ButtonProps) {
  const buttonProps = {
    ...props,
    bsSize: props.bsSize || 'sm',
    placement: props.placement || 'top',
  };
  const tooltip = props.tooltip;
  const placement = props.placement;
  delete buttonProps.tooltip;
  delete buttonProps.placement;

  let button = (
    <SupersetButton {...buttonProps}>{props.children}</SupersetButton>
  );
  if (tooltip) {
    if (props.disabled) {
      // Working around the fact that tooltips don't get triggered when buttons are disabled
      // https://github.com/react-bootstrap/react-bootstrap/issues/1588
      buttonProps.style = { pointerEvents: 'none' };
      button = (
        <div style={BUTTON_WRAPPER_STYLE}>
          <SupersetButton {...buttonProps}>{props.children}</SupersetButton>
        </div>
      );
    }
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
