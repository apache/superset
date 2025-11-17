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
import { useState, useEffect } from 'react';
import { styled, css, useTheme } from '@superset-ui/core';
import { getUrlParam } from 'src/utils/urlUtils';
import { MainNav, MenuItem } from '@superset-ui/core/components/Menu';
import { Tooltip, Grid, Row, Col, Image } from '@superset-ui/core/components';
import { GenericLink } from 'src/components';
import { NavLink, useLocation } from 'react-router-dom';
import { Icons } from '@superset-ui/core/components/Icons';
import { Typography } from '@superset-ui/core/components/Typography';
import { useUiConfig } from 'src/components/UiConfigContext';
import { URL_PARAMS } from 'src/constants';
import {
  MenuObjectChildProps,
  MenuObjectProps,
  MenuData,
} from 'src/types/bootstrapTypes';
import RightMenu from './RightMenu';
import { NAVBAR_MENU_POPUP_OFFSET } from './commonMenuData';

interface MenuProps {
  data: MenuData;
  isFrontendRoute?: (path?: string) => boolean;
}

const StyledHeader = styled.header`
  ${({ theme }) => css`
    background-color: ${theme.colorBgContainer};
    border-bottom: 1px solid ${theme.colorBorderSecondary};
    padding: 0 ${theme.sizeUnit * 4}px;
    z-index: 10;

    &:nth-last-of-type(2) nav {
      margin-bottom: 2px;
    }

    .caret {
      display: none;
    }
  `}
`;

const StyledBrandText = styled.div`
  ${({ theme }) => css`
    border-left: 1px solid ${theme.colorBorderSecondary};
    border-right: 1px solid ${theme.colorBorderSecondary};
    height: 100%;
    color: ${theme.colorText};
    padding-left: ${theme.sizeUnit * 4}px;
    padding-right: ${theme.sizeUnit * 4}px;
    font-size: ${theme.fontSizeLG}px;
    float: left;
    display: flex;
    flex-direction: column;
    justify-content: center;

    span {
      max-width: ${theme.sizeUnit * 58}px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 1127px) {
      display: none;
    }
  `}
`;

const StyledMainNav = styled(MainNav)`
  ${({ theme }) => css`
    .ant-menu-item .ant-menu-item-icon + span,
    .ant-menu-submenu-title .ant-menu-item-icon + span,
    .ant-menu-item .anticon + span,
    .ant-menu-submenu-title .anticon + span {
      margin-inline-start: 0;
    }

    .ant-menu-submenu.ant-menu-submenu-horizontal {
      display: flex;
      align-items: center;
      height: 100%;
      padding: 0;

      .ant-menu-submenu-title {
        display: flex;
        gap: ${theme.sizeUnit * 2}px;
        flex-direction: row-reverse;
        align-items: center;
        height: 100%;
        padding: 0 ${theme.sizeUnit * 4}px;
      }

      &:hover,
      &.ant-menu-submenu-active {
        .ant-menu-title-content {
          color: ${theme.colorPrimary};
        }
      }

      &::after {
        content: '';
        position: absolute;
        width: 98%;
        height: 2px;
        background-color: ${theme.colorPrimaryBorderHover};
        bottom: ${theme.sizeUnit / 8}px;
        left: 1%;
        right: auto;
        inset-inline-start: 1%;
        inset-inline-end: auto;
        transform: scale(0);
        transition: 0.2s all ease-out;
      }

      &:hover::after,
      &.ant-menu-submenu-open::after {
        transform: scale(1);
      }
    }

    .ant-menu-submenu-selected.ant-menu-submenu-horizontal::after {
      transform: scale(1);
    }
  `}
`;

const StyledBrandWrapper = styled.div<{ margin?: string }>`
  ${({ margin }) => css`
    height: ${margin ? 'auto' : '100%'};
    margin: ${margin ?? 0};
  `}
`;

const StyledBrandLink = styled(Typography.Link)`
  ${({ theme }) => css`
    align-items: center;
    display: flex;
    height: 100%;
    justify-content: center;

    &:focus {
      border-color: transparent;
    }

    &:focus-visible {
      border-color: ${theme.colorPrimaryText};
    }
  `}
`;

const StyledRow = styled(Row)`
  height: 100%;
`;

const StyledCol = styled(Col)`
  ${({ theme }) => css`
    display: flex;
    gap: ${theme.sizeUnit * 4}px;
  `}
`;

const StyledImage = styled(Image)`
  object-fit: contain;
`;

const { useBreakpoint } = Grid;

export function Menu({
  data: {
    menu,
    brand,
    navbar_right: navbarRight,
    settings,
    environment_tag: environmentTag,
  },
  isFrontendRoute = () => false,
}: MenuProps) {
  const screens = useBreakpoint();
  const uiConfig = useUiConfig();
  const theme = useTheme();

  enum Paths {
    Explore = '/explore',
    Dashboard = '/dashboard',
    Chart = '/chart',
    Datasets = '/tablemodelview',
    SqlLab = '/sqllab',
    SavedQueries = '/savedqueryview',
  }

  const defaultTabSelection: string[] = [];
  const [activeTabs, setActiveTabs] = useState(defaultTabSelection);
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    switch (true) {
      case path.startsWith(Paths.Dashboard):
        setActiveTabs(['Dashboards']);
        break;
      case path.startsWith(Paths.Chart) || path.startsWith(Paths.Explore):
        setActiveTabs(['Charts']);
        break;
      case path.startsWith(Paths.Datasets):
        setActiveTabs(['Datasets']);
        break;
      case path.startsWith(Paths.SqlLab) || path.startsWith(Paths.SavedQueries):
        setActiveTabs(['SQL']);
        break;
      default:
        setActiveTabs(defaultTabSelection);
    }
  }, [location.pathname]);

  const standalone = getUrlParam(URL_PARAMS.standalone);
  if (standalone || uiConfig.hideNav) return <></>;

  const buildMenuItem = ({
    label,
    childs,
    url,
    isFrontendRoute,
  }: MenuObjectProps): MenuItem => {
    if (url && isFrontendRoute) {
      return {
        key: label,
        label: (
          <NavLink role="button" to={url} activeClassName="is-active">
            {label}
          </NavLink>
        ),
      };
    }

    if (url) {
      return {
        key: label,
        label: <Typography.Link href={url}>{label}</Typography.Link>,
      };
    }

    const childItems: MenuItem[] = [];
    childs?.forEach((child: MenuObjectChildProps | string, index1: number) => {
      if (typeof child === 'string' && child === '-' && label !== 'Data') {
        childItems.push({ type: 'divider', key: `divider-${index1}` });
      } else if (typeof child !== 'string') {
        childItems.push({
          key: `${child.label}`,
          label: child.isFrontendRoute ? (
            <NavLink to={child.url || ''} exact activeClassName="is-active">
              {child.label}
            </NavLink>
          ) : (
            <Typography.Link href={child.url}>{child.label}</Typography.Link>
          ),
        });
      }
    });

    return {
      key: label,
      label,
      icon: <Icons.DownOutlined iconSize="xs" />,
      popupOffset: NAVBAR_MENU_POPUP_OFFSET,
      children: childItems,
    };
  };
  const renderBrand = () => {
    let link;
    if (theme.brandLogoUrl) {
      link = (
        <StyledBrandWrapper margin={theme.brandLogoMargin}>
          <StyledBrandLink href={theme.brandLogoHref}>
            <StyledImage
              preview={false}
              src={theme.brandLogoUrl}
              alt={theme.brandLogoAlt || 'Apache Superset'}
              height={theme.brandLogoHeight}
            />
          </StyledBrandLink>
        </StyledBrandWrapper>
      );
    } else if (isFrontendRoute(window.location.pathname)) {
      // ---------------------------------------------------------------------------------
      // TODO: deprecate this once Theme is fully rolled out
      // Kept as is for backwards compatibility with the old theme system / superset_config.py
      link = (
        <GenericLink className="navbar-brand" to={brand.path}>
          <StyledImage preview={false} src={brand.icon} alt={brand.alt} />
        </GenericLink>
      );
    } else {
      link = (
        <Typography.Link
          className="navbar-brand"
          href={brand.path}
          tabIndex={-1}
        >
          <StyledImage preview={false} src={brand.icon} alt={brand.alt} />
        </Typography.Link>
      );
    }
    // ---------------------------------------------------------------------------------
    return <>{link}</>;
  };
  return (
    <StyledHeader className="top" id="main-menu" role="navigation">
      <StyledRow>
        <StyledCol md={16} xs={24}>
          <Tooltip
            id="brand-tooltip"
            placement="bottomLeft"
            title={brand.tooltip}
            arrow={{ pointAtCenter: true }}
          >
            {renderBrand()}
          </Tooltip>
          {brand.text && (
            <StyledBrandText>
              <span>{brand.text}</span>
            </StyledBrandText>
          )}
          <StyledMainNav
            mode="horizontal"
            data-test="navbar-top"
            className="main-nav"
            selectedKeys={activeTabs}
            disabledOverflow
            items={menu.map(item => {
              const props = {
                ...item,
                isFrontendRoute: isFrontendRoute(item.url),
                childs: item.childs?.map(c => {
                  if (typeof c === 'string') {
                    return c;
                  }

                  return {
                    ...c,
                    isFrontendRoute: isFrontendRoute(c.url),
                  };
                }),
              };

              return buildMenuItem(props);
            })}
          />
        </StyledCol>
        <Col md={8} xs={24}>
          <RightMenu
            align={screens.md ? 'flex-end' : 'flex-start'}
            settings={settings}
            navbarRight={navbarRight}
            isFrontendRoute={isFrontendRoute}
            environmentTag={environmentTag}
          />
        </Col>
      </StyledRow>
    </StyledHeader>
  );
}

// transform the menu data to reorganize components
export default function MenuWrapper({ data, ...rest }: MenuProps) {
  const newMenuData = {
    ...data,
  };
  // Menu items that should go into settings dropdown
  const settingsMenus = {
    Data: true,
    Security: true,
    Manage: true,
  };

  // Cycle through menu.menu to build out cleanedMenu and settings
  const cleanedMenu: MenuObjectProps[] = [];
  const settings: MenuObjectProps[] = [];
  newMenuData.menu.forEach((item: any) => {
    if (!item) {
      return;
    }

    const children: (MenuObjectProps | string)[] = [];
    const newItem = {
      ...item,
    };

    // Filter childs
    if (item.childs) {
      item.childs.forEach((child: MenuObjectChildProps | string) => {
        if (typeof child === 'string') {
          children.push(child);
        } else if ((child as MenuObjectChildProps).label) {
          children.push(child);
        }
      });

      newItem.childs = children;
    }

    if (!settingsMenus.hasOwnProperty(item.name)) {
      cleanedMenu.push(newItem);
    } else {
      settings.push(newItem);
    }
  });

  newMenuData.menu = cleanedMenu;
  newMenuData.settings = settings;

  return <Menu data={newMenuData} {...rest} />;
}
