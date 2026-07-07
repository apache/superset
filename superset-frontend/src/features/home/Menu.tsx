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
import { styled, css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { ensureStaticPrefix } from 'src/utils/assetUrl';
import { ensureAppRoot, stripAppRoot } from 'src/utils/navigationUtils';
import { getUrlParam, isUrlExternal } from 'src/utils/urlUtils';
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
import { datasetsLabel } from 'src/features/semanticLayers/label';
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

const StyledBrandLink = styled(GenericLink)`
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
    flex-wrap: wrap;
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

  // Stable Flask-AppBuilder menu identifiers (`name`), used as menu item keys.
  // These are locale-independent, unlike the displayed labels, so matching the
  // active tab against them keeps highlighting working in every language.
  enum MenuKeys {
    Dashboards = 'Dashboards',
    Charts = 'Charts',
    Datasets = 'Datasets',
    SqlLab = 'SQL Lab',
  }

  const defaultTabSelection: string[] = [];
  const [activeTabs, setActiveTabs] = useState(defaultTabSelection);
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    switch (true) {
      case path.startsWith(Paths.Dashboard):
        setActiveTabs([MenuKeys.Dashboards]);
        break;
      case path.startsWith(Paths.Chart) || path.startsWith(Paths.Explore):
        setActiveTabs([MenuKeys.Charts]);
        break;
      case path.startsWith(Paths.Datasets):
        setActiveTabs([MenuKeys.Datasets]);
        break;
      case path.startsWith(Paths.SqlLab) || path.startsWith(Paths.SavedQueries):
        setActiveTabs([MenuKeys.SqlLab]);
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
    name,
  }: MenuObjectProps): MenuItem => {
    // Key items by the stable FAB `name` so active-tab matching is independent
    // of the localized label. Fall back to the label when no name is provided.
    const key = name ?? label;
    if (url && isFrontendRoute) {
      // `<Router basename={applicationRoot()}>` re-prepends the app root to
      // `to`, so handing it the already-rooted `url` from bootstrap_data
      // would render a doubled `/superset/superset/...` anchor. Strip the
      // root first; mirrors the brand-link treatment below.
      return {
        key,
        label: (
          <NavLink
            role="button"
            to={stripAppRoot(url)}
            activeClassName="is-active"
          >
            {label}
          </NavLink>
        ),
      };
    }

    if (url) {
      return {
        key,
        label: <Typography.Link href={url}>{label}</Typography.Link>,
      };
    }

    const childItems: MenuItem[] = [];
    childs?.forEach((child: MenuObjectChildProps | string, index1: number) => {
      if (typeof child === 'string' && child === '-' && label !== t('Data')) {
        childItems.push({ type: 'divider', key: `divider-${index1}` });
      } else if (typeof child !== 'string') {
        Object.assign(child, { label: t(child.label) });
        childItems.push({
          // Key children by the stable FAB `name` as well, so a child whose
          // localized label coincides with a parent key (e.g. the "SQL Editor"
          // child labeled "SQL Lab" under the "SQL Lab" category) doesn't
          // collide with that parent. Fall back to the label when no name.
          key: child.name ?? `${child.label}`,
          label: child.isFrontendRoute ? (
            <NavLink
              to={stripAppRoot(child.url || '')}
              exact
              activeClassName="is-active"
            >
              {child.label}
            </NavLink>
          ) : (
            <Typography.Link href={child.url}>{child.label}</Typography.Link>
          ),
        });
      }
    });

    return {
      key,
      label,
      ...(screens.md && {
        icon: <Icons.DownOutlined iconSize="xs" />,
        popupOffset: NAVBAR_MENU_POPUP_OFFSET,
      }),
      children: childItems,
    };
  };
  const renderBrand = () => {
    if (brand.hide_logo) {
      return null;
    }
    let link;
    if (theme.brandLogoUrl) {
      const brandHref = ensureAppRoot(theme.brandLogoHref);
      const brandImage = (
        <StyledImage
          preview={false}
          src={ensureStaticPrefix(theme.brandLogoUrl)}
          alt={theme.brandLogoAlt || 'Apache Superset'}
          height={theme.brandLogoHeight}
        />
      );
      link = (
        <StyledBrandWrapper margin={theme.brandLogoMargin}>
          {isUrlExternal(brandHref) ? (
            <Typography.Link className="navbar-brand" href={brandHref}>
              {brandImage}
            </Typography.Link>
          ) : (
            // StyledBrandLink wraps GenericLink -> react-router <Link>, and
            // `<Router basename={applicationRoot()}>` re-prepends the app root
            // to `to`. Strip the root so the rendered anchor is single-prefixed
            // rather than a doubled `/superset/superset/...`. Strip `brandHref`
            // (the ensureAppRoot'd value) rather than the raw
            // `theme.brandLogoHref` so an unset href (partial theme override)
            // stays null-safe — `ensureAppRoot(undefined)` yields the app root,
            // which `stripAppRoot` then reduces to `/`. Mirrors the brand.path
            // branch's single-prefix treatment.
            <StyledBrandLink to={stripAppRoot(brandHref)}>
              {brandImage}
            </StyledBrandLink>
          )}
        </StyledBrandWrapper>
      );
    } else if (isFrontendRoute(window.location.pathname)) {
      // ---------------------------------------------------------------------------------
      // TODO: deprecate this once Theme is fully rolled out
      // Kept as is for backwards compatibility with the old theme system / superset_config.py
      //
      // `<Router basename={applicationRoot()}>` re-prepends the app root to the
      // `to` prop, so handing it an already-rooted `brand.path` would render a
      // doubled `/superset/superset/...` href. Strip the root first.
      link = (
        <GenericLink className="navbar-brand" to={stripAppRoot(brand.path)}>
          <StyledImage
            preview={false}
            src={ensureStaticPrefix(brand.icon)}
            alt={brand.alt}
          />
        </GenericLink>
      );
    } else {
      link = (
        <Typography.Link
          className="navbar-brand"
          href={ensureAppRoot(brand.path)}
          tabIndex={-1}
        >
          <StyledImage
            preview={false}
            src={ensureStaticPrefix(brand.icon)}
            alt={brand.alt}
          />
        </Typography.Link>
      );
    }
    // ---------------------------------------------------------------------------------
    return <>{link}</>;
  };
  return (
    <StyledHeader
      className="top"
      id="main-menu"
      role="navigation"
      aria-label={t('Main navigation')}
    >
      <StyledRow>
        <StyledCol md={16} xs={24}>
          {!brand.hide_logo && (
            <Tooltip
              id="brand-tooltip"
              placement="bottomLeft"
              title={brand.tooltip}
              arrow={{ pointAtCenter: true }}
            >
              {renderBrand()}
            </Tooltip>
          )}
          {!brand.hide_logo && brand.text && (
            <StyledBrandText>
              <span>{brand.text}</span>
            </StyledBrandText>
          )}
          <StyledMainNav
            mode={screens.md ? 'horizontal' : 'inline'}
            data-test="navbar-top"
            className="main-nav"
            selectedKeys={activeTabs}
            disabledOverflow
            items={menu.map(item => {
              const props = {
                ...item,
                label: t(item.label),
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

  // Remap labels that depend on feature flags so they stay in sync with
  // the active-tab key used in the Menu component above.
  const labelOverrides: Record<string, () => string> = {
    Datasets: datasetsLabel,
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
      // Apply any label override for this item (keyed by FAB internal name).
      ...(item.name && labelOverrides[item.name]
        ? { label: labelOverrides[item.name]() }
        : { label: t(item.label) }),
    };

    // Filter childs
    if (item.childs) {
      item.childs.forEach((child: MenuObjectChildProps | string) => {
        if (typeof child === 'string') {
          children.push(t(child));
        } else if ((child as MenuObjectChildProps).label) {
          Object.assign(child, { label: t(child.label) });
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
