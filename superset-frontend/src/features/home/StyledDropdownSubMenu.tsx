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
import { styled, css, SupersetTheme } from '@superset-ui/core';
import { MainNav } from '@superset-ui/core/components/Menu';

const { SubMenu } = MainNav;

/**
 * Shared CSS styles for consistent caret positioning across all menu types.
 * Works with both SubMenu components and MenuItem API.
 */
export const menuCaretStyles = (theme: SupersetTheme) => css`
  [data-icon='caret-down'] {
    color: ${theme.colors.grayscale.base};
    font-size: ${theme.fontSizeXS}px;
    margin-left: ${theme.sizeUnit}px;
  }
  &.ant-menu-submenu {
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    display: flex;
    align-items: center;
    height: 100%;
  }
  &.ant-menu-submenu-active {
    .ant-menu-title-content {
      color: ${theme.colorPrimary};
    }
  }

  /* For MenuItem API menus - target both potential caret locations */
  &.ant-menu-horizontal {
    .ant-menu-submenu {
      .ant-menu-submenu-title {
        /* Override default flex direction to put icon at end */
        display: flex;
        flex-direction: row-reverse;
        justify-content: flex-end;
        align-items: center;

        /* Style the caret icon */
        .anticon {
          margin-left: ${theme.sizeUnit}px;
          margin-right: 0;
          color: ${theme.colors.grayscale.base};
          font-size: ${theme.fontSizeXS}px;
        }

        .ant-menu-submenu-arrow {
          margin-left: ${theme.sizeUnit}px;
          margin-right: 0;
        }
      }
    }
  }
`;

/**
 * Styled submenu component for left menu (using SubMenu components).
 */
export const StyledDropdownSubMenu = styled(SubMenu)`
  ${({ theme }) => menuCaretStyles(theme)}
`;
