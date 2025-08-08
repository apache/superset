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
import { Icons, Menu } from '@superset-ui/core/components';
import {
  css,
  styled,
  t,
  ThemeMode,
  useTheme,
  ThemeAlgorithm,
} from '@superset-ui/core';

const StyledThemeSubMenu = styled(Menu.SubMenu)`
  ${({ theme }) => css`
    [data-icon='caret-down'] {
      color: ${theme.colorIcon};
      font-size: ${theme.fontSizeXS}px;
      margin-left: ${theme.sizeUnit}px;
    }
    &.ant-menu-submenu-active {
      .ant-menu-title-content {
        color: ${theme.colorPrimary};
      }
    }
  `}
`;

const StyledThemeSubMenuItem = styled(Menu.Item)<{ selected: boolean }>`
  ${({ theme, selected }) => css`
    &:hover {
      color: ${theme.colorPrimary} !important;
      cursor: pointer !important;
    }
    ${selected &&
    css`
      background-color: ${theme.colors.primary.light4} !important;
      color: ${theme.colors.primary.dark1} !important;
    `}
  `}
`;

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

export const ThemeSubMenu: React.FC<ThemeSubMenuProps> = ({
  setThemeMode,
  themeMode,
  hasLocalOverride = false,
  onClearLocalSettings,
  allowOSPreference = true,
}: ThemeSubMenuProps) => {
  const theme = useTheme();

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
        <Icons.FormatPainterOutlined
          style={{ color: theme.colors.error.base }}
        />
      ) : (
        themeIconMap[themeMode]
      ),
    [hasLocalOverride, theme.colors.error.base, themeIconMap, themeMode],
  );

  const themeOptions: ThemeSubMenuOption[] = [
    {
      key: ThemeMode.DEFAULT,
      label: t('Light'),
      icon: <Icons.SunOutlined />,
      onClick: () => handleSelect(ThemeMode.DEFAULT),
    },
    {
      key: ThemeMode.DARK,
      label: t('Dark'),
      icon: <Icons.MoonOutlined />,
      onClick: () => handleSelect(ThemeMode.DARK),
    },
    ...(allowOSPreference
      ? [
          {
            key: ThemeMode.SYSTEM,
            label: t('Match system'),
            icon: <Icons.FormatPainterOutlined />,
            onClick: () => handleSelect(ThemeMode.SYSTEM),
          },
        ]
      : []),
  ];

  // Add clear settings option only when there's a local theme active
  const clearOption =
    onClearLocalSettings && hasLocalOverride
      ? {
          key: 'clear-local',
          label: t('Clear local theme'),
          icon: <Icons.ClearOutlined />,
          onClick: onClearLocalSettings,
        }
      : null;

  return (
    <StyledThemeSubMenu
      key="theme-sub-menu"
      title={selectedThemeModeIcon}
      icon={<Icons.CaretDownOutlined iconSize="xs" />}
    >
      <Menu.ItemGroup title={t('Theme')} />
      {themeOptions.map(option => (
        <StyledThemeSubMenuItem
          key={option.key}
          onClick={option.onClick}
          selected={option.key === themeMode}
        >
          {option.icon} {option.label}
        </StyledThemeSubMenuItem>
      ))}
      {clearOption && [
        <Menu.Divider key="theme-divider" />,
        <Menu.Item key={clearOption.key} onClick={clearOption.onClick}>
          {clearOption.icon} {clearOption.label}
        </Menu.Item>,
      ]}
    </StyledThemeSubMenu>
  );
};
