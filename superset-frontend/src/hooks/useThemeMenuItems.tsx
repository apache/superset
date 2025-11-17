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
import { Icons, Tooltip } from '@superset-ui/core/components';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import { t, ThemeMode, ThemeAlgorithm } from '@superset-ui/core';
import { NAVBAR_MENU_POPUP_OFFSET } from 'src/features/home/commonMenuData';

export interface ThemeSubMenuOption {
  key: ThemeMode;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export interface ThemeSubMenuProps {
  setThemeMode: (newMode: ThemeMode) => void;
  themeMode: ThemeMode;
  hasLocalOverride?: boolean;
  onClearLocalSettings?: () => void;
  allowOSPreference?: boolean;
}

export const useThemeMenuItems = ({
  setThemeMode,
  themeMode,
  hasLocalOverride = false,
  onClearLocalSettings,
  allowOSPreference = true,
}: ThemeSubMenuProps): MenuItem => {
  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const themeIconMap: Record<ThemeAlgorithm | ThemeMode, React.ReactNode> =
    useMemo(
      () => ({
        [ThemeAlgorithm.DEFAULT]: <Icons.SunOutlined />,
        [ThemeAlgorithm.DARK]: <Icons.MoonOutlined />,
        [ThemeMode.SYSTEM]: <Icons.FormatPainterOutlined />,
        [ThemeAlgorithm.COMPACT]: <Icons.CompressOutlined />,
      }),
      [],
    );

  const selectedThemeModeIcon = useMemo(
    () =>
      hasLocalOverride ? (
        <Tooltip title={t('This theme is set locally')} placement="bottom">
          <Icons.ThunderboltOutlined />
        </Tooltip>
      ) : (
        themeIconMap[themeMode]
      ),
    [hasLocalOverride, themeIconMap, themeMode],
  );

  const themeOptions: MenuItem[] = [
    {
      key: ThemeMode.DEFAULT,
      label: (
        <>
          <Icons.SunOutlined /> {t('Light')}
        </>
      ),
      onClick: () => handleSelect(ThemeMode.DEFAULT),
    },
    {
      key: ThemeMode.DARK,
      label: (
        <>
          <Icons.MoonOutlined /> {t('Dark')}
        </>
      ),
      onClick: () => handleSelect(ThemeMode.DARK),
    },
    ...(allowOSPreference
      ? [
          {
            key: ThemeMode.SYSTEM,
            label: (
              <>
                <Icons.FormatPainterOutlined /> {t('Match system')}
              </>
            ),
            onClick: () => handleSelect(ThemeMode.SYSTEM),
          },
        ]
      : []),
  ];

  // Add clear settings option to theme options if there's a local theme active
  const themeGroupOptions = [...themeOptions];
  if (onClearLocalSettings && hasLocalOverride) {
    themeGroupOptions.push({
      type: 'divider' as const,
      key: 'theme-divider',
    });
    themeGroupOptions.push({
      key: 'clear-local',
      label: (
        <>
          <Icons.ClearOutlined /> {t('Clear local theme')}
        </>
      ),
      onClick: onClearLocalSettings,
    });
  }

  const children: MenuItem[] = [
    {
      type: 'group' as const,
      label: t('Theme'),
      key: 'theme-group',
      children: themeGroupOptions,
    },
  ];

  return {
    key: 'theme-sub-menu',
    label: selectedThemeModeIcon,
    icon: <Icons.DownOutlined iconSize="xs" />,
    className: 'submenu-with-caret',
    children,
    popupOffset: NAVBAR_MENU_POPUP_OFFSET,
  };
};
