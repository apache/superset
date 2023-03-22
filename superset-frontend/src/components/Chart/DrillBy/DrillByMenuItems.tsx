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
  getChartMetadataRegistry,
  t,
  useTheme,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Input } from 'src/components/Input';
import { MenuItemTooltip } from '../DisabledMenuItemTooltip';
import { getSubmenuYOffset } from '../utils';

export interface DrillByMenuItemsProps {
  filters?: ContextMenuFilters['drillBy'];
  formData: { [key: string]: any; viz_type: string };
  columns: Column[];
  contextMenuY?: number;
}
export const DrillByMenuItems = ({
  filters,
  columns,
  formData,
  contextMenuY = 0,
  ...rest
}: DrillByMenuItemsProps) => {
  const theme = useTheme();
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    // Input is displayed only when columns.length > 10
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

  const submenuYOffset = useMemo(
    () =>
      getSubmenuYOffset(
        contextMenuY,
        columns.length > 1 ? columns.length + 1 : columns.length,
      ),
    [contextMenuY, columns.length],
  );

  let tooltip: ReactNode;

  if (!handlesDimensionContextMenu) {
    tooltip = t('Drill by is not yet supported for this chart type');
  } else if (!filters) {
    tooltip = t('Drill by is not available for this data point');
  } else if (columns.length === 0) {
    tooltip = t('No dimensions available for drill by');
  }

  const filteredColumns = useMemo(
    () =>
      columns.filter(column =>
        (column.verbose_name || column.column_name)
          .toLowerCase()
          .includes(searchInput.toLowerCase()),
      ),
    [columns, searchInput],
  );

  return useMemo(() => {
    if (!handlesDimensionContextMenu || !filters || columns.length === 0) {
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
        popupOffset={[0, submenuYOffset]}
        {...rest}
      >
        {columns.length > 10 && (
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
              max-height: 200px;
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
          <div>No columns found</div>
        )}
      </Menu.SubMenu>
    );
  }, [
    columns.length,
    filteredColumns,
    filters,
    handleInput,
    handlesDimensionContextMenu,
    rest,
    searchInput,
    submenuYOffset,
    theme.colors.grayscale.light1,
    theme.gridUnit,
    tooltip,
  ]);
};
