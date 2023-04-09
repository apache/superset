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
  BaseFormData,
  Behavior,
  BinaryQueryObjectFilterClause,
  Column,
  css,
  ensureIsArray,
  getChartMetadataRegistry,
  t,
  useTheme,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Input } from 'src/components/Input';
import {
  cachedSupersetGet,
  supersetGetCache,
} from 'src/utils/cachedSupersetGet';
import { MenuItemTooltip } from '../DisabledMenuItemTooltip';
import DrillByModal from './DrillByModal';
import { getSubmenuYOffset } from '../utils';
import { MenuItemWithTruncation } from '../MenuItemWithTruncation';
import { Dataset } from '../types';

const MAX_SUBMENU_HEIGHT = 200;
const SHOW_COLUMNS_SEARCH_THRESHOLD = 10;
const SEARCH_INPUT_HEIGHT = 48;

export interface DrillByMenuItemsProps {
  filters?: BinaryQueryObjectFilterClause[];
  formData: BaseFormData & { [key: string]: any };
  contextMenuY?: number;
  submenuIndex?: number;
  groupbyFieldName?: string;
  onSelection?: () => void;
  onClick?: (event: MouseEvent) => void;
}

export const DrillByMenuItems = ({
  filters,
  groupbyFieldName,
  formData,
  contextMenuY = 0,
  submenuIndex = 0,
  onSelection = () => {},
  onClick = () => {},
  ...rest
}: DrillByMenuItemsProps) => {
  const theme = useTheme();
  const [searchInput, setSearchInput] = useState('');
  const [dataset, setDataset] = useState<Dataset>();
  const [columns, setColumns] = useState<Column[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currentColumn, setCurrentColumn] = useState();

  const openModal = useCallback(
    (event, column) => {
      onClick(event);
      onSelection();
      setCurrentColumn(column);
      setShowModal(true);
    },
    [onClick, onSelection],
  );
  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  useEffect(() => {
    // Input is displayed only when columns.length > SHOW_COLUMNS_SEARCH_THRESHOLD
    // Reset search input in case Input gets removed
    setSearchInput('');
  }, [columns.length]);

  const hasDrillBy = ensureIsArray(filters).length && groupbyFieldName;

  const handlesDimensionContextMenu = useMemo(
    () =>
      getChartMetadataRegistry()
        .get(formData.viz_type)
        ?.behaviors.find(behavior => behavior === Behavior.DRILL_BY),
    [formData.viz_type],
  );

  useEffect(() => {
    if (handlesDimensionContextMenu && hasDrillBy) {
      const datasetId = formData.datasource.split('__')[0];
      cachedSupersetGet({
        endpoint: `/api/v1/dataset/${datasetId}`,
      })
        .then(({ json: { result } }) => {
          setDataset(result);
          setColumns(
            ensureIsArray(result.columns)
              .filter(column => column.groupby)
              .filter(
                column =>
                  !ensureIsArray(formData[groupbyFieldName]).includes(
                    column.column_name,
                  ),
              ),
          );
        })
        .catch(() => {
          supersetGetCache.delete(`/api/v1/dataset/${datasetId}`);
        });
    }
  }, [formData, groupbyFieldName, handlesDimensionContextMenu, hasDrillBy]);

  const handleInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const input = e?.target?.value;
    setSearchInput(input);
  }, []);

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
    [contextMenuY, filteredColumns.length, submenuIndex, columns.length],
  );

  let tooltip: ReactNode;

  if (!handlesDimensionContextMenu) {
    tooltip = t('Drill by is not yet supported for this chart type');
  } else if (!hasDrillBy) {
    tooltip = t('Drill by is not available for this data point');
  } else if (columns.length === 0) {
    tooltip = t('No dimensions available for drill by');
  }

  if (!handlesDimensionContextMenu || !hasDrillBy || columns.length === 0) {
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
    <>
      <Menu.SubMenu
        title={t('Drill by')}
        key="drill-by-submenu"
        popupClassName="chart-context-submenu"
        popupOffset={[0, submenuYOffset]}
        {...rest}
      >
        <div data-test="drill-by-submenu">
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
                e.nativeEvent.stopImmediatePropagation();
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
                <MenuItemWithTruncation
                  key={`drill-by-item-${column.column_name}`}
                  tooltipText={column.verbose_name || column.column_name}
                  {...rest}
                  onClick={e => openModal(e, column)}
                >
                  {column.verbose_name || column.column_name}
                </MenuItemWithTruncation>
              ))}
            </div>
          ) : (
            <Menu.Item disabled key="no-drill-by-columns-found" {...rest}>
              {t('No columns found')}
            </Menu.Item>
          )}
        </div>
      </Menu.SubMenu>
      <DrillByModal
        column={currentColumn}
        filters={filters}
        formData={formData}
        groupbyFieldName={groupbyFieldName}
        onHideModal={closeModal}
        showModal={showModal}
        dataset={dataset!}
      />
    </>
  );
};
