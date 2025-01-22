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
import { styled } from '@superset-ui/core';
import { debounce } from 'lodash';
import { getUrlParam } from 'src/utils/urlUtils';
import { Row, Col, Grid } from 'src/components';
import { MainNav, MenuMode } from 'src/components/Menu';
import { Tooltip } from 'src/components/Tooltip';
import { NavLink, useLocation } from 'react-router-dom';
import { GenericLink } from 'src/components/GenericLink/GenericLink';
import Icons from 'src/components/Icons';
import { useUiConfig } from 'src/components/UiConfigContext';
import { URL_PARAMS } from 'src/constants';
import {
  MenuObjectChildProps,
  MenuObjectProps,
  MenuData,
} from 'src/types/bootstrapTypes';
import RightMenu from './RightMenu';

interface MenuProps {
  data: MenuData;
  isFrontendRoute?: (path?: string) => boolean;
}

const StyledHeader = styled.header`
  ${({ theme }) => `
      background-color: ${theme.colors.grayscale.light5};
      margin-bottom: 2px;
      z-index: 10;

      &:nth-last-of-type(2) nav {
        margin-bottom: 2px;
      }
      .caret {
        display: none;
      }
      .navbar-brand {
        display: flex;
        flex-direction: column;
        justify-content: center;
        /* must be exactly the height of the Antd navbar */
        min-height: 50px;
        padding: ${theme.gridUnit}px
          ${theme.gridUnit * 2}px
          ${theme.gridUnit}px
          ${theme.gridUnit * 4}px;
        max-width: ${theme.gridUnit * theme.brandIconMaxWidth}px;
        img {
          height: 100%;
          object-fit: contain;
        }
        &:focus {
          border-color: transparent;
        }
        &:focus-visible {
          border-color: ${theme.colors.primary.dark1};
        }
      }
      .navbar-brand-text {
        border-left: 1px solid ${theme.colors.grayscale.light2};
        border-right: 1px solid ${theme.colors.grayscale.light2};
        height: 100%;
        color: ${theme.colors.grayscale.dark1};
        padding-left: ${theme.gridUnit * 4}px;
        padding-right: ${theme.gridUnit * 4}px;
        margin-right: ${theme.gridUnit * 6}px;
        font-size: ${theme.gridUnit * 4}px;
        float: left;
        display: flex;
        flex-direction: column;
        justify-content: center;

        span {
          max-width: ${theme.gridUnit * 58}px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 1127px) {
          display: none;
        }
      }
      @media (max-width: 767px) {
        .navbar-brand {
          float: none;
        }
      }
      @media (max-width: 767px) {
        .antd5-menu-item {
          padding: 0 ${theme.gridUnit * 6}px 0
            ${theme.gridUnit * 3}px !important;
        }
        .antd5-menu > .antd5-menu-item > span > a {
          padding: 0px;
        }
        .main-nav .antd5-menu-submenu-title > svg:nth-of-type(1) {
          display: none;
        }
      }
  `}
`;
const { SubMenu } = MainNav;

const StyledSubMenu = styled(SubMenu)`
  &.antd5-menu-submenu-active {
    .antd5-menu-title-content {
      color: ${({ theme }) => theme.colors.primary.base};
    }
  }
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
  const [showMenu, setMenu] = useState<MenuMode>('horizontal');
  const screens = useBreakpoint();
  const uiConfig = useUiConfig();

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth <= 767) {
        setMenu('inline');
      } else setMenu('horizontal');
    }
    handleResize();
    const windowResize = debounce(() => handleResize(), 10);
    window.addEventListener('resize', windowResize);
    return () => window.removeEventListener('resize', windowResize);
  }, []);

  enum Paths {
    Explore = '/explore',
    Dashboard = '/dashboard',
    Chart = '/chart',
    Datasets = '/tablemodelview',
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
      default:
        setActiveTabs(defaultTabSelection);
    }
  }, [location.pathname]);

  const standalone = getUrlParam(URL_PARAMS.standalone);
  if (standalone || uiConfig.hideNav) return <></>;

  const renderSubMenu = ({
    label,
    childs,
    url,
    index,
    isFrontendRoute,
  }: MenuObjectProps) => {
    if (url && isFrontendRoute) {
      return (
        <MainNav.Item key={label} role="presentation">
          <NavLink role="button" to={url} activeClassName="is-active">
            {label}
          </NavLink>
        </MainNav.Item>
      );
    }
    if (url) {
      return (
        <MainNav.Item key={label}>
          <a href={url}>{label}</a>
        </MainNav.Item>
      );
    }
    return (
      <StyledSubMenu
        key={index}
        title={label}
        icon={showMenu === 'inline' ? <></> : <Icons.TriangleDown />}
      >
        {childs?.map((child: MenuObjectChildProps | string, index1: number) => {
          if (typeof child === 'string' && child === '-' && label !== 'Data') {
            return <MainNav.Divider key={`$${index1}`} />;
          }
          if (typeof child !== 'string') {
            return (
              <MainNav.Item key={`${child.label}`}>
                {child.isFrontendRoute ? (
                  <NavLink
                    to={child.url || ''}
                    exact
                    activeClassName="is-active"
                  >
                    {child.label}
                  </NavLink>
                ) : (
                  <a href={child.url}>{child.label}</a>
                )}
              </MainNav.Item>
            );
          }
          return null;
        })}
      </StyledSubMenu>
    );
  };
  return (
    <StyledHeader className="top" id="main-menu" role="navigation">
      <Row>
        <Col md={16} xs={24}>
          <Tooltip
            id="brand-tooltip"
            placement="bottomLeft"
            title={brand.tooltip}
            arrow={{ pointAtCenter: true }}
          >
            {isFrontendRoute(window.location.pathname) ? (
              <GenericLink className="navbar-brand" to={brand.path}>
                <img src={brand.icon} alt={brand.alt} />
              </GenericLink>
            ) : (
              <a className="navbar-brand" href={brand.path} tabIndex={-1}>
                <img src={brand.icon} alt={brand.alt} />
              </a>
            )}
          </Tooltip>
          {brand.text && (
            <div className="navbar-brand-text">
              <span>{brand.text}</span>
            </div>
          )}
          <MainNav
            mode={showMenu}
            data-test="navbar-top"
            className="main-nav"
            selectedKeys={activeTabs}
            disabledOverflow
          >
            {menu.map((item, index) => {
              const props = {
                index,
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

              return renderSubMenu(props);
            })}
          </MainNav>
        </Col>
        <Col md={8} xs={24}>
          <RightMenu
            align={screens.md ? 'flex-end' : 'flex-start'}
            settings={settings}
            navbarRight={navbarRight}
            isFrontendRoute={isFrontendRoute}
            environmentTag={environmentTag}
          />
        </Col>
      </Row>
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
