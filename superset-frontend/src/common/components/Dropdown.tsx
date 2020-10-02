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
import { Dropdown as AntdDropdown } from 'src/common/components';
import { css } from '@emotion/core';
import { styled } from '@superset-ui/core';

const dotStyle = css`
  width: 3px;
  height: 3px;
  border-radius: 1.5px;
  background-color: #bababa;
`;

const MenuDots = styled.div`
  ${dotStyle};
  font-weight: ${({ theme }) => theme.typography.weights.normal};
  display: inline-flex;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary.base};

    &::before,
    &::after {
      background-color: ${({ theme }) => theme.colors.primary.base};
    }
  }

  &::before,
  &::after {
    position: absolute;
    content: ' ';
    ${dotStyle};
  }

  &::before {
    transform: translateY(-${({ theme }) => theme.gridUnit}px);
  }

  &::after {
    transform: translateY(${({ theme }) => theme.gridUnit}px);
  }
`;

const MenuDotsWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  padding-left: ${({ theme }) => theme.gridUnit}px;
`;

interface DropdownProps {
  overlay: React.ReactElement;
}

export const Dropdown = ({ overlay, ...rest }: DropdownProps) => (
  <AntdDropdown overlay={overlay} {...rest}>
    <MenuDotsWrapper>
      <MenuDots />
    </MenuDotsWrapper>
  </AntdDropdown>
);
