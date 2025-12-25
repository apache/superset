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
import { t } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { css } from '@apache-superset/core/ui';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { ComponentMenuKeys } from './index';

const dropdownIconsStyles = css`
  &&.anticon > .anticon:first-child {
    margin-right: 0;
    vertical-align: 0;
  }
`;

export interface UseComponentMenuItemsOptions {
  /** Whether to include theme menu item */
  includeTheme?: boolean;

  /** Whether to include delete menu item */
  includeDelete?: boolean;

  /** Whether the component has a theme applied */
  hasThemeApplied?: boolean;

  /** Name of the applied theme (for display) */
  appliedThemeName?: string;

  /** Additional custom menu items to include before standard items */
  customItems?: MenuItem[];

  /** Additional custom menu items to include after standard items */
  customItemsAfter?: MenuItem[];
}

/**
 * Hook to build standard menu items for dashboard components.
 *
 * Provides consistent menu item structure across all component types,
 * with optional theme selection and delete actions.
 */
export function useComponentMenuItems({
  includeTheme = true,
  includeDelete = true,
  hasThemeApplied = false,
  appliedThemeName,
  customItems = [],
  customItemsAfter = [],
}: UseComponentMenuItemsOptions = {}): MenuItem[] {
  return useMemo(() => {
    const items: MenuItem[] = [];

    // Add custom items first
    if (customItems.length > 0) {
      items.push(...customItems);
    }

    // Add theme items
    if (includeTheme) {
      if (items.length > 0) {
        items.push({ type: 'divider' });
      }

      items.push({
        key: ComponentMenuKeys.ApplyTheme,
        label: hasThemeApplied
          ? t('Change theme (%s)', appliedThemeName || t('Custom'))
          : t('Apply theme'),
        icon: <Icons.BgColorsOutlined css={dropdownIconsStyles} />,
      });

      if (hasThemeApplied) {
        items.push({
          key: ComponentMenuKeys.ClearTheme,
          label: t('Clear theme'),
          icon: <Icons.ClearOutlined css={dropdownIconsStyles} />,
        });
      }
    }

    // Add custom items after theme
    if (customItemsAfter.length > 0) {
      if (items.length > 0) {
        items.push({ type: 'divider' });
      }
      items.push(...customItemsAfter);
    }

    // Add delete as last item
    if (includeDelete) {
      if (items.length > 0) {
        items.push({ type: 'divider' });
      }
      items.push({
        key: ComponentMenuKeys.Delete,
        label: t('Delete'),
        icon: <Icons.DeleteOutlined css={dropdownIconsStyles} />,
        danger: true,
      });
    }

    return items;
  }, [
    includeTheme,
    includeDelete,
    hasThemeApplied,
    appliedThemeName,
    customItems,
    customItemsAfter,
  ]);
}

export default useComponentMenuItems;
