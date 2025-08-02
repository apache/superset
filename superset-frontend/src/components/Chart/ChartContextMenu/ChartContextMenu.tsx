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
  Key,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
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
  logging,
  QueryFormData,
  t,
  useTheme,
} from '@superset-ui/core';
import { RootState } from 'src/dashboard/types';
import { Menu } from '@superset-ui/core/components/Menu';
import { usePermissions } from 'src/hooks/usePermissions';
import { Dropdown } from '@superset-ui/core/components';
import { updateDataMask } from 'src/dataMask/actions';
import DrillByModal from 'src/components/Chart/DrillBy/DrillByModal';
import { useVerboseMap } from 'src/hooks/apiResources/datasets';
import { Dataset } from 'src/components/Chart/types';
import {
  cachedSupersetGet,
  supersetGetCache,
} from 'src/utils/cachedSupersetGet';
import { DrillDetailMenuItems } from '../DrillDetail';
import { getMenuAdjustedY } from '../utils';
import { MenuItemTooltip } from '../DisabledMenuItemTooltip';
import { DrillByMenuItems } from '../DrillBy/DrillByMenuItems';
import DrillDetailModal from '../DrillDetail/DrillDetailModal';

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
  const theme = useTheme();
  const dispatch = useDispatch();
  const { canDrillToDetail, canDrillBy, canDownload } = usePermissions();

  const crossFiltersEnabled = useSelector<RootState, boolean>(
    ({ dashboardInfo }) => dashboardInfo.crossFiltersEnabled,
  );
  const dashboardId = useSelector<RootState, number>(
    ({ dashboardInfo }) => dashboardInfo.id,
  );
  const [openKeys, setOpenKeys] = useState<Key[]>([]);

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

  const [drillModalIsOpen, setDrillModalIsOpen] = useState(false);
  const [drillByColumn, setDrillByColumn] = useState<Column>();
  const [showDrillByModal, setShowDrillByModal] = useState(false);
  const [dataset, setDataset] = useState<Dataset>();
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const verboseMap = useVerboseMap(dataset);

  const closeContextMenu = useCallback(() => {
    setVisible(false);
    setOpenKeys([]);
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

  const menuItems: React.JSX.Element[] = [];

  const showDrillToDetail =
    isFeatureEnabled(FeatureFlag.DrillToDetail) &&
    canDrillToDetail &&
    isDisplayed(ContextMenuItem.DrillToDetail);

  const showDrillBy =
    isFeatureEnabled(FeatureFlag.DrillBy) &&
    canDrillBy &&
    isDisplayed(ContextMenuItem.DrillBy);

  useEffect(() => {
    async function fetchDataset() {
      if (!visible || dataset || (!showDrillBy && !showDrillToDetail)) return;

      const datasetId = Number(formData.datasource.split('__')[0]);
      try {
        setIsLoadingDataset(true);
        let response;

        if (loadDrillByOptionsExtension) {
          response = await loadDrillByOptionsExtension(datasetId, formData);
        } else {
          const endpoint = `/api/v1/dataset/${datasetId}/drill_info/?q=(dashboard_id:${dashboardId})`;
          response = await cachedSupersetGet({ endpoint });
        }

        const { json } = response;
        const { result } = json;

        setDataset(result);
      } catch (error) {
        logging.error('Failed to load dataset:', error);
        supersetGetCache.delete(`/api/v1/dataset/${datasetId}/drill_info/`);
      } finally {
        setIsLoadingDataset(false);
      }
    }

    fetchDataset();
  }, [
    visible,
    showDrillBy,
    showDrillToDetail,
    formData.datasource,
    loadDrillByOptionsExtension,
    dashboardId,
  ]);

  // Compute filteredDataset with all columns returned + a filtered list of valid drillable options
  const filteredDataset = useMemo(() => {
    if (!dataset || !showDrillBy) return dataset;

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
    dataset,
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
        formData={formData}
        filters={filters?.drillToDetail}
        setFilters={setFilters}
        isContextMenu
        contextMenuY={clientY}
        onSelection={onSelection}
        submenuIndex={showCrossFilters ? 2 : 1}
        setShowModal={setDrillModalIsOpen}
        dataset={filteredDataset}
        isLoadingDataset={isLoadingDataset}
        {...(additionalConfig?.drillToDetail || {})}
      />,
    );
  }
  if (showDrillBy) {
    let submenuIndex = 0;
    if (showCrossFilters) {
      submenuIndex += 1;
    }
    if (showDrillToDetail) {
      submenuIndex += 2;
    }
    menuItems.push(
      <DrillByMenuItems
        drillByConfig={filters?.drillBy}
        onSelection={onSelection}
        onCloseMenu={closeContextMenu}
        formData={formData}
        contextMenuY={clientY}
        submenuIndex={submenuIndex}
        open={openKeys.includes('drill-by-submenu')}
        key="drill-by-submenu"
        onDrillBy={handleDrillBy}
        dataset={filteredDataset}
        isLoadingDataset={isLoadingDataset}
        {...(additionalConfig?.drillBy || {})}
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
    <>
      <Dropdown
        popupRender={() => (
          <Menu
            className="chart-context-menu"
            data-test="chart-context-menu"
            onOpenChange={setOpenKeys}
            onClick={() => {
              setVisible(false);
              setOpenKeys([]);
              onClose();
            }}
          >
            {menuItems.length ? (
              menuItems
            ) : (
              <Menu.Item disabled>{t('No actions')}</Menu.Item>
            )}
          </Menu>
        )}
        trigger={['click']}
        onOpenChange={value => {
          setVisible(value);
          if (!value) {
            setOpenKeys([]);
          }
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
      {showDrillByModal && drillByColumn && dataset && filters?.drillBy && (
        <DrillByModal
          column={drillByColumn}
          drillByConfig={filters?.drillBy}
          formData={formData}
          onHideModal={handleCloseDrillByModal}
          dataset={{ ...filteredDataset!, verbose_map: verboseMap }}
          canDownload={canDownload}
        />
      )}
    </>,
    document.body,
  );
};

export default forwardRef(ChartContextMenu);
