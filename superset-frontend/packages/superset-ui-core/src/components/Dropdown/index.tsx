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

import { ReactElement, cloneElement } from 'react';
import {
  Dropdown as AntdDropdown,
  DropdownProps,
  Space,
} from 'antd';
import { styled, useTheme } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';

import { Button, type ButtonProps } from '../Button';
import {
  IconOrientation,
  type NoAnimationDropdownProps,
  type MenuDotsDropdownProps,
} from './types';

const MenuDots = styled.div`
  width: ${({ theme }) => theme.sizeUnit * 0.75}px;
  height: ${({ theme }) => theme.sizeUnit * 0.75}px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.grayscale.light1};
  font-weight: ${({ theme }) => theme.fontWeightNormal};
  display: inline-flex;
  position: relative;

  &:hover {
    background-color: ${({ theme }) => theme.colorPrimary};
    &::before,
    &::after {
      background-color: ${({ theme }) => theme.colorPrimary};
    }
  }

  &::before,
  &::after {
    position: absolute;
    content: ' ';
    width: ${({ theme }) => theme.sizeUnit * 0.75}px;
    height: ${({ theme }) => theme.sizeUnit * 0.75}px;
    border-radius: 50%;
    background-color: ${({ theme }) => theme.colors.grayscale.light1};
  }

  &::before {
    top: ${({ theme }) => theme.sizeUnit}px;
  }

  &::after {
    bottom: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const MenuDotsWrapper = styled.div`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  padding-left: ${({ theme }) => theme.sizeUnit}px;
`;

const RenderIcon = (
  iconOrientation: IconOrientation = IconOrientation.Vertical,
) => {
  const component =
    iconOrientation === IconOrientation.Horizontal ? (
      <Icons.EllipsisOutlined iconSize="xl" />
    ) : (
      <MenuDots />
    );
  return component;
};

export const MenuDotsDropdown = ({
  overlay,
  iconOrientation = IconOrientation.Vertical,
  ...rest
}: MenuDotsDropdownProps) => (
  <AntdDropdown popupRender={() => overlay} {...rest}>
    <MenuDotsWrapper data-test="dropdown-trigger">
      {RenderIcon(iconOrientation)}
    </MenuDotsWrapper>
  </AntdDropdown>
);

export const NoAnimationDropdown = (props: NoAnimationDropdownProps) => {
  const { children, onBlur, onKeyDown, ...rest } = props;
  const childrenWithProps = cloneElement(children as ReactElement, {
    onBlur,
    onKeyDown,
  });

  return (
    <AntdDropdown autoFocus overlayStyle={props.overlayStyle} {...rest}>
      {childrenWithProps}
    </AntdDropdown>
  );
};

const CustomDropdownButton = (
  props: ButtonProps & DropdownProps,
) => {
  const theme = useTheme();
  const {
    // Dropdown-specific props
    overlay,
    placement = 'bottomRight',

    // Button-specific props
    children,
    buttonStyle,
    disabled,
    ...rest
  } = props;

  return (
    <Space.Compact
      css={{
        display: 'inline-flex',
        '& .superset-button + .superset-button': {
          marginLeft: 0,
        },
      }}
    >
      <Button
        {...rest}
        buttonStyle={buttonStyle}
        disabled={disabled}
        showMarginRight={false}
      >
        {children}
      </Button>
      <Dropdown overlay={overlay} placement={placement}>
        <Button
          buttonStyle={buttonStyle}
          disabled={disabled}
          showMarginRight={false}
          icon={<Icons.CaretDownOutlined />}
          css={{
            padding: `0 ${theme.sizeUnit * 2}px`,
            // Minor style adjustment for the trigger
            borderLeft:
              buttonStyle === 'tertiary'
                ? `1px solid ${theme.colors.grayscale.light2}`
                : 'none',
          }}
        />
      </Dropdown>
    </Space.Compact>
  );
};

export const Dropdown = (props: DropdownProps) => (
  <AntdDropdown autoFocus {...props} />
);

Dropdown.Button = CustomDropdownButton;

export type { DropdownProps, NoAnimationDropdownProps, MenuDotsDropdownProps };