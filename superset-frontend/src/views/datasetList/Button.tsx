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

type Button = 'default' | 'primary' | 'secondary';

interface Props {
  bsStyle: Button;
  disabled?: boolean;
  onClick: (...args: any[]) => any;
  title: string | React.ReactNode;
}

const StyledButton = styled(BaseButton)`
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: 8px;
  text-transform: uppercase;
  width: 160px;
  &.btn[disabled],
  &.btn[disabled]:hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light2};
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }
  &.btn-primary,
  &.btn-primary:hover {
    background-color: ${({ theme }) => theme.colors.primary.base};
  }
  &.btn-secondary {
    background-color: ${({ theme }) => theme.colors.primary.light4};
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

export default function Button({
  bsStyle = 'default',
  disabled,
  onClick,
  title,
}: Props) {
  return (
    <StyledButton bsStyle={bsStyle} disabled={disabled} onClick={onClick}>
      {title}
    </StyledButton>
  );
}
