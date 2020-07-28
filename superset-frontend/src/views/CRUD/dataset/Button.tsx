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
import styled from '@superset-ui/style';
import BaseButton from 'src/components/Button';

interface ModalProps {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  padding?: number;
  bsStyle?: 'default' | 'primary' | 'danger';
  width?: number;
}

const StyledButton = styled(BaseButton)`
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: none;
  padding: ${(props: ModalProps) => props.padding || 8}px;
  text-transform: uppercase;
  width: ${(props: ModalProps) => props.width || 160}px;

  &.btn,
  &.btn:hover {
    background-color: ${({ theme }) => theme.colors.primary.light4};
    color: ${({ theme }) => theme.colors.primary.base};
  }
  &.btn[disabled],
  &.btn[disabled]:hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light2};
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
  &.btn-primary,
  &.btn-primary:hover {
    background-color: ${({ theme }) => theme.colors.primary.base};
    color: ${({ theme }) => theme.colors.grayscale.light5};
  }
  &.btn-danger,
  &.btn-danger:hover {
    background-color: ${({ theme }) => theme.colors.error.base};
    color: ${({ theme }) => theme.colors.grayscale.light5};
  }
`;

export default function Modal({
  bsStyle = 'default',
  disabled,
  onClick,
  children,
}: ModalProps) {
  return (
    <StyledButton disabled={disabled} bsStyle={bsStyle} onClick={onClick}>
      {children}
    </StyledButton>
  );
}
