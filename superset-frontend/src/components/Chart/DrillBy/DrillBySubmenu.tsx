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

import {
  CSSProperties,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BaseFormData,
  Behavior,
  Column,
  ContextMenuFilters,
  css,
  ensureIsArray,
  getChartMetadataRegistry,
  t,
  useTheme,
} from '@superset-ui/core';
import {
  Constants,
  Input,
  Loading,
  Popover,
  Icons,
} from '@superset-ui/core/components';
import { debounce } from 'lodash';
import { FixedSizeList as List } from 'react-window';
import { InputRef } from 'antd';
import { MenuItemTooltip } from '../DisabledMenuItemTooltip';
import { VirtualizedMenuItem } from '../MenuItemWithTruncation';
import { Dataset } from '../types';

const SUBMENU_HEIGHT = 200;
const SHOW_COLUMNS_SEARCH_THRESHOLD = 10;

export interface DrillBySubmenuProps {
  drillByConfig?: ContextMenuFilters['drillBy'];
  formData: BaseFormData & { [key: string]: any };
  onSelection?: (...args: any) => void;
  onClick?: (event: MouseEvent) => void;
  onCloseMenu?: () => void;
  openNewModal?: boolean;
  excludedColumns?: Column[];
  onDrillBy?: (column: Column, dataset: Dataset) => void;
  dataset?: Dataset;
  isLoadingDataset?: boolean;
}

export const DrillBySubmenu = ({
  drillByConfig,
  formData,
  onSelection = () => {},
  onClick = () => {},
  onCloseMenu = () => {},
  openNewModal = true,
  excludedColumns,
  onDrillBy,
  dataset,
  isLoadingDataset = false,
  ...rest
}: DrillBySubmenuProps) => {
  const theme = useTheme();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchInput, setDebouncedSearchInput] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const ref = useRef<InputRef>(null);
  const menuItemRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () => (dataset ? ensureIsArray(dataset.drillable_columns) : []),
    [dataset],
  );
  const showSearch = columns.length > SHOW_COLUMNS_SEARCH_THRESHOLD;

  const handleSelection = useCallback(
    (event, column) => {
      onClick(event as MouseEvent);
      onSelection(column, drillByConfig);
      if (openNewModal && onDrillBy && dataset) {
        onDrillBy(column, dataset);
      }
      setPopoverOpen(false);
      onCloseMenu();
    },
    [
      drillByConfig,
      onClick,
      onSelection,
      openNewModal,
      onDrillBy,
      dataset,
      onCloseMenu,
    ],
  );

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (popoverOpen) {
      // Small delay to ensure popover is rendered
      timeoutId = setTimeout(() => {
        ref.current?.input?.focus({ preventScroll: true });
      }, 100);
    } else {
      // Reset search input when menu is closed
      setSearchInput('');
      setDebouncedSearchInput('');
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [popoverOpen]);

  const hasDrillBy = drillByConfig?.groupbyFieldName;

  const handlesDimensionContextMenu = useMemo(
    () =>
      getChartMetadataRegistry()
        .get(formData.viz_type)
        ?.behaviors.find(behavior => behavior === Behavior.DrillBy),
    [formData.viz_type],
  );

  const debouncedSetSearchInput = useMemo(
    () =>
      debounce((value: string) => {
        setDebouncedSearchInput(value);
      }, Constants.FAST_DEBOUNCE),
    [],
  );

  const handleInput = (value: string) => {
    setSearchInput(value);
    debouncedSetSearchInput(value);
  };

  const filteredColumns = useMemo(
    () =>
      columns
        .filter(column => {
          // Filter out excluded columns
          const excludedColumnNames =
            excludedColumns?.map(col => col.column_name) || [];
          return !excludedColumnNames.includes(column.column_name);
        })
        .filter(column =>
          (column.verbose_name || column.column_name)
            .toLowerCase()
            .includes(debouncedSearchInput.toLowerCase()),
        ),
    [columns, debouncedSearchInput, excludedColumns],
  );

  let tooltip: ReactNode;

  if (!handlesDimensionContextMenu) {
    tooltip = t('Drill by is not yet supported for this chart type');
  } else if (!hasDrillBy) {
    tooltip = t('Drill by is not available for this data point');
  }

  if (
    formData.matrixify_enable_vertical_layout === true ||
    formData.matrixify_enable_horizontal_layout === true
  ) {
    return null;
  }

  const isDisabled = !handlesDimensionContextMenu || !hasDrillBy;

  const Row = ({
    index,
    data,
    style,
  }: {
    index: number;
    data: { columns: Column[] };
    style: CSSProperties;
  }) => {
    const { columns } = data;
    const column = columns[index];
    return (
      <VirtualizedMenuItem
        tooltipText={column.verbose_name || column.column_name}
        onClick={e => handleSelection(e, column)}
        style={style}
      >
        {column.verbose_name || column.column_name}
      </VirtualizedMenuItem>
    );
  };

  const popoverContent = (
    <div
      role="menu"
      tabIndex={0}
      data-test="drill-by-submenu"
      css={css`
        width: 220px;
        max-width: 220px;
        .ant-input-affix-wrapper {
          margin-bottom: ${theme.sizeUnit * 2}px;
        }
      `}
      onClick={e => e.stopPropagation()}
    >
      {showSearch && (
        <Input
          ref={ref}
          prefix={
            <Icons.SearchOutlined iconSize="l" iconColor={theme.colorIcon} />
          }
          onChange={e => {
            e.stopPropagation();
            handleInput(e.target.value);
          }}
          placeholder={t('Search columns')}
          onClick={e => {
            // prevent closing menu when clicking on input
            e.nativeEvent.stopImmediatePropagation();
          }}
          allowClear
          css={css`
            width: 100%;
            box-shadow: none;
          `}
          value={searchInput}
        />
      )}
      {isLoadingDataset ? (
        <div
          css={css`
            padding: ${theme.sizeUnit * 3}px 0;
          `}
        >
          <Loading position="inline-centered" />
        </div>
      ) : filteredColumns.length ? (
        <List
          width="100%"
          height={SUBMENU_HEIGHT}
          itemSize={35}
          itemCount={filteredColumns.length}
          itemData={{ columns: filteredColumns }}
          overscanCount={20}
        >
          {Row}
        </List>
      ) : (
        <div
          css={css`
            padding: ${theme.sizeUnit * 2}px;
            color: ${theme.colorTextDisabled};
            text-align: center;
          `}
        >
          {t('No columns found')}
        </div>
      )}
    </div>
  );

  const menuItem = (
    <div
      ref={menuItemRef}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      css={css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
        color: ${isDisabled ? theme.colorTextDisabled : 'inherit'};
        &:hover {
          background: transparent;
        }
      `}
      onClick={() => !isDisabled && setPopoverOpen(!popoverOpen)}
      onKeyDown={e => {
        if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setPopoverOpen(!popoverOpen);
        }
      }}
    >
      <span>{t('Drill by')}</span>
      {isDisabled ? (
        <MenuItemTooltip title={tooltip} />
      ) : (
        <Icons.RightOutlined iconSize="s" iconColor={theme.colorTextTertiary} />
      )}
    </div>
  );

  if (isDisabled) {
    return menuItem;
  }

  return (
    <Popover
      content={popoverContent}
      placement="rightTop"
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      trigger={['hover', 'click']}
      arrow={false}
      styles={{
        root: {
          paddingLeft: 0,
        },
        body: {
          padding: theme.sizeUnit * 2,
          boxShadow: theme.boxShadow,
          borderRadius: theme.borderRadius,
        },
      }}
      {...rest}
    >
      {menuItem}
    </Popover>
  );
};
