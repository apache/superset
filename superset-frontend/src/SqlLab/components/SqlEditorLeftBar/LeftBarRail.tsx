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
import { useMemo } from "react";
import { t } from "@apache-superset/core/translation";
import { css, styled } from "@apache-superset/core/theme";
import { AntdThemeProvider, Icons } from "@superset-ui/core/components";
import { Menu, type ItemType } from "@superset-ui/core/components/Menu";
import { LeftBarViewTriggerHost } from "src/core";
import { SQL_EDITOR_LEFTBAR_COLLAPSED_WIDTH } from "src/SqlLab/constants";
import {
  TAB_EXPLORER_ID,
  TAB_SETTINGS_ID,
  type LeftBarTab,
} from "src/SqlLab/hooks/useLeftBarTabs";

export interface LeftBarRailProps {
  tabs: LeftBarTab[];
  activeViewId: string;
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

const builtinIcon = (id: string) => {
  if (id === TAB_EXPLORER_ID) return <Icons.TableOutlined />;
  if (id === TAB_SETTINGS_ID) return <Icons.SettingOutlined />;
  return undefined;
};

const toMenuItems = (tabs: LeftBarTab[]): ItemType[] =>
  tabs.map(({ id, name, description }) => ({
    key: id,
    // Kept in the DOM by antd (visually hidden while collapsed) so the item
    // has an accessible name; also the tooltip fallback.
    label: name,
    title: description ?? name,
    // Wrapped in a span so antd's injected `ant-menu-item-icon` class lands
    // on a real DOM node — an extension trigger is under no obligation to
    // forward className.
    icon: (
      <span>{builtinIcon(id) ?? <LeftBarViewTriggerHost viewId={id} />}</span>
    ),
  }));

const LeftBarRail = ({ tabs, activeViewId, onSelect }: LeftBarRailProps) => {
  // Settings is pinned to the bottom, visually separated from the
  // Explorer/extension icons above it — a second, independent Menu rather
  // than a trailing item in the same one.
  const mainTabs = useMemo(
    () => tabs.filter((tab) => tab.id !== TAB_SETTINGS_ID),
    [tabs],
  );
  const settingsTab = useMemo(
    () => tabs.find((tab) => tab.id === TAB_SETTINGS_ID),
    [tabs],
  );
  const mainItems = useMemo(() => toMenuItems(mainTabs), [mainTabs]);
  const settingsItems = useMemo(
    () => (settingsTab ? toMenuItems([settingsTab]) : []),
    [settingsTab],
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
          selectedKeys={[activeViewId]}
          onClick={handleClick}
          aria-label={t("Sidebar panels")}
        />
        {settingsItems.length > 0 && (
          <Menu
            mode="inline"
            inlineCollapsed
            selectable
            items={settingsItems}
            selectedKeys={[activeViewId]}
            onClick={handleClick}
            aria-label={t("Sidebar settings")}
          />
        )}
      </RailContainer>
    </AntdThemeProvider>
  );
};

export default LeftBarRail;
