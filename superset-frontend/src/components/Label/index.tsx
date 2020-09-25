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
import React, { CSSProperties } from 'react';
import { Label as BootstrapLabel } from 'react-bootstrap';
import { styled } from '@superset-ui/core';
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
  style?: CSSProperties;
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
  border-width: 1px;
  border-style: solid;
  cursor: ${({ onClick }) => (onClick ? 'pointer' : 'default')};
  transition: background-color ${({ theme }) => theme.transitionTiming}s;
  &.label-warning {
    background-color: ${({ theme }) => theme.colors.warning.base};
    border-color: ${({ theme, onClick }) =>
      onClick ? theme.colors.warning.dark1 : 'transparent'};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.warning.dark1 : theme.colors.warning.base};
      border-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.warning.dark2 : 'transparent'};
    }
  }
  &.label-danger {
    background-color: ${({ theme }) => theme.colors.error.base};
    border-color: ${({ theme, onClick }) =>
      onClick ? theme.colors.error.dark1 : 'transparent'};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.error.dark1 : theme.colors.error.base};
      border-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.error.dark2 : 'transparent'};
    }
  }
  &.label-success {
    background-color: ${({ theme }) => theme.colors.success.base};
    border-color: ${({ theme, onClick }) =>
      onClick ? theme.colors.success.dark1 : 'transparent'};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.success.dark1 : theme.colors.success.base};
      border-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.success.dark2 : 'transparent'};
    }
  }
  &.label-default {
    background-color: ${({ theme }) => theme.colors.grayscale.light3};
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    border-color: ${({ theme, onClick }) =>
      onClick ? theme.colors.grayscale.light1 : 'transparent'};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.primary.light2 : theme.colors.grayscale.light3};
      border-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.primary.light1 : 'transparent'};
    }
  }
  &.label-info {
    background-color: ${({ theme }) => theme.colors.info};
    border-color: ${({ theme, onClick }) =>
      onClick ? theme.colors.info.dark1 : 'transparent'};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.info.dark1 : theme.colors.info.base};
      border-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.info.dark2 : 'transparent'};
    }
  }
  &.label-primary {
    background-color: ${({ theme }) => theme.colors.primary.base};
    border-color: ${({ theme, onClick }) =>
      onClick ? theme.colors.primary.dark1 : 'transparent'};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.primary.dark2 : theme.colors.primary.base};
      border-color: ${({ theme, onClick }) =>
        onClick
          ? theme.colors.primary.dark2
          : 'transparent'}; /* would be nice if we had a darker color, but that's the floor! */
    }
  }
  /* note this is NOT a supported bootstrap label Style... this overrides default */
  &.label-secondary {
    background-color: ${({ theme }) => theme.colors.secondary.base};
    color: ${({ theme }) => theme.colors.grayscale.light4};
    border-color: ${({ theme, onClick }) =>
      onClick ? theme.colors.secondary.dark1 : 'inherit'};
    &:hover {
      background-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.secondary.dark1 : theme.colors.secondary.base};
      border-color: ${({ theme, onClick }) =>
        onClick ? theme.colors.secondary.dark2 : 'inherit'};
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
