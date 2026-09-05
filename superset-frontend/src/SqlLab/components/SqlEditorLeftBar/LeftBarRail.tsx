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
import { useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { AntdThemeProvider } from '@superset-ui/core/components';
import { Menu, type ItemType } from '@superset-ui/core/components/Menu';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import type { ViewContainer } from 'src/core';
import { SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH } from 'src/SqlLab/constants';

/**
 * A generic rail host: renders a vertical icon strip from `items`, plus an
 * optional second group (`pinnedItems`) pinned to the bottom in its own
 * menu, visually separated from the first. It has no notion of SQL Lab, or
 * of any particular container being "built in" — that grouping and
 * ordering is decided by the caller (see useLeftBarLayout), so this
 * component is reusable for any future rail-style location.
 */
export interface LeftBarRailProps {
  items: ViewContainer[];
  pinnedItems?: ViewContainer[];
  activeId: string;
  onSelect: (id: string) => void;
}

const railTheme = {
  // Each Menu still renders its own border-inline-end, colored from the
  // global `colorSplit` token (antd's Menu component token has no border
  // color of its own to override) — scoped to `token` rather than
  // `components.Menu` for that reason, and made transparent so only
  // RailContainer's single continuous divider (below) shows, rather than
  // each Menu's own border breaking across the gap between them.
  token: { colorSplit: 'transparent' },
  components: {
    Menu: { collapsedWidth: SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH },
  },
};

const RailContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    flex: 0 0 auto;
    /* The gap opened by justify-content: space-between, between the main
       and settings menus, would otherwise show the page background through it. */
    background-color: ${theme.colorBgBase};
    /* One continuous divider for the whole rail, rather than each Menu's
       own border-inline-end (removed below), which would only span its own
       height and break across the gap between the two menus. */
    border-inline-end: 1px solid ${theme.colorSplit};
  `}
`;

/**
 * Renders a container's icon, isolated in its own ErrorBoundary so a
 * crashing trigger cannot take down the rest of the strip. Renders nothing
 * on crash — an icon slot is too small for an error message, and a missing
 * icon degrades more gracefully than a broken strip.
 */
const RailIcon = ({ icon: Icon }: { icon: ViewContainer['icon'] }) => (
  <ErrorBoundary showMessage={false}>
    <Icon />
  </ErrorBoundary>
);

const toMenuItems = (items: ViewContainer[]): ItemType[] =>
  items.map(({ id, name, description, icon }) => ({
    key: id,
    // Kept in the DOM by antd (visually hidden while collapsed) so the item
    // has an accessible name; also the tooltip fallback.
    label: name,
    title: description ?? name,
    // Wrapped in a span so antd's injected `ant-menu-item-icon` class lands
    // on a real DOM node — a container's icon is under no obligation to
    // forward className.
    icon: (
      <span>
        <RailIcon icon={icon} />
      </span>
    ),
  }));

const LeftBarRail = ({
  items,
  pinnedItems = [],
  activeId,
  onSelect,
}: LeftBarRailProps) => {
  const mainItems = useMemo(() => toMenuItems(items), [items]);
  const pinnedMenuItems = useMemo(
    () => toMenuItems(pinnedItems),
    [pinnedItems],
  );

  const handleClick = ({ key }: { key: string }) => onSelect(key);

  return (
    <AntdThemeProvider theme={railTheme}>
      <RailContainer data-test="left-bar-rail">
        <Menu
          mode="inline"
          inlineCollapsed
          selectable
          items={mainItems}
          selectedKeys={[activeId]}
          onClick={handleClick}
          aria-label={t('Sidebar panels')}
        />
        {pinnedMenuItems.length > 0 && (
          <Menu
            mode="inline"
            inlineCollapsed
            selectable
            items={pinnedMenuItems}
            selectedKeys={[activeId]}
            onClick={handleClick}
            aria-label={t('Sidebar settings')}
          />
        )}
      </RailContainer>
    </AntdThemeProvider>
  );
};

export default LeftBarRail;
