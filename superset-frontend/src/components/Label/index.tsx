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

export type OnClickHandler = React.MouseEventHandler<BootstrapLabel>;

export interface LabelProps {
  key?: string;
  className?: string;
  tooltip?: string;
  placement?: string;
  onClick?: OnClickHandler;
  bsStyle?: string;
  style?: BootstrapLabel.LabelProps['style'];
  children?: React.ReactNode;
}

const SupersetLabel = styled(BootstrapLabel)`
  &.supersetLabel {
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

export default function Label(props: LabelProps) {
  const labelProps = {
    ...props,
    placement: props.placement || 'top',
  };
  return <SupersetLabel {...labelProps}>{props.children}</SupersetLabel>;
}
