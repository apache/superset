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

import React, {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Menu } from 'src/components/Menu';
import {
  Behavior,
  Column,
  ContextMenuFilters,
  css,
  ensureIsArray,
  getChartMetadataRegistry,
  t,
  useTheme,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Input } from 'src/components/Input';
import { MenuItemTooltip } from '../DisabledMenuItemTooltip';
import { getSubmenuYOffset } from '../utils';

const MAX_SUBMENU_HEIGHT = 200;
const SHOW_COLUMNS_SEARCH_THRESHOLD = 10;
const SEARCH_INPUT_HEIGHT = 48;

export interface DrillByMenuItemsProps {
  filters?: ContextMenuFilters['drillBy'];
  formData: { [key: string]: any; viz_type: string };
  columns: Column[];
  contextMenuY?: number;
  submenuIndex?: number;
}
export const DrillByMenuItems = ({
  filters,
  columns,
  formData,
  contextMenuY = 0,
  submenuIndex = 0,
  ...rest
}: DrillByMenuItemsProps) => {
  const theme = useTheme();
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    // Input is displayed only when columns.length > SHOW_COLUMNS_SEARCH_THRESHOLD
    // Reset search input in case Input gets removed
    setSearchInput('');
  }, [columns.length]);

  const handleInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const input = e?.target?.value;
    setSearchInput(input);
  }, []);

  const handlesDimensionContextMenu = useMemo(
    () =>
      getChartMetadataRegistry()
        .get(formData.viz_type)
        ?.behaviors.find(behavior => behavior === Behavior.DRILL_BY),
    [formData.viz_type],
  );

  const filteredColumns = useMemo(
    () =>
      columns.filter(column =>
        (column.verbose_name || column.column_name)
          .toLowerCase()
          .includes(searchInput.toLowerCase()),
      ),
    [columns, searchInput],
  );

  const submenuYOffset = useMemo(
    () =>
      getSubmenuYOffset(
        contextMenuY,
        filteredColumns.length || 1,
        submenuIndex,
        MAX_SUBMENU_HEIGHT,
        columns.length > SHOW_COLUMNS_SEARCH_THRESHOLD
          ? SEARCH_INPUT_HEIGHT
          : 0,
      ),
    [contextMenuY, filteredColumns.length, columns.length],
  );

  let tooltip: ReactNode;

  const hasFilters = ensureIsArray(filters).length;
  if (!handlesDimensionContextMenu) {
    tooltip = t('Drill by is not yet supported for this chart type');
  } else if (!hasFilters) {
    tooltip = t('Drill by is not available for this data point');
  } else if (columns.length === 0) {
    tooltip = t('No dimensions available for drill by');
  }

  if (!handlesDimensionContextMenu || !hasFilters || columns.length === 0) {
    return (
      <Menu.Item key="drill-by-disabled" disabled {...rest}>
        <div>
          {t('Drill by')}
          <MenuItemTooltip title={tooltip} />
        </div>
      </Menu.Item>
    );
  }

  return (
    <Menu.SubMenu
      title={t('Drill by')}
      key="drill-by-submenu"
      popupOffset={[0, submenuYOffset]}
      popupClassName="drill-by-submenu"
      {...rest}
    >
      {columns.length > SHOW_COLUMNS_SEARCH_THRESHOLD && (
        <Input
          prefix={
            <Icons.Search
              iconSize="l"
              iconColor={theme.colors.grayscale.light1}
            />
          }
          onChange={handleInput}
          placeholder={t('Search columns')}
          value={searchInput}
          onClick={e => {
            // prevent closing menu when clicking on input
            // @ts-ignore
            e.stopImmediatePropagation();
          }}
          allowClear
          css={css`
            width: auto;
            max-width: 100%;
            margin: ${theme.gridUnit * 2}px ${theme.gridUnit * 3}px;
            box-shadow: none;
          `}
        />
      )}
      {filteredColumns.length ? (
        <div
          css={css`
            max-height: ${MAX_SUBMENU_HEIGHT}px;
            overflow: auto;
          `}
        >
          {filteredColumns.map(column => (
            <Menu.Item key={`drill-by-item-${column.column_name}`} {...rest}>
              {column.verbose_name || column.column_name}
            </Menu.Item>
          ))}
        </div>
      ) : (
        <Menu.Item disabled key="no-drill-by-columns-found" {...rest}>
          {t('No columns found')}
        </Menu.Item>
      )}
    </Menu.SubMenu>
  );
};
