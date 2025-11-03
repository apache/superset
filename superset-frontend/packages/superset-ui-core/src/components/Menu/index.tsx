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
import { styled, css } from '@superset-ui/core';
import { ReactElement } from 'react';
import { Menu as AntdMenu } from 'antd';
import { MenuProps as AntdMenuProps } from 'antd/es/menu';

export type MenuProps = AntdMenuProps;
export type { ItemType, MenuItemType } from 'antd/es/menu/interface';

export enum MenuItemKeyEnum {
  MenuItem = 'menu-item',
  SubMenu = 'submenu',
  SubMenuItem = 'submenu-item',
}

export type AntdMenuTypeRef = {
  current: { props: { parentMenu: typeof AntdMenu } };
};

export type AntdMenuItemType = ReactElement & {
  ref: AntdMenuTypeRef;
  type: { displayName: string; isSubMenu: number };
};

export type MenuItemChildType = AntdMenuItemType;

const StyledMenuItem = styled(AntdMenu.Item)`
  ${({ theme }) => css`
    a {
      text-decoration: none;
    }
    &.ant-menu-item {
      div {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      a {
        transition: background-color ${theme.motionDurationMid};
        &:after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          width: 0;
          height: 3px;
          opacity: 0;
          transform: translateX(-50%);
          transition: translate ${theme.motionDurationMid};
        }
        &:focus {
          @media (max-width: 767px) {
            background-color: ${theme.colorPrimaryBgHover};
          }
        }
      }
    }
  `}
`;

const StyledMenu = styled(AntdMenu)`
  &.ant-menu-horizontal {
    background-color: inherit;
    border-bottom: 1px solid transparent;
  }
`;

const StyledNav = styled(AntdMenu)`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    height: 100%;
    gap: 0;
    border-bottom: 0;
    line-height: ${theme.lineHeight};
    &.ant-menu-horizontal > .ant-menu-item {
      height: 100%;
      display: flex;
      align-items: center;
      margin: 0;
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
      ::after {
        content: '';
        position: absolute;
        width: 98%;
        height: 2px;
        background-color: ${theme.colorPrimaryBorderHover};
        bottom: ${theme.sizeUnit / 4}px;
        left: 0;
        transform: scale(0);
        transition: 0.2s all ease-out;
      }
      :hover::after {
        transform: scale(1);
      }
    }
    &.ant-menu-horizontal > .ant-menu-item-selected::after {
      transform: scale(1);
    }
  `}
`;

const StyledSubMenu = styled(AntdMenu.SubMenu)`
  ${({ theme }) => css`
    .ant-menu-submenu-open,
    .ant-menu-submenu-active {
      .ant-menu-submenu-title {
        &:after {
          opacity: 1;
          width: calc(100% - 1);
        }
      }
    }
    .ant-menu-submenu-title {
      display: flex;
      flex-direction: row-reverse;
      &:after {
        content: '';
        position: absolute;
        bottom: -3px;
        left: 50%;
        width: 0;
        height: 3px;
        opacity: 0;
        transform: translateX(-50%);
        transition: all ${theme.motionDurationMid};
      }
    }
  `}
`;

export type MenuMode = AntdMenuProps['mode'];
export type MenuItem = Required<AntdMenuProps>['items'][number];

export const Menu = Object.assign(StyledMenu, {
  Item: StyledMenuItem,
  SubMenu: StyledSubMenu,
  Divider: AntdMenu.Divider,
  ItemGroup: AntdMenu.ItemGroup,
});

export const MainNav = Object.assign(StyledNav, {
  Item: StyledMenuItem,
  SubMenu: StyledSubMenu,
  Divider: AntdMenu.Divider,
  ItemGroup: AntdMenu.ItemGroup,
});
