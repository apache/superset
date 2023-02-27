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
  forwardRef,
  ReactNode,
  RefObject,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import ReactDOM from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Behavior,
  ContextMenuFilters,
  FeatureFlag,
  getChartMetadataRegistry,
  isFeatureEnabled,
  QueryFormData,
  t,
  useTheme,
} from '@superset-ui/core';
import { RootState } from 'src/dashboard/types';
import { findPermission } from 'src/utils/findPermission';
import { Menu } from 'src/components/Menu';
import { AntdDropdown as Dropdown } from 'src/components';
import { DrillDetailMenuItems } from './DrillDetail';
import { getMenuAdjustedY } from './utils';
import { updateDataMask } from '../../dataMask/actions';
import { MenuItemTooltip } from './DisabledMenuItemTooltip';

export interface ChartContextMenuProps {
  id: number;
  formData: QueryFormData;
  onSelection: () => void;
  onClose: () => void;
}

export interface Ref {
  open: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
}

const ChartContextMenu = (
  { id, formData, onSelection, onClose }: ChartContextMenuProps,
  ref: RefObject<Ref>,
) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const canExplore = useSelector((state: RootState) =>
    findPermission('can_explore', 'Superset', state.user?.roles),
  );
  const crossFiltersEnabled = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.crossFiltersEnabled,
  );

  const [{ filters, clientX, clientY }, setState] = useState<{
    clientX: number;
    clientY: number;
    filters?: ContextMenuFilters;
  }>({ clientX: 0, clientY: 0 });

  const menuItems = [];

  const showDrillToDetail =
    isFeatureEnabled(FeatureFlag.DRILL_TO_DETAIL) && canExplore;

  const isCrossFilteringSupportedByChart = getChartMetadataRegistry()
    .get(formData.viz_type)
    ?.behaviors?.includes(Behavior.INTERACTIVE_CHART);

  let itemsCount = 0;
  if (isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
    itemsCount += 1;
  }
  if (showDrillToDetail) {
    itemsCount += 2; // Drill to detail always has 2 top-level menu items
  }
  if (itemsCount === 0) {
    itemsCount = 1; // "No actions" appears if no actions in menu
  }

  if (isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
    const isCrossFilterDisabled =
      !isCrossFilteringSupportedByChart ||
      !crossFiltersEnabled ||
      !filters?.crossFilter;

    let crossFilteringTooltipTitle: ReactNode = null;
    if (!isCrossFilterDisabled) {
      crossFilteringTooltipTitle = (
        <>
          <div>
            {t(
              'Cross-filter will be applied to all of the charts that use this dataset.',
            )}
          </div>
          <div>
            {t('You can also just click on the chart to apply cross-filter.')}
          </div>
        </>
      );
    } else if (!crossFiltersEnabled) {
      crossFilteringTooltipTitle = (
        <>
          <div>{t('Cross-filtering is not enabled for this dashboard.')}</div>
        </>
      );
    } else if (!isCrossFilteringSupportedByChart) {
      crossFilteringTooltipTitle = (
        <>
          <div>
            {t('This visualization type does not support cross-filtering.')}
          </div>
        </>
      );
    } else if (!filters?.crossFilter) {
      crossFilteringTooltipTitle = (
        <>
          <div>{t(`You can't apply cross-filter on this data point.`)}</div>
        </>
      );
    }
    menuItems.push(
      <>
        <Menu.Item
          key="cross-filtering-menu-item"
          disabled={isCrossFilterDisabled}
          onClick={() => {
            if (filters?.crossFilter) {
              dispatch(updateDataMask(id, filters.crossFilter.dataMask));
            }
          }}
        >
          {filters?.crossFilter?.isCurrentValueSelected ? (
            t('Remove cross-filter')
          ) : (
            <div>
              {t('Add cross-filter')}
              <MenuItemTooltip
                title={crossFilteringTooltipTitle}
                color={
                  !isCrossFilterDisabled
                    ? theme.colors.grayscale.base
                    : undefined
                }
              />
            </div>
          )}
        </Menu.Item>
        {itemsCount > 1 && <Menu.Divider />}
      </>,
    );
  }
  if (showDrillToDetail) {
    menuItems.push(
      <DrillDetailMenuItems
        chartId={id}
        formData={formData}
        filters={filters?.drillToDetail}
        isContextMenu
        contextMenuY={clientY}
        onSelection={onSelection}
      />,
    );
  }

  const open = useCallback(
    (clientX: number, clientY: number, filters?: ContextMenuFilters) => {
      const adjustedY = getMenuAdjustedY(clientY, itemsCount);
      setState({
        clientX,
        clientY: adjustedY,
        filters,
      });

      // Since Ant Design's Dropdown does not offer an imperative API
      // and we can't attach event triggers to charts SVG elements, we
      // use a hidden span that gets clicked on when receiving click events
      // from the charts.
      document.getElementById(`hidden-span-${id}`)?.click();
    },
    [id, itemsCount],
  );

  useImperativeHandle(
    ref,
    () => ({
      open,
    }),
    [open],
  );

  return ReactDOM.createPortal(
    <Dropdown
      overlay={
        <Menu>
          {menuItems.length ? (
            menuItems
          ) : (
            <Menu.Item disabled>No actions</Menu.Item>
          )}
        </Menu>
      }
      trigger={['click']}
      onVisibleChange={value => !value && onClose()}
    >
      <span
        id={`hidden-span-${id}`}
        css={{
          visibility: 'hidden',
          position: 'fixed',
          top: clientY,
          left: clientX,
          width: 1,
          height: 1,
        }}
      />
    </Dropdown>,
    document.body,
  );
};

export default forwardRef(ChartContextMenu);
