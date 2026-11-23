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
import { useState, useEffect, useMemo } from 'react';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { ensureStaticPrefix } from 'src/utils/assetUrl';
import { ensureAppRoot, stripAppRoot } from 'src/utils/navigationUtils';
import { getUrlParam, isUrlExternal } from 'src/utils/urlUtils';
import { MainNav, MenuItem } from '@superset-ui/core/components/Menu';
import { useSelector } from 'react-redux';
import {
  NAVBAR_LOCATION,
  SETTINGS_MENU_LOCATION,
  useMenu,
} from 'src/core/menus';
import { getViewOptions, PAGE_LOCATION, useViews } from 'src/core/views';
import { findPermission } from 'src/utils/findPermission';
import { Tooltip, Grid, Row, Col, Image } from '@superset-ui/core/components';
import { GenericLink } from 'src/components';
import { NavLink, useLocation } from 'react-router-dom';
import { Icons } from '@superset-ui/core/components/Icons';
import { Typography } from '@superset-ui/core/components/Typography';
import { useUiConfig } from 'src/components/UiConfigContext';
import { useIsMobile } from 'src/hooks/useIsMobile';
import { URL_PARAMS } from 'src/constants';
import {
  MenuObjectChildProps,
  MenuObjectProps,
  MenuData,
} from 'src/types/bootstrapTypes';
import { datasetsLabel } from 'src/features/semanticLayers/label';
import RightMenu from './RightMenu';
import { asIcon, NAVBAR_MENU_POPUP_OFFSET } from './commonMenuData';

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

      [data-icon='down'] {
        color: ${theme.colorIcon};
        /* sizeXS (an antd token, always computed) rather than fontSizeXS
           (a Superset custom token seeded only via THEME_DEFAULT in
           config.py) so this stays small in contexts that construct a
           theme without that seed, e.g. Storybook and Jest. Both resolve
           to the same 8px in the app's default theme. */
        font-size: ${theme.sizeXS}px;
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

/**
 * What the two helpers below need of a contributed page, and no more, so the
 * menu does not take a dependency on the pages registry. One shape shared by
 * both, so a field one of them reads cannot go missing from the other.
 *
 * Carries no ordering of its own: `getMenu` settles the sequence -- `order`,
 * then registration order -- and both helpers preserve what they are given.
 */
type ContributedPage = {
  /** The page's id. */
  id: string;
  name: string;
  section?: string;
  order?: number;
  /** Name of a host icon to render beside the label, if the item named one. */
  icon?: string;
};

/**
 * The contributed navigation entries this user may actually see.
 *
 * Two subscriptions, because a menu item and the page it points at are
 * separate registrations that arrive in either order: the item can land
 * first and the page second, or the reverse. Watching only one of them
 * leaves an entry that never appears.
 *
 * An item is kept only if its page is registered -- a target nothing
 * provides would render a dead link -- and only if the user holds whatever
 * permission that page named. A page that named none is kept: the option
 * cannot lock anyone out of a page that already worked. Those two tests are
 * deliberately not folded together; they reach the same outcome here and
 * opposite outcomes for a page with no permission.
 */
function useContributedPages(location: string): ContributedPage[] {
  const items = useMenu(location);
  const pages = useViews(PAGE_LOCATION);
  const roles = useSelector(
    (state: { user?: { roles?: Record<string, [string, string][]> } }) =>
      state.user?.roles,
  );

  // Memoised on the subscriptions, not rebuilt per render. The result
  // is a dependency of the active-tab effect, and a fresh array every render
  // makes that effect re-run every render -- which sets state, which renders
  // again. `useMenu` and `useViews` are `useSyncExternalStore` snapshots and
  // `roles` comes from the store, so all three are stable between changes.
  return useMemo(() => {
    const contributed: ContributedPage[] = [];
    for (const item of items?.pages ?? []) {
      const pageId = item.page;
      const page = pages?.find(view => view.id === pageId);
      if (!page) {
        continue;
      }
      const options = getViewOptions(pageId);
      if (options?.classPermissionName && options.methodPermissionName) {
        const held = findPermission(
          `can_${options.methodPermissionName}`,
          options.classPermissionName,
          roles,
        );
        if (!held) {
          continue;
        }
      }
      contributed.push({
        id: pageId,
        name: page.name,
        section: item.section,
        order: item.order,
        icon: item.icon,
      });
    }
    return contributed;
  }, [items, pages, roles]);
}

/**
 * The icon an item named, if the host has one by that name.
 *
 * An unknown name renders nothing rather than failing: the name crosses the
 * extension boundary as a string, so it is an extension's spelling against
 * the host's catalogue, and a typo should cost the icon and not the entry.
 */
const iconFor = (name?: string) => {
  if (!name) {
    return undefined;
  }
  // `Icons` is a plain object literal, so a bare index reaches
  // `Object.prototype`: `constructor` and `valueOf` are truthy and throw
  // during render, and this runs inside `Menu` with no boundary above it, so
  // an extension naming one would blank the whole shell. Own properties only.
  if (!Object.prototype.hasOwnProperty.call(Icons, name)) {
    return undefined;
  }
  // Truthiness is enough once the own-property check above has passed: the
  // host's icons are `forwardRef` objects, not functions, so a `typeof`
  // test would reject every real one.
  const Icon = (Icons as Record<string, unknown>)[name] as
    | ((props: { iconSize: 'm' }) => JSX.Element)
    | undefined;
  return Icon ? <Icon iconSize="m" /> : undefined;
};

/** The page's own address. The host forms it; an extension only names the page. */
const pageUrl = (id: string): string => `/extensions/pages/${id}`;

/**
 * How many navbar slots contributed pages may occupy, the dropdown included.
 *
 * The bar has no overflow menu -- `StyledMainNav` is rendered with antd's
 * `disabledOverflow` -- so entries that do not fit wrap onto a second row
 * under the logo, which the header paints over the page beneath it. Measured
 * against the real cascade, the first row holds roughly five contributed
 * entries at 1440px and three at 1280px, and the host's own four already
 * fill it at 820px with no extensions installed at all.
 *
 * No single number is right across that range, so this bounds the growth
 * rather than promising the bar never wraps: three installed extensions look
 * as they always did, and thirty cannot run off the edge of the screen.
 * Making the bar itself responsive is the complete answer, and it belongs
 * with the host's own chrome rather than here.
 */
const MAX_CONTRIBUTED_NAV_ENTRIES = 3;

/**
 * Folds pages contributed by extensions into the server-rendered menu.
 *
 * The navbar is built on the server from FAB's menu, which an extension
 * cannot write to: an entry there needs a `menu_access` permission created
 * at boot, and extensions register in the browser. An entry registered with
 * `menus.registerMenuItem` is therefore added here, client-side, so that a
 * contributed page has somewhere a user could find it at all.
 *
 * `section` is ignored here, which is what the published type promises --
 * "ignored where a location has no groups" -- and the navbar has none. It is
 * not a reason to drop the entry: this helper is fed the items registered at
 * `global.navbar`, and `withExtensionSettings` is fed the ones registered at
 * `global.settingsMenu`, so the two never see the same item and an item
 * skipped here does not reappear anywhere. It simply vanishes.
 */
export function withExtensionPages(
  menu: MenuObjectProps[],
  pages: readonly ContributedPage[],
): MenuObjectProps[] {
  // A page the user may not open is left out rather than shown and refused:
  // the gate is on reachability, so an entry here would only advertise a dead
  // end. The page stays registered, so a direct link still explains itself
  // rather than rendering nothing. That filtering happens in the hook; by
  // here every item is one this user may see.
  //
  // The sequence is the one `getMenu` settled -- `order` first, then
  // registration order -- so it is preserved here rather than re-sorted.
  const contributed = [...pages];
  if (!contributed.length) {
    return menu;
  }

  const entry = (page: ContributedPage) =>
    ({
      label: page.name,
      // `name` is the React key for the entry, and the label is the
      // extension author's to choose -- a page labelled "Charts" would
      // collide with the host's own entry. The prefix keeps the key in a
      // namespace of its own, and the page's own id is unique within it
      // because ids are the view registry's keys.
      name: `extension:${page.id}`,
      icon: iconFor(page.icon),
      // Rooted, because every other `url` in this menu is: the backend emits
      // host entries through `url_for`, and `buildMenuItem` strips the root
      // again before handing the path to `NavLink`. An unrooted path
      // survives that round trip only because `stripAppRoot` leaves one
      // alone -- until a page's first segment happens to equal the app root,
      // where the strip eats it, the registry lookup misses and the entry
      // degrades to a plain link to a URL that does not exist.
      url: ensureAppRoot(pageUrl(page.id)),
    }) as unknown as MenuObjectProps;

  if (contributed.length <= MAX_CONTRIBUTED_NAV_ENTRIES) {
    return [...menu, ...contributed.map(entry)];
  }

  // One slot is spent on the dropdown itself, so the bar never holds more
  // than the cap however many extensions are installed.
  const inline = contributed.slice(0, MAX_CONTRIBUTED_NAV_ENTRIES - 1);
  const folded = contributed.slice(MAX_CONTRIBUTED_NAV_ENTRIES - 1);

  return [
    ...menu,
    ...inline.map(entry),
    {
      label: t('More'),
      // No `url`, which is what makes `buildMenuItem` render it as a
      // dropdown rather than a link.
      name: 'extension:more',
      childs: folded.map(entry),
    } as unknown as MenuObjectProps,
  ];
}

/**
 * Places a contributed page inside a group of the Settings menu.
 *
 * `MenuWrapper` splits the FAB menu into the top navbar and `settings` by
 * group name -- Data, Security and Manage -- so a page that belongs under
 * Settings cannot be appended to the navbar list and reach it. It has to
 * join the group's own children, which is what this does.
 *
 * A *named* group the host did not render is not invented: FAB builds Manage
 * only when the user may see something in it, and a group conjured here
 * would be one the rest of Superset does not agree exists. The page keeps
 * its URL either way; it is the entry that is missing.
 *
 * An item naming no section is appended after the built-ins instead of being
 * dropped, in a trailing group of its own. It needs a group because
 * `RightMenu` renders every element of `settings` as one, from its `childs`
 * -- a bare entry at this level would render as a heading with nothing under
 * it. The group carries no label, so what the user sees is the items after
 * the last built-in section.
 */
export function withExtensionSettings(
  settings: MenuObjectProps[],
  pages: readonly ContributedPage[],
): MenuObjectProps[] {
  // The filter keeps the order it is given, so one pass settles every group.
  // That order is the one `getMenu` settled -- `order` first, then
  // registration order -- which is what an author chose, so it is preserved
  // rather than re-sorted here.
  const contributed = pages.filter(page => page.section);
  const ungrouped = pages.filter(page => !page.section);
  if (!contributed.length && !ungrouped.length) {
    return settings;
  }

  const child = (page: ContributedPage) => ({
    label: page.name,
    // The React key `RightMenu` uses for a settings child, as for the
    // navbar entries: the label is the author's to choose and could
    // collide with a host item.
    name: `extension:${page.id}`,
    icon: iconFor(page.icon),
    url: ensureAppRoot(pageUrl(page.id)),
  });

  const withTrailing = (groups: MenuObjectProps[]) =>
    ungrouped.length
      ? [
          ...groups,
          {
            label: '',
            name: 'extension:settings',
            childs: ungrouped.map(child),
          } as unknown as MenuObjectProps,
        ]
      : groups;

  return withTrailing(
    settings.map(group => {
      const mine = contributed.filter(page => page.section === group.name);
      if (!mine.length) {
        return group;
      }
      return {
        ...group,
        childs: [...(group.childs ?? []), ...mine.map(child)],
      };
    }),
  );
}

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
  const isMobile = useIsMobile();
  // Subscribed, not read once: extensions register after the menu first
  // renders, so a contributed entry would otherwise never appear.
  const navbarPages = useContributedPages(NAVBAR_LOCATION);
  const settingsPages = useContributedPages(SETTINGS_MENU_LOCATION);
  const uiConfig = useUiConfig();
  const theme = useTheme();
  // screens.md is undefined on the first render before breakpoints are measured;
  // fall back to the actual viewport width (using the same threshold as antd's
  // md media query) so the first paint matches the device layout instead of
  // flashing to the wrong mode on either desktop or mobile
  const isMd = screens.md ?? window.innerWidth >= theme.screenMDMin;

  enum Paths {
    Explore = '/explore',
    Dashboard = '/dashboard',
    Chart = '/chart',
    Datasets = '/tablemodelview',
    // The legacy FAB dataset list still lives at ``/tablemodelview/list/``,
    // but the modern React-managed dataset add + detail routes are under
    // ``/dataset/*`` (``/dataset/add/``, ``/dataset/:datasetId``). Both
    // prefixes must map to the Datasets tab so the top-nav highlight
    // survives navigation into the create/edit flow. See #42467.
    Dataset = '/dataset',
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
    // A contributed page is answered first, and from the address alone.
    //
    // Its key is none of `MenuKeys`, so the `default` branch cleared the
    // selection and left the entry unhighlighted while its own page was open.
    // One prefix the host owns, so the page's id is simply the next segment
    // -- a whole segment, which is why `acme.tools.reports-archive` cannot be
    // mistaken for `acme.tools.reports`. Read here rather than from the
    // registry, so a page whose bundle has not arrived yet still highlights
    // its entry, and `isFrontendRoute` and `derivePage` read the same prefix.
    //
    // Before the host cases rather than after, because those match by
    // unbounded prefix: `/extensions/pages/...` is not a host screen, but
    // nothing below checks a segment boundary before claiming it.
    const prefix = '/extensions/pages/';
    if (path.startsWith(prefix)) {
      const [contributedId] = path.slice(prefix.length).split('/');
      if (contributedId) {
        setActiveTabs([`extension:${contributedId}`]);
        return;
      }
    }
    switch (true) {
      case path.startsWith(Paths.Dashboard):
        setActiveTabs([MenuKeys.Dashboards]);
        break;
      case path.startsWith(Paths.Chart) || path.startsWith(Paths.Explore):
        setActiveTabs([MenuKeys.Charts]);
        break;
      case path.startsWith(Paths.Datasets) ||
        path === Paths.Dataset ||
        path.startsWith(`${Paths.Dataset}/`):
        setActiveTabs([MenuKeys.Datasets]);
        break;
      case path.startsWith(Paths.SqlLab) || path.startsWith(Paths.SavedQueries):
        setActiveTabs([MenuKeys.SqlLab]);
        break;
      default:
        setActiveTabs(defaultTabSelection);
    }
    // The contributed pages are a dependency because a bundle registers long
    // after the first render: without it a cold load onto a contributed page
    // would never highlight its entry, there being no navigation to re-run
    // this.
  }, [location.pathname, navbarPages, settingsPages]);

  const standalone = getUrlParam(URL_PARAMS.standalone);
  if (standalone || uiConfig.hideNav) return <></>;

  const buildMenuItem = ({
    label,
    childs,
    url,
    isFrontendRoute,
    name,
    icon,
    onClick,
  }: MenuObjectProps): MenuItem => {
    // Key items by the stable FAB `name` so active-tab matching is independent
    // of the localized label. Fall back to the label when no name is provided.
    const key = name ?? label;
    // An item that runs something instead of going somewhere. Checked before
    // the `url` branches, and before the `childs` fall-through below, which
    // would otherwise render it as a dropdown with nothing in it.
    if (onClick && !url) {
      return { key, icon: asIcon(icon), label, onClick };
    }
    if (url && isFrontendRoute) {
      // `<Router basename={applicationRoot()}>` re-prepends the app root to
      // `to`, so handing it the already-rooted `url` from bootstrap_data
      // would render a doubled `/superset/superset/...` anchor. Strip the
      // root first; mirrors the brand-link treatment below.
      return {
        key,
        icon: asIcon(icon),
        label: (
          <NavLink to={stripAppRoot(url)} activeClassName="is-active">
            {label}
          </NavLink>
        ),
      };
    }

    if (url) {
      return {
        key,
        icon: asIcon(icon),
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
          icon: asIcon(child.icon),
          // A folded command item has a handler and no address. Without this
          // branch it would render as a link to `undefined` -- the overflow
          // dropdown is where contributed entries past the cap end up, so a
          // command item reaches here as soon as a few are installed.
          ...(child.onClick && !child.url
            ? { label: child.label, onClick: child.onClick }
            : {
                label: child.isFrontendRoute ? (
                  <NavLink
                    to={stripAppRoot(child.url || '')}
                    exact
                    activeClassName="is-active"
                  >
                    {child.label}
                  </NavLink>
                ) : (
                  <Typography.Link href={child.url}>
                    {child.label}
                  </Typography.Link>
                ),
              }),
        });
      }
    });

    return {
      key,
      label,
      ...(isMd && {
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
      as="nav"
      className="top"
      id="main-menu"
      aria-label={t('Main navigation')}
    >
      <StyledRow>
        {/* Mobile: left placeholder for future icon */}
        {isMobile && <Col xs={4} />}
        <StyledCol
          md={16}
          xs={isMobile ? 16 : 24}
          css={
            isMobile &&
            css`
              justify-content: center;
            `
          }
        >
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
          {/* Consumption mode: hide nav items on mobile (drawer holds them) */}
          {!isMobile && (
            <StyledMainNav
              mode={isMd ? 'horizontal' : 'inline'}
              data-test="navbar-top"
              className="main-nav"
              selectedKeys={activeTabs}
              disabledOverflow
              items={withExtensionPages(menu, navbarPages).map(item => {
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
          )}
        </StyledCol>
        <Col md={8} xs={isMobile ? 4 : 24}>
          <RightMenu
            align={isMd || isMobile ? 'flex-end' : 'flex-start'}
            settings={withExtensionSettings(settings, settingsPages)}
            navbarRight={navbarRight}
            isFrontendRoute={isFrontendRoute}
            environmentTag={environmentTag}
            menu={menu}
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
