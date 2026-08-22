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
import { useCallback, useMemo, useState, ReactNode } from 'react';
import cx from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { ResizeCallback, ResizeStartCallback } from 're-resizable';
import { css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { DataMask, Filter } from '@superset-ui/core';
import { Button, Select } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import PopoverDropdown from '@superset-ui/core/components/PopoverDropdown';
import {
  FilterBarOrientation,
  LayoutItem,
  RootState,
} from 'src/dashboard/types';
import { updateDataMask } from 'src/dataMask/actions';
import { Draggable } from 'src/dashboard/components/dnd/DragDroppable';
import DragHandle from 'src/dashboard/components/dnd/DragHandle';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import IconButton from 'src/dashboard/components/IconButton';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import FilterControl from 'src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterControl';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  GRID_BASE_UNIT,
  GRID_MIN_COLUMN_COUNT,
  GRID_MIN_ROW_UNITS,
  GRID_COLUMN_COUNT,
} from 'src/dashboard/util/constants';

interface FilterHolderProps {
  id: string;
  parentId: string;
  component: LayoutItem;
  parentComponent: LayoutItem;
  index: number;
  depth: number;
  editMode: boolean;

  // grid related
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: ResizeStartCallback;
  onResize: ResizeCallback;
  onResizeStop: ResizeCallback;

  // dnd
  deleteComponent: (id: string, parentId: string) => void;
  updateComponents: (updates: Record<string, LayoutItem>) => void;
  handleComponentDrop: (...args: unknown[]) => unknown;
}

const FilterHolder = ({
  id,
  parentId,
  component,
  parentComponent,
  index,
  depth,
  availableColumnCount,
  columnWidth,
  onResizeStart,
  onResize,
  onResizeStop,
  editMode,
  deleteComponent,
  updateComponents,
  handleComponentDrop,
}: FilterHolderProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const [isFocused, setIsFocused] = useState(false);
  const [stagedDataMask, setStagedDataMask] = useState<DataMask | null>(null);

  const nativeFilters = useSelector(
    (state: RootState) => state.nativeFilters?.filters || {},
  );
  const dataMask = useSelector((state: RootState) => state.dataMask || {});

  const filterId = component.meta?.filterId as string | undefined;
  const filter = filterId
    ? (nativeFilters[filterId] as Filter | undefined)
    : undefined;

  const titlePosition =
    (component.meta?.titlePosition as 'top' | 'left') || 'top';
  const applyMode =
    (component.meta?.applyMode as 'instant' | 'manual') || 'instant';
  const buttonPlacement =
    (component.meta?.buttonPlacement as 'bottom' | 'right' | 'stacked_right') ||
    'bottom';

  const filterWithDataMask = useMemo(() => {
    if (!filter) return null;
    return {
      ...filter,
      dataMask: stagedDataMask || dataMask[filter.id],
      inCanvas: true,
    } as Filter & { inCanvas: boolean };
  }, [filter, dataMask, stagedDataMask]);

  const updateMeta = useCallback(
    (metaUpdates: Record<string, unknown>) => {
      updateComponents({
        [component.id]: {
          ...component,
          meta: {
            ...component.meta,
            ...metaUpdates,
          },
        },
      });
    },
    [component, updateComponents],
  );

  const handleChangeTitlePosition = useCallback(
    (nextPosition: string) => {
      updateMeta({ titlePosition: nextPosition });
    },
    [updateMeta],
  );

  const handleChangeApplyMode = useCallback(
    (nextApplyMode: string) => {
      setStagedDataMask(null);
      updateMeta({ applyMode: nextApplyMode });
    },
    [updateMeta],
  );

  const handleChangeButtonPlacement = useCallback(
    (nextPlacement: string) => {
      updateMeta({ buttonPlacement: nextPlacement });
    },
    [updateMeta],
  );

  const handleSelectFilter = useCallback(
    (nextFilterId: string) => {
      setStagedDataMask(null);
      updateMeta({ filterId: nextFilterId });
    },
    [updateMeta],
  );

  const handleFilterSelectionChange = useCallback(
    (targetFilter: Filter, nextDataMask: DataMask) => {
      if (applyMode === 'manual') {
        setStagedDataMask(nextDataMask);
      } else {
        dispatch(updateDataMask(targetFilter.id, nextDataMask));
      }
    },
    [applyMode, dispatch],
  );

  const handleApplyStagedFilter = useCallback(() => {
    if (filter && stagedDataMask) {
      dispatch(updateDataMask(filter.id, stagedDataMask));
      setStagedDataMask(null);
    }
  }, [dispatch, filter, stagedDataMask]);

  const handleClearStagedFilter = useCallback(() => {
    if (filter) {
      const clearedValue =
        filter.filterType === 'filter_range' ? [null, null] : undefined;
      const clearedMask: DataMask = {
        filterState: { value: clearedValue },
        extraFormData: {},
      };
      dispatch(updateDataMask(filter.id, clearedMask));
      setStagedDataMask(null);
    }
  }, [dispatch, filter]);

  const handleDelete = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const availableFilters = useMemo(
    () =>
      Object.values(nativeFilters).map((f: Filter) => ({
        label: f.name || f.id,
        value: f.id,
      })),
    [nativeFilters],
  );

  const widthMultiple =
    parentComponent.type === COLUMN_TYPE
      ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
      : component.meta.width || GRID_MIN_COLUMN_COUNT;

  const labelOptions = useMemo(
    () => [
      { value: 'top', label: t('Label: Top') },
      { value: 'left', label: t('Label: Left') },
    ],
    [],
  );

  const applyOptions = useMemo(
    () => [
      { value: 'instant', label: t('Apply: Instant') },
      { value: 'manual', label: t('Apply: Button') },
    ],
    [],
  );

  const buttonPlacementOptions = useMemo(
    () => [
      { value: 'bottom', label: t('Buttons: Bottom') },
      { value: 'right', label: t('Buttons: Right (Inline)') },
      { value: 'stacked_right', label: t('Buttons: Right (Stacked)') },
    ],
    [],
  );

  const popoverMenuItems = useMemo(
    () => [
      <PopoverDropdown
        key="title-position"
        id={`${component.id}-title-position`}
        options={labelOptions}
        value={titlePosition}
        onChange={val => handleChangeTitlePosition(String(val))}
        renderButton={(opt: { label: ReactNode }) => (
          <span
            css={css`
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-weight: 500;
              font-size: 12px;
            `}
          >
            <Icons.TagsOutlined iconSize="s" />
            {opt.label}
          </span>
        )}
      />,
      <PopoverDropdown
        key="apply-mode"
        id={`${component.id}-apply-mode`}
        options={applyOptions}
        value={applyMode}
        onChange={val => handleChangeApplyMode(String(val))}
        renderButton={(opt: { label: ReactNode }) => (
          <span
            css={css`
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-weight: 500;
              font-size: 12px;
            `}
          >
            <Icons.CheckCircleOutlined iconSize="s" />
            {opt.label}
          </span>
        )}
      />,
      ...(applyMode === 'manual'
        ? [
            <PopoverDropdown
              key="button-placement"
              id={`${component.id}-button-placement`}
              options={buttonPlacementOptions}
              value={buttonPlacement}
              onChange={val => handleChangeButtonPlacement(String(val))}
              renderButton={(opt: { label: ReactNode }) => (
                <span
                  css={css`
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-weight: 500;
                    font-size: 12px;
                  `}
                >
                  <Icons.AppstoreOutlined iconSize="s" />
                  {opt.label}
                </span>
              )}
            />,
          ]
        : []),
      ...(availableFilters.length > 0
        ? [
            <PopoverDropdown
              key="filter-binding"
              id={`${component.id}-filter-binding`}
              options={availableFilters}
              value={filterId || ''}
              onChange={val => handleSelectFilter(String(val))}
              renderButton={(opt: { label: ReactNode }) => (
                <span
                  css={css`
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-weight: 500;
                    font-size: 12px;
                    max-width: 140px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  `}
                >
                  <Icons.FilterOutlined iconSize="s" />
                  {opt.label}
                </span>
              )}
            />,
          ]
        : []),
    ],
    [
      availableFilters,
      component.id,
      filterId,
      handleChangeApplyMode,
      handleChangeButtonPlacement,
      handleChangeTitlePosition,
      handleSelectFilter,
      applyMode,
      applyOptions,
      buttonPlacement,
      buttonPlacementOptions,
      labelOptions,
      titlePosition,
    ],
  );

  const renderChild = useCallback(
    ({ dragSourceRef }: { dragSourceRef?: React.Ref<HTMLDivElement> }) => (
      <ResizableContainer
        id={component.id}
        adjustableWidth={parentComponent.type === ROW_TYPE}
        adjustableHeight
        widthStep={columnWidth}
        widthMultiple={widthMultiple}
        heightStep={GRID_BASE_UNIT}
        heightMultiple={component.meta.height ?? GRID_MIN_ROW_UNITS}
        minWidthMultiple={GRID_MIN_COLUMN_COUNT}
        minHeightMultiple={GRID_MIN_ROW_UNITS}
        maxWidthMultiple={Math.min(
          availableColumnCount + widthMultiple,
          GRID_COLUMN_COUNT,
        )}
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeStop={onResizeStop}
        editMode={editMode}
      >
        <WithPopoverMenu
          isFocused={isFocused}
          onChangeFocus={setIsFocused}
          disableClick
          menuItems={popoverMenuItems}
          editMode={editMode}
          style={{ width: '100%', height: '100%' }}
        >
          <div
            ref={dragSourceRef}
            data-test="dashboard-component-filter-holder"
            className={cx(
              'dashboard-component',
              'dashboard-component-filter-holder',
              titlePosition === 'left' &&
                'dashboard-component-filter-holder--label-left',
            )}
            css={css`
              background: ${theme.colorBgContainer};
              border-radius: ${theme.borderRadius}px;
              padding: 4px ${theme.sizeUnit * 2}px;
              height: 100%;
              min-height: 32px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              box-sizing: border-box;
              border: 1px solid ${editMode ? theme.colorBorder : 'transparent'};
              overflow: visible !important;
              position: relative;
              z-index: 10;
              &:focus-within {
                z-index: 100;
              }

              /* Reset Ant Form Item spacing so vertically shrunk filters fit cleanly */
              .ant-form-item {
                margin: 0 !important;
                width: 100%;
              }
              .ant-form-item-control-input {
                min-height: unset !important;
              }
              .ant-form-item-label {
                padding-bottom: 2px !important;
              }

              .hover-menu--top {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: ${theme.sizeUnit}px;
                padding: 2px ${theme.sizeUnit}px;
                background: ${theme.colorBgContainer};
                border: 1px solid ${theme.colorBorderSecondary};
                border-radius: ${theme.borderRadius}px;
                box-shadow: ${theme.boxShadowTertiary || '0 2px 8px rgba(0,0,0,0.08)'};
                right: 8px !important;
                left: auto !important;
                transform: none !important;
                top: -12px !important;
                z-index: 12;
              }
            `}
          >
            {editMode && (
              <HoverMenu position="top">
                <DragHandle position="top" />
                <IconButton
                  onClick={() => setIsFocused(true)}
                  icon={<Icons.SettingOutlined iconSize="m" />}
                />
                <DeleteComponentButton onDelete={handleDelete} />
              </HoverMenu>
            )}

            {filterWithDataMask ? (
              <div
                css={css`
                  width: 100%;
                  height: 100%;
                  display: flex;
                  flex-direction: ${
                    buttonPlacement === 'bottom' ? 'column' : 'row'
                  };
                  align-items: ${
                    buttonPlacement === 'bottom' ? 'stretch' : 'center'
                  };
                  justify-content: center;
                  gap: ${theme.sizeUnit}px;
                `}
              >
                <div
                  css={css`
                    flex: 1;
                    min-width: 0;
                    width: 100%;
                  `}
                >
                  <FilterControl
                    filter={filterWithDataMask}
                    dataMaskSelected={dataMask}
                    orientation={
                      titlePosition === 'left'
                        ? FilterBarOrientation.Horizontal
                        : FilterBarOrientation.Vertical
                    }
                    inView
                    onFilterSelectionChange={handleFilterSelectionChange}
                  />
                </div>

                {applyMode === 'manual' && (
                  <div
                    css={css`
                      display: flex;
                      flex-direction: ${
                        buttonPlacement === 'stacked_right' ? 'column' : 'row'
                      };
                      gap: 4px;
                      margin-top: ${buttonPlacement === 'bottom' ? '4px' : '0'};
                      justify-content: ${
                        buttonPlacement === 'bottom' ? 'flex-end' : 'center'
                      };
                      align-items: center;
                      flex-shrink: 0;
                    `}
                  >
                    <Button
                      type="primary"
                      size="small"
                      disabled={!stagedDataMask}
                      onClick={handleApplyStagedFilter}
                      css={css`
                        font-size: 11px;
                        padding: 0 8px;
                        font-weight: 500;
                      `}
                    >
                      {t('Apply')}
                    </Button>
                    <Button
                      size="small"
                      disabled={
                        !stagedDataMask &&
                        !dataMask[filter?.id || '']?.filterState?.value
                      }
                      onClick={handleClearStagedFilter}
                      css={css`
                        font-size: 11px;
                        padding: 0 8px;
                        font-weight: 500;
                      `}
                    >
                      {t('Clear')}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div
                css={css`
                  padding: ${theme.sizeUnit}px;
                  text-align: center;
                  color: ${theme.colorTextSecondary};
                  width: 100%;
                `}
              >
                {editMode ? (
                  <div>
                    <div
                      css={css`
                        font-size: ${theme.fontSizeSM}px;
                        margin-bottom: 4px;
                        font-weight: 500;
                      `}
                    >
                      {t('Assign Native Filter to Canvas')}
                    </div>
                    {availableFilters.length > 0 ? (
                      <Select
                        placeholder={t('Select filter...')}
                        options={availableFilters}
                        value={filterId}
                        onChange={val => handleSelectFilter(String(val))}
                        ariaLabel={t('Select filter')}
                      />
                    ) : (
                      <span
                        css={css`
                          font-size: ${theme.fontSizeSM}px;
                        `}
                      >
                        {t('No native filters configured. Add a filter first.')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span>{t('Filter not configured')}</span>
                )}
              </div>
            )}
          </div>
        </WithPopoverMenu>
      </ResizableContainer>
    ),
    [
      availableColumnCount,
      availableFilters,
      columnWidth,
      component,
      editMode,
      filterId,
      filterWithDataMask,
      filter,
      dataMask,
      handleDelete,
      handleFilterSelectionChange,
      handleSelectFilter,
      handleApplyStagedFilter,
      handleClearStagedFilter,
      onResize,
      onResizeStart,
      onResizeStop,
      parentComponent.type,
      theme,
      titlePosition,
      applyMode,
      buttonPlacement,
      stagedDataMask,
      isFocused,
      popoverMenuItems,
      widthMultiple,
    ],
  );

  return (
    <Draggable
      component={component}
      parentComponent={parentComponent}
      orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      editMode={editMode}
    >
      {renderChild}
    </Draggable>
  );
};

export default FilterHolder;
