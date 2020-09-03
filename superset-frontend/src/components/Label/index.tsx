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
import { Label as BootstrapLabel } from 'react-bootstrap';
import styled from '@superset-ui/style';
import cx from 'classnames';

export type OnClickHandler = React.MouseEventHandler<BootstrapLabel>;

export interface LabelProps {
  key?: string;
  className?: string;
  id?: string;
  tooltip?: string;
  placement?: string;
  onClick?: OnClickHandler;
  bsStyle?: string;
  style?: BootstrapLabel.LabelProps['style'];
  children?: React.ReactNode;
}

const SupersetLabel = styled(BootstrapLabel)`
  /* un-bunch them! */
  margin-right: ${({ theme }) => theme.gridUnit}px;
  &:first-of-type {
    margin-left: 0;
  }
  &:last-of-type {
    margin-right: 0;
  }

  cursor: ${({ onClick }) => (onClick ? 'pointer' : 'default')};
  transition: background-color ${({ theme }) => theme.transitionTiming}s;
  &.label-warning {
    background-color: ${({ theme }) => theme.colors.warning.base};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.warning.dark1 : theme.colors.warning.base};
    }
  }
  &.label-danger {
    background-color: ${({ theme }) => theme.colors.error.base};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.error.dark1 : theme.colors.error.base};
    }
  }
  &.label-success {
    background-color: ${({ theme }) => theme.colors.success.base};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.success.dark1 : theme.colors.success.base};
    }
  }
  &.label-default {
    background-color: ${({ theme }) => theme.colors.grayscale.base};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.grayscale.dark1 : theme.colors.grayscale.base};
    }
  }
  &.label-info {
    background-color: ${({ theme }) => theme.colors.info};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.info.dark1 : theme.colors.info.base};
    }
  }
  &.label-primary {
    background-color: ${({ theme }) => theme.colors.primary.base};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.primary.dark1 : theme.colors.primary.base};
    }
  }
  /* note this is NOT a supported bootstrap label Style... this overrides default */
  &.label-secondary {
    background-color: ${({ theme }) => theme.colors.secondary.base};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.secondary.dark1 : theme.colors.secondary.base};
    }
  }
`;

export default function Label(props: LabelProps) {
  const officialBootstrapStyles = [
    'success',
    'warning',
    'danger',
    'info',
    'default',
    'primary',
  ];
  const labelProps = {
    ...props,
    placement: props.placement || 'top',
    bsStyle: officialBootstrapStyles.includes(props.bsStyle || '')
      ? props.bsStyle
      : 'default',
    className: cx(props.className, {
      [`label-${props.bsStyle}`]: !officialBootstrapStyles.includes(
        props.bsStyle || '',
      ),
    }),
  };
  return <SupersetLabel {...labelProps}>{props.children}</SupersetLabel>;
}
