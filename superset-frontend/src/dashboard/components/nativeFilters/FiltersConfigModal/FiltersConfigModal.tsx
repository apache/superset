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
import { memo, useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { uniq, debounce } from 'lodash';
import { t } from '@apache-superset/core';
import { ChartCustomizationType, NativeFilterType } from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/ui';
import { Constants, Form, Icons, Flex } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components';
import { testWithId } from 'src/utils/testUtils';
import useEffectEvent from 'src/hooks/useEffectEvent';
import {
  BaseModalWrapper,
  BaseModalBody,
  BaseForm,
  BaseExpandButtonWrapper,
} from 'src/dashboard/components/nativeFilters/ConfigModal/SharedStyles';
import {
  useChartCustomizationConfiguration,
  useChartCustomizationConfigMap,
  useFilterConfigMap,
  useFilterConfiguration,
} from '../state';
import {
  FilterPanels,
  FiltersConfigFormHandle,
} from './FiltersConfigForm/FiltersConfigForm';
import Footer from './Footer/Footer';
import { useOpenModal, useRemoveCurrentFilter } from './state';
import { NativeFiltersForm, SaveChangesType, FilterChangesType } from './types';
import {
  useItemStateManager,
  useFilterOperations,
  useCustomizationOperations,
  useModalSaveLogic,
  ALLOW_DEPENDENCIES,
} from './hooks';
import {
  getFilterIds,
  getChartCustomizationIds,
  isFilterId,
  isChartCustomizationId,
  transformDividerId,
} from './utils';
import { ConfigModalContent } from './ConfigModalContent';
import ConfigModalSidebar from './ConfigModalSidebar';

export { ALLOW_DEPENDENCIES };

const StyledModalBody = styled(BaseModalBody)`
  .filters-list {
    width: ${({ theme }) => theme.sizeUnit * 50}px;
    overflow: auto;
  }
`;

const StyledMainFlex = styled(Flex)`
  height: 100%;
`;

export const FILTERS_CONFIG_MODAL_TEST_ID = 'filters-config-modal';
export const getFiltersConfigModalTestId = testWithId(
  FILTERS_CONFIG_MODAL_TEST_ID,
);

export interface FiltersConfigModalProps {
  isOpen: boolean;
  initialFilterId?: string;
  createNewOnOpen?: boolean;
  onSave: (changes: SaveChangesType) => Promise<void>;
  onCancel: () => void;
}

function getInitialRenderedItems(
  itemId: string | undefined,
  predicate: (id: string) => boolean,
): string[] {
  return itemId && predicate(itemId) ? [itemId] : [];
}

function FiltersConfigModal({
  isOpen,
  initialFilterId,
  createNewOnOpen,
  onSave,
  onCancel,
}: FiltersConfigModalProps) {
  const theme = useTheme();
  const [form] = Form.useForm<NativeFiltersForm>();
  const configFormRef = useRef<FiltersConfigFormHandle>(null);

  const filterConfig = useFilterConfiguration();
  const filterConfigMap = useFilterConfigMap();
  const chartCustomizationConfig = useChartCustomizationConfiguration();
  const chartCustomizationConfigMap = useChartCustomizationConfigMap();

  const initialFilterOrder = useMemo(
    () => Object.keys(filterConfigMap),
    [filterConfigMap],
  );
  const initialCustomizationOrder = useMemo(
    () => Object.keys(chartCustomizationConfigMap),
    [chartCustomizationConfigMap],
  );

  const filterState = useItemStateManager(initialFilterOrder, filterConfigMap);
  const customizationState = useItemStateManager(
    initialCustomizationOrder,
    chartCustomizationConfigMap,
  );

  const [saveAlertVisible, setSaveAlertVisible] = useState<boolean>(false);
  const [expanded, setExpanded] = useState(false);
  const [activeCollapseKeys, setActiveCollapseKeys] = useState<string[]>([
    'filters',
    'chartCustomizations',
  ]);

  const filterIds = useMemo(
    () => uniq([...getFilterIds(filterConfig), ...filterState.newIds]),
    [filterConfig, filterState.newIds],
  );

  const chartCustomizationIds = useMemo(
    () =>
      uniq([
        ...getChartCustomizationIds(chartCustomizationConfig),
        ...customizationState.newIds,
      ]),
    [chartCustomizationConfig, customizationState.newIds],
  );

  const initialCurrentFilterId =
    initialFilterId ?? filterIds[0] ?? chartCustomizationIds[0] ?? '';
  const [currentItemId, setCurrentItemId] = useState<string>(
    initialCurrentFilterId,
  );

  const getActiveFilterPanelKey = (filterId: string) => [
    `${filterId}-${FilterPanels.configuration.key}`,
    `${filterId}-${FilterPanels.settings.key}`,
  ];

  const [activeFilterPanelKey, setActiveFilterPanelKey] = useState<
    string | string[]
  >(() => {
    if (initialCurrentFilterId) {
      if (isFilterId(initialCurrentFilterId)) {
        return getActiveFilterPanelKey(initialCurrentFilterId);
      }
      if (isChartCustomizationId(initialCurrentFilterId)) {
        return [
          `${initialCurrentFilterId}-${FilterPanels.configuration.key}`,
          `${initialCurrentFilterId}-${FilterPanels.settings.key}`,
        ];
      }
    }
    return [];
  });

  const unsavedFiltersIds = useMemo(
    () => filterState.newIds.filter(id => !filterState.removedItems[id]),
    [filterState.newIds, filterState.removedItems],
  );

  const isItemActive = useCallback(
    (id: string) => currentItemId === id,
    [currentItemId],
  );

  const setActiveItem = useCallback((id: string) => {
    setCurrentItemId(id);
    if (isFilterId(id)) {
      setActiveFilterPanelKey(getActiveFilterPanelKey(id));
    } else if (isChartCustomizationId(id)) {
      setActiveFilterPanelKey([
        `${id}-${FilterPanels.configuration.key}`,
        `${id}-${FilterPanels.settings.key}`,
      ]);
    }
  }, []);

  const handleModifyItem = useCallback(
    (id: string) => {
      const isFilter = isFilterId(id);
      const state = isFilter ? filterState : customizationState;

      if (!state.changes.modified.includes(id)) {
        state.setChanges(prev => ({
          ...prev,
          modified: [...prev.modified, id],
        }));
      }
    },
    [filterState, customizationState],
  );

  const resetForm = useCallback(
    (isSaving = false) => {
      filterState.resetState();
      customizationState.resetState();
      setSaveAlertVisible(false);

      const resetItemId = filterIds[0] ?? chartCustomizationIds[0] ?? '';
      setCurrentItemId(resetItemId);
      filterState.setRenderedIds(
        getInitialRenderedItems(resetItemId, isFilterId),
      );
      customizationState.setRenderedIds(
        getInitialRenderedItems(resetItemId, isChartCustomizationId),
      );

      if (filterIds.length > 0) {
        setActiveFilterPanelKey(getActiveFilterPanelKey(filterIds[0]));
      }
      if (!isSaving) {
        filterState.setOrderedIds(initialFilterOrder);
        customizationState.setOrderedIds(initialCustomizationOrder);
      }

      form.resetFields(['filters']);
      form.setFieldsValue({ changed: false });
    },
    [
      form,
      filterIds,
      chartCustomizationIds,
      initialFilterOrder,
      initialCustomizationOrder,
      filterState,
      customizationState,
    ],
  );

  const filterOperations = useFilterOperations({
    form,
    filterState,
    filterIds,
    filterConfigMap,
    handleModifyItem,
    setActiveItem,
    setSaveAlertVisible,
  });

  const modalSaveLogic = useModalSaveLogic({
    form,
    configFormRef,
    filterState,
    customizationState,
    filterIds,
    chartCustomizationIds,
    filterConfigMap,
    chartCustomizationConfigMap,
    initialFilterOrder,
    initialCustomizationOrder,
    unsavedFiltersIds,
    currentItemId,
    setActiveItem,
    onSave,
    canBeUsedAsDependency: filterOperations.canBeUsedAsDependency,
    resetForm,
  });

  const customizationOperations = useCustomizationOperations({
    customizationState,
    handleModifyItem,
    setActiveItem,
    setSaveAlertVisible,
  });

  const getAvailableFilters = useCallback(
    (filterId: string) =>
      filterOperations.getAvailableFilters(
        filterId,
        modalSaveLogic.getItemTitle,
      ),
    [filterOperations, modalSaveLogic.getItemTitle],
  );

  const restoreItem = useCallback(
    (id: string) => {
      const isFilter = isFilterId(id);
      if (isFilter) {
        filterOperations.restoreFilter(id);
      } else {
        customizationOperations.restoreCustomization(id);
      }
    },
    [filterOperations, customizationOperations],
  );

  const handleRemoveItem = useCallback(
    (id: string) => {
      const isFilter = isFilterId(id);
      if (isFilter) {
        filterOperations.handleRemoveFilter(id);
      } else {
        customizationOperations.handleRemoveCustomization(id);
      }
    },
    [filterOperations, customizationOperations],
  );

  const handleRearrangeItems = useCallback(
    (dragIndex: number, targetIndex: number, id: string) => {
      const isFilter = isFilterId(id);
      if (isFilter) {
        filterOperations.handleRearrangeFilters(dragIndex, targetIndex);
      } else {
        customizationOperations.handleRearrangeCustomizations(
          dragIndex,
          targetIndex,
        );
      }
    },
    [filterOperations, customizationOperations],
  );

  const handleCrossListMove = useCallback(
    (
      sourceId: string,
      targetIndex: number,
      sourceType: 'filter' | 'customization',
      targetType: 'filter' | 'customization',
    ) => {
      if (!sourceId || sourceType === targetType) {
        return;
      }

      const sourceState =
        sourceType === 'filter' ? filterState : customizationState;
      const targetState =
        targetType === 'filter' ? filterState : customizationState;

      const newId = transformDividerId(sourceId, targetType);

      const sourceIndex = sourceState.orderedIds.indexOf(sourceId);
      if (sourceIndex === -1) return;

      const newSourceIds = [...sourceState.orderedIds];
      newSourceIds.splice(sourceIndex, 1);
      sourceState.setOrderedIds(newSourceIds);

      const newTargetIds = [...targetState.orderedIds];
      newTargetIds.splice(targetIndex, 0, newId);
      targetState.setOrderedIds(newTargetIds);

      const formValues = form.getFieldValue('filters') || {};
      let oldData = formValues[sourceId];

      if (!oldData) {
        const sourceConfigMap =
          sourceType === 'filter'
            ? filterConfigMap
            : chartCustomizationConfigMap;
        const configData = sourceConfigMap[sourceId];
        if (configData && 'title' in configData) {
          oldData = {
            title: configData.title,
            description: configData.description,
          };
        }
      }

      const newFormValues = { ...formValues };
      const newType =
        targetType === 'customization'
          ? ChartCustomizationType.Divider
          : NativeFilterType.Divider;
      newFormValues[newId] = { ...oldData, type: newType };
      delete newFormValues[sourceId];
      form.setFieldsValue({ filters: newFormValues });

      const isNewItem = sourceState.newIds.includes(sourceId);

      if (isNewItem) {
        sourceState.setNewIds(
          sourceState.newIds.filter((id: string) => id !== sourceId),
        );
      } else {
        sourceState.setChanges((prev: FilterChangesType) => ({
          ...prev,
          deleted: [...prev.deleted, sourceId],
        }));
      }

      sourceState.setChanges((prev: FilterChangesType) => ({
        ...prev,
        modified: prev.modified.filter((id: string) => id !== sourceId),
        reordered: newSourceIds,
      }));

      targetState.setNewIds([...targetState.newIds, newId]);
      targetState.setChanges((prev: FilterChangesType) => ({
        ...prev,
        modified: [...prev.modified, newId],
        reordered: newTargetIds,
      }));

      setActiveItem(newId);
      setSaveAlertVisible(false);
    },
    [
      filterState,
      customizationState,
      form,
      filterConfigMap,
      chartCustomizationConfigMap,
      setActiveItem,
      setSaveAlertVisible,
    ],
  );

  const handleCancel = useCallback(() => {
    if (modalSaveLogic.hasUnsavedChanges) {
      setSaveAlertVisible(true);
    } else {
      resetForm();
      onCancel();
    }
  }, [modalSaveLogic.hasUnsavedChanges, resetForm, onCancel]);

  const handleConfirmCancel = useCallback(() => {
    resetForm();
    onCancel();
  }, [resetForm, onCancel]);

  const toggleExpand = useEffectEvent(() => {
    setExpanded(!expanded);
  });

  const ToggleIcon = expanded
    ? Icons.FullscreenExitOutlined
    : Icons.FullscreenOutlined;

  const [formValuesVersion, setFormValuesVersion] = useState(0);

  const itemTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    [...filterIds, ...chartCustomizationIds].forEach(id => {
      titles[id] = modalSaveLogic.getItemTitle(id);
    });
    return titles;
  }, [filterIds, chartCustomizationIds, modalSaveLogic, formValuesVersion]);

  const debouncedErrorHandling = useMemo(
    () =>
      debounce(() => {
        setSaveAlertVisible(false);
        modalSaveLogic.handleErroredItems();
      }, Constants.SLOW_DEBOUNCE),
    [modalSaveLogic],
  );

  const handleValuesChange = useCallback(() => {
    setFormValuesVersion(prev => prev + 1);
    debouncedErrorHandling();
  }, [debouncedErrorHandling]);

  const handleActiveFilterPanelChange = useCallback(
    (key: string | string[]) => setActiveFilterPanelKey(key),
    [],
  );

  useOpenModal(isOpen, filterOperations.addFilter, createNewOnOpen);

  useRemoveCurrentFilter(
    { ...filterState.removedItems, ...customizationState.removedItems },
    currentItemId,
    [...filterState.orderedIds, ...customizationState.orderedIds],
    setActiveItem,
  );

  useEffect(() => {
    if (isFilterId(currentItemId)) {
      filterState.addToRendered(currentItemId);
    }
  }, [currentItemId, filterState]);

  useEffect(() => {
    if (isChartCustomizationId(currentItemId)) {
      customizationState.addToRendered(currentItemId);
    }
  }, [currentItemId, customizationState]);

  const handleSetErroredFilters = useCallback(
    (updater: (filters: string[]) => string[]) => {
      filterState.setErroredIds(updater(filterState.erroredIds));
    },
    [filterState],
  );

  const handleSetErroredCustomizations = useCallback(
    (updater: (filters: string[]) => string[]) => {
      customizationState.setErroredIds(updater(customizationState.erroredIds));
    },
    [customizationState],
  );

  return (
    <BaseModalWrapper
      open={isOpen}
      maskClosable={false}
      title={t('Add or edit display controls')}
      expanded={expanded}
      destroyOnHidden
      onCancel={handleCancel}
      onOk={modalSaveLogic.handleSave}
      centered
      data-test="filter-modal"
      footer={
        <div
          css={css`
            display: flex;
            justify-content: flex-end;
            align-items: flex-end;
          `}
        >
          <Footer
            onDismiss={() => setSaveAlertVisible(false)}
            onCancel={handleCancel}
            handleSave={modalSaveLogic.handleSave}
            canSave={modalSaveLogic.canSave}
            saveAlertVisible={saveAlertVisible}
            onConfirmCancel={handleConfirmCancel}
          />
          <BaseExpandButtonWrapper>
            <ToggleIcon
              iconSize="l"
              iconColor={theme.colorIcon}
              onClick={toggleExpand}
            />
          </BaseExpandButtonWrapper>
        </div>
      }
    >
      <ErrorBoundary>
        <StyledModalBody expanded={expanded}>
          <BaseForm
            form={form}
            onValuesChange={handleValuesChange}
            layout="vertical"
            preserve
          >
            <StyledMainFlex>
              <ConfigModalSidebar
                filterIds={filterIds}
                chartCustomizationIds={chartCustomizationIds}
                currentItemId={currentItemId}
                filterOrderedIds={filterState.orderedIds}
                filterRemovedItems={filterState.removedItems}
                filterErroredItems={filterState.erroredIds}
                customizationOrderedIds={customizationState.orderedIds}
                customizationRemovedItems={customizationState.removedItems}
                customizationErroredItems={customizationState.erroredIds}
                activeCollapseKeys={activeCollapseKeys}
                getItemTitle={modalSaveLogic.getItemTitle}
                itemTitles={itemTitles}
                onAddFilter={filterOperations.addFilter}
                onAddCustomization={
                  customizationOperations.addChartCustomization
                }
                onChange={setActiveItem}
                onRearrange={handleRearrangeItems}
                onRemove={handleRemoveItem}
                restoreItem={restoreItem}
                onCollapseChange={setActiveCollapseKeys}
                onCrossListDrop={handleCrossListMove}
              />

              <ConfigModalContent
                currentItemId={currentItemId}
                filterIds={filterIds}
                chartCustomizationIds={chartCustomizationIds}
                filterState={{
                  orderedIds: filterState.orderedIds,
                  renderedIds: filterState.renderedIds,
                  removedItems: filterState.removedItems,
                }}
                customizationState={{
                  orderedIds: customizationState.orderedIds,
                  renderedIds: customizationState.renderedIds,
                  removedItems: customizationState.removedItems,
                }}
                filterConfigMap={filterConfigMap}
                chartCustomizationConfigMap={chartCustomizationConfigMap}
                isItemActive={isItemActive}
                expanded={expanded}
                form={form}
                configFormRef={configFormRef}
                restoreItem={restoreItem}
                getAvailableFilters={getAvailableFilters}
                activeFilterPanelKey={activeFilterPanelKey}
                handleActiveFilterPanelChange={handleActiveFilterPanelChange}
                handleSetErroredFilters={handleSetErroredFilters}
                handleSetErroredCustomizations={handleSetErroredCustomizations}
                validateDependencies={filterOperations.validateDependencies}
                getDependencySuggestion={
                  filterOperations.getDependencySuggestion
                }
                handleModifyItem={handleModifyItem}
              />
            </StyledMainFlex>
          </BaseForm>
        </StyledModalBody>
      </ErrorBoundary>
    </BaseModalWrapper>
  );
}

export default memo(FiltersConfigModal);
