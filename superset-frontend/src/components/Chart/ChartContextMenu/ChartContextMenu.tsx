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
  forwardRef,
  ReactNode,
  RefObject,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import ReactDOM from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Behavior,
  BinaryQueryObjectFilterClause,
  Column,
  ContextMenuFilters,
  ensureIsArray,
  FeatureFlag,
  getChartMetadataRegistry,
  getExtensionsRegistry,
  isFeatureEnabled,
  QueryFormData,
  t,
  useTheme,
} from '@superset-ui/core';
import { RootState } from 'src/dashboard/types';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { usePermissions } from 'src/hooks/usePermissions';
import { Dropdown } from '@superset-ui/core/components';
import { updateDataMask } from 'src/dataMask/actions';
import DrillByModal from 'src/components/Chart/DrillBy/DrillByModal';
import { useDatasetDrillInfo } from 'src/hooks/apiResources/datasets';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import { useDrillDetailMenuItems } from '../useDrillDetailMenuItems';
import { getMenuAdjustedY } from '../utils';
import { DrillBySubmenu } from '../DrillBy/DrillBySubmenu';
import DrillDetailModal from '../DrillDetail/DrillDetailModal';
import { MenuItemTooltip } from '../DisabledMenuItemTooltip';

export enum ContextMenuItem {
  CrossFilter,
  DrillToDetail,
  DrillBy,
  All,
}
export interface ChartContextMenuProps {
  id: number;
  formData: QueryFormData;
  onSelection: (args?: any) => void;
  onClose: () => void;
  additionalConfig?: {
    crossFilter?: Record<string, any>;
    drillToDetail?: Record<string, any>;
    drillBy?: Record<string, any>;
  };
  displayedItems?: ContextMenuItem[] | ContextMenuItem;
}

export interface ChartContextMenuRef {
  open: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
}

const ChartContextMenu = (
  {
    id,
    formData,
    onSelection,
    onClose,
    displayedItems = ContextMenuItem.All,
    additionalConfig,
  }: ChartContextMenuProps,
  ref: RefObject<ChartContextMenuRef>,
) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { canDrillToDetail, canDrillBy, canDownload } = usePermissions();

  const crossFiltersEnabled = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.crossFiltersEnabled,
  );
  const dashboardId = useSelector<RootState, number>(
    ({ dashboardInfo }) => dashboardInfo.id,
  );

  const [modalFilters, setFilters] = useState<BinaryQueryObjectFilterClause[]>(
    [],
  );

  const [visible, setVisible] = useState(false);

  const isDisplayed = (item: ContextMenuItem) =>
    displayedItems === ContextMenuItem.All ||
    ensureIsArray(displayedItems).includes(item);

  const [{ filters, clientX, clientY }, setState] = useState<{
    clientX: number;
    clientY: number;
    filters?: ContextMenuFilters;
  }>({ clientX: 0, clientY: 0 });

  // Extract matrixifyContext if present and merge cell filters
  const enhancedFilters = useMemo(() => {
    if (!filters) return filters;

    // Check if this is from a matrixified cell
    const matrixifyContext = (filters as any)?.matrixifyContext;
    if (!matrixifyContext) return filters;

    // Merge cell filters with drill filters
    const enhancedDrillBy = filters.drillBy
      ? {
          ...filters.drillBy,
          filters: [
            ...(filters.drillBy.filters || []),
            ...(matrixifyContext.cellFilters || []),
          ],
        }
      : undefined;

    return {
      ...filters,
      drillBy: enhancedDrillBy,
    };
  }, [filters]);

  // Use cell's formData for drill-to-detail if from matrixified cell
  const drillFormData = useMemo(() => {
    const matrixifyContext = (filters as any)?.matrixifyContext;
    // If this is from a matrixified cell, use the cell's formData which includes adhoc_filters
    return matrixifyContext?.cellFormData || formData;
  }, [filters, formData]);

  const [drillModalIsOpen, setDrillModalIsOpen] = useState(false);
  const [drillByColumn, setDrillByColumn] = useState<Column>();
  const [showDrillByModal, setShowDrillByModal] = useState(false);

  const closeContextMenu = useCallback(() => {
    setVisible(false);
    onClose();
  }, [onClose]);

  const handleDrillBy = useCallback((column: Column) => {
    setDrillByColumn(column);
    setShowDrillByModal(true);
  }, []);

  const loadDrillByOptionsExtension = getExtensionsRegistry().get(
    'load.drillby.options',
  );

  const handleCloseDrillByModal = useCallback(() => {
    setShowDrillByModal(false);
  }, []);

  const menuItems: MenuItem[] = [];

  const showDrillToDetail =
    isFeatureEnabled(FeatureFlag.DrillToDetail) &&
    canDrillToDetail &&
    isDisplayed(ContextMenuItem.DrillToDetail);

  const showDrillBy =
    isFeatureEnabled(FeatureFlag.DrillBy) &&
    canDrillBy &&
    isDisplayed(ContextMenuItem.DrillBy);

  const datasetResource = useDatasetDrillInfo(
    formData.datasource,
    dashboardId,
    formData,
    !canDrillToDetail && !canDrillBy,
  );

  const isLoadingDataset = datasetResource.status === ResourceStatus.Loading;

  // Compute filteredDataset with all columns returned + a filtered list of valid drillable options
  const filteredDataset = useMemo(() => {
    // Short circuit if still loading
    if (datasetResource.status !== ResourceStatus.Complete) {
      return undefined;
    }

    // No need to filter the dataset if Drill By is not allowed
    if (!showDrillBy) {
      return datasetResource.result;
    }

    const dataset = datasetResource.result;

    const filteredColumns = ensureIsArray(dataset.columns).filter(
      column =>
        // If using an extension, also filter by column.groupby since the extension might not do this
        (!loadDrillByOptionsExtension || column.groupby) &&
        !ensureIsArray(
          formData[filters?.drillBy?.groupbyFieldName ?? ''],
        ).includes(column.column_name) &&
        column.column_name !== formData.x_axis &&
        ensureIsArray(additionalConfig?.drillBy?.excludedColumns)?.every(
          excludedCol => excludedCol.column_name !== column.column_name,
        ),
    );

    return {
      ...dataset,
      drillable_columns: filteredColumns,
    };
  }, [
    datasetResource.status,
    datasetResource.result,
    showDrillBy,
    filters?.drillBy?.groupbyFieldName,
    formData.x_axis,
    formData[filters?.drillBy?.groupbyFieldName ?? ''],
    additionalConfig?.drillBy?.excludedColumns,
    loadDrillByOptionsExtension,
  ]);

  const showCrossFilters = isDisplayed(ContextMenuItem.CrossFilter);

  const isCrossFilteringSupportedByChart = getChartMetadataRegistry()
    .get(formData.viz_type)
    ?.behaviors?.includes(Behavior.InteractiveChart);

  let itemsCount = 0;
  if (showCrossFilters) {
    itemsCount += 1;
  }
  if (showDrillToDetail) {
    itemsCount += 2; // Drill to detail always has 2 top-level menu items
  }
  if (showDrillBy) {
    itemsCount += 1;
  }
  if (itemsCount === 0) {
    itemsCount = 1; // "No actions" appears if no actions in menu
  }

  const drillDetailMenuItems = useDrillDetailMenuItems({
    formData: drillFormData,
    filters: filters?.drillToDetail,
    setFilters,
    isContextMenu: true,
    contextMenuY: clientY,
    onSelection,
    submenuIndex: showCrossFilters ? 2 : 1,
    setShowModal: setDrillModalIsOpen,
    dataset: filteredDataset,
    isLoadingDataset,
    ...(additionalConfig?.drillToDetail || {}),
  });

  if (showCrossFilters) {
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
      {
        key: 'cross-filtering-menu-item',
        label: filters?.crossFilter?.isCurrentValueSelected ? (
          t('Remove cross-filter')
        ) : (
          <span>
            {t('Add cross-filter')}
            <MenuItemTooltip
              title={crossFilteringTooltipTitle}
              color={!isCrossFilterDisabled ? theme.colorIcon : undefined}
            />
          </span>
        ),
        disabled: isCrossFilterDisabled,
        onClick: () => {
          if (filters?.crossFilter) {
            dispatch(updateDataMask(id, filters.crossFilter.dataMask));
          }
        },
      },
      ...(itemsCount > 1
        ? [{ key: 'divider-1', type: 'divider' as const }]
        : []),
    );
  }
  if (showDrillToDetail) {
    menuItems.push(...drillDetailMenuItems);
  }

  if (showDrillBy) {
    if (menuItems.length > 0) {
      menuItems.push({ key: 'divider-drill-by', type: 'divider' as const });
    }

    const hasDrillBy = enhancedFilters?.drillBy?.groupbyFieldName;
    const handlesDimensionContextMenu = getChartMetadataRegistry()
      .get(formData.viz_type)
      ?.behaviors.find(behavior => behavior === Behavior.DrillBy);
    const isDrillByDisabled = !handlesDimensionContextMenu || !hasDrillBy;

    // Add a custom render component for DrillBy submenu to support react-window
    menuItems.push({
      key: 'drill-by-submenu',
      disabled: isDrillByDisabled,
      label: (
        <DrillBySubmenu
          drillByConfig={enhancedFilters?.drillBy}
          onSelection={onSelection}
          onCloseMenu={closeContextMenu}
          formData={formData}
          onDrillBy={handleDrillBy}
          dataset={filteredDataset}
          isLoadingDataset={isLoadingDataset}
          {...(additionalConfig?.drillBy || {})}
        />
      ),
    });
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
    <>
      <Dropdown
        menu={{
          items:
            menuItems.length > 0
              ? menuItems
              : [{ key: 'no-actions', label: t('No actions'), disabled: true }],
          onClick: () => {
            setVisible(false);
            onClose();
          },
        }}
        dropdownRender={menu => (
          <div data-test="chart-context-menu">{menu}</div>
        )}
        trigger={['click']}
        onOpenChange={value => {
          setVisible(value);
        }}
        open={visible}
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
      </Dropdown>
      {showDrillToDetail && (
        <DrillDetailModal
          initialFilters={modalFilters}
          chartId={id}
          formData={formData}
          showModal={drillModalIsOpen}
          onHideModal={() => {
            setDrillModalIsOpen(false);
          }}
          dataset={filteredDataset}
        />
      )}
      {showDrillByModal &&
        drillByColumn &&
        filteredDataset &&
        filters?.drillBy && (
          <DrillByModal
            column={drillByColumn}
            drillByConfig={filters?.drillBy}
            formData={formData}
            onHideModal={handleCloseDrillByModal}
            dataset={filteredDataset}
            canDownload={canDownload}
          />
        )}
    </>,
    document.body,
  );
};

export default forwardRef(ChartContextMenu);
