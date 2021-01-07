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
import React, { ReactNode } from 'react';
import { Dropdown as AntdDropdown, Tooltip } from 'src/common/components';
import { styled } from '@superset-ui/core';
import kebabCase from 'lodash/kebabCase';

const MenuDots = styled.div`
  width: ${({ theme }) => theme.gridUnit * 0.75}px;
  height: ${({ theme }) => theme.gridUnit * 0.75}px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.grayscale.light1};

  font-weight: ${({ theme }) => theme.typography.weights.normal};
  display: inline-flex;
  position: relative;

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
    width: ${({ theme }) => theme.gridUnit * 0.75}px;
    height: ${({ theme }) => theme.gridUnit * 0.75}px;
    border-radius: 50%;
    background-color: ${({ theme }) => theme.colors.grayscale.light1};
  }

  &::before {
    top: ${({ theme }) => theme.gridUnit}px;
  }

  &::after {
    bottom: ${({ theme }) => theme.gridUnit}px;
  }
`;

const MenuDotsWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  padding-left: ${({ theme }) => theme.gridUnit}px;
`;

const StyledDropdownButton = styled.div`
  .ant-btn-group {
    button.ant-btn {
      background-color: ${({ theme }) => theme.colors.primary.dark1};
      border-color: transparent;
      color: ${({ theme }) => theme.colors.grayscale.light5};
      font-size: 12px;
      line-height: 13px;
      outline: none;
      text-transform: uppercase;
      &:first-of-type {
        border-radius: ${({ theme }) =>
          `${theme.gridUnit}px 0 0 ${theme.gridUnit}px`};
        margin: 0;
        width: 120px;
      }
      &:last-of-type {
        margin: 0;
        border-radius: ${({ theme }) =>
          `0 ${theme.gridUnit}px ${theme.gridUnit}px 0`};
        width: ${({ theme }) => theme.gridUnit * 9}px;
        &:before,
        &:hover:before {
          border-left: 1px solid ${({ theme }) => theme.colors.grayscale.light5};
          content: '';
          display: block;
          height: 23px;
          margin: 0;
          position: absolute;
          top: ${({ theme }) => theme.gridUnit * 0.75}px;
          width: ${({ theme }) => theme.gridUnit * 0.25}px;
        }
      }
    }
  }
`;

export interface DropdownProps {
  overlay: React.ReactElement;
  tooltip?: string;
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  buttonsRender?: ((buttons: ReactNode[]) => ReactNode[]) | undefined;
}

export const Dropdown = ({ overlay, ...rest }: DropdownProps) => (
  <AntdDropdown overlay={overlay} {...rest}>
    <MenuDotsWrapper>
      <MenuDots />
    </MenuDotsWrapper>
  </AntdDropdown>
);

export const DropdownButton = ({
  overlay,
  tooltip,
  placement,
  ...rest
}: DropdownProps) => {
  const buildButton = (
    props: {
      buttonsRender?: DropdownProps['buttonsRender'];
    } = {},
  ) => (
    <StyledDropdownButton>
      <AntdDropdown.Button overlay={overlay} {...rest} {...props} />
    </StyledDropdownButton>
  );
  if (tooltip) {
    return buildButton({
      buttonsRender: ([leftButton, rightButton]) => [
        <Tooltip
          placement={placement}
          id={`${kebabCase(tooltip)}-tooltip`}
          title={tooltip}
        >
          {leftButton}
        </Tooltip>,
        rightButton,
      ],
    });
  }
  return buildButton();
};
