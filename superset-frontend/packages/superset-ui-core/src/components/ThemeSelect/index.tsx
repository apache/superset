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
import { type MenuItem, Dropdown, Icons } from '@superset-ui/core/components';
import { t, ThemeAlgorithm, ThemeMode, useTheme } from '@superset-ui/core';

export interface ThemeSelectProps {
  setThemeMode: (newMode: ThemeMode) => void;
  tooltipTitle?: string;
  themeMode: ThemeMode;
  hasLocalOverride?: boolean;
  onClearLocalSettings?: () => void;
  allowOSPreference?: boolean;
}

const ThemeSelect: React.FC<ThemeSelectProps> = ({
  setThemeMode,
  tooltipTitle = 'Select theme',
  themeMode,
  hasLocalOverride = false,
  onClearLocalSettings,
  allowOSPreference = true,
}) => {
  const theme = useTheme();

  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const themeIconMap: Record<ThemeAlgorithm | ThemeMode, React.ReactNode> = {
    [ThemeAlgorithm.DEFAULT]: <Icons.SunOutlined />,
    [ThemeAlgorithm.DARK]: <Icons.MoonOutlined />,
    [ThemeMode.SYSTEM]: <Icons.FormatPainterOutlined />,
    [ThemeAlgorithm.COMPACT]: <Icons.CompressOutlined />,
  };

  // Use different icon when local theme is active
  const triggerIcon = hasLocalOverride ? (
    <Icons.FormatPainterOutlined style={{ color: theme.colorErrorText }} />
  ) : (
    themeIconMap[themeMode] || <Icons.FormatPainterOutlined />
  );

  const menuItems: MenuItem[] = [
    {
      type: 'group',
      label: t('Theme'),
    },
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
  if (onClearLocalSettings && hasLocalOverride) {
    menuItems.push(
      { type: 'divider' } as MenuItem,
      {
        key: 'clear-local',
        label: t('Clear local theme'),
        icon: <Icons.ClearOutlined />,
        onClick: onClearLocalSettings,
      } as MenuItem,
    );
  }

  return (
    <Dropdown
      menu={{
        items: menuItems,
        selectedKeys: [themeMode],
      }}
      trigger={['hover']}
    >
      {triggerIcon}
    </Dropdown>
  );
};

export default ThemeSelect;
