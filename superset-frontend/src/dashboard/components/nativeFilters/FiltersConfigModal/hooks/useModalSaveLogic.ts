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
import { useCallback, useMemo } from 'react';
import { isEqual, sortBy } from 'lodash';
import {
  Filter,
  Divider,
  ChartCustomization,
  ChartCustomizationDivider,
  t,
} from '@superset-ui/core';
import type { FormInstance } from '@superset-ui/core/components';
import { useDispatch } from 'react-redux';
import { updateCascadeParentIds } from 'src/dashboard/actions/nativeFilters';
import type { FiltersConfigFormHandle } from '../FiltersConfigForm/FiltersConfigForm';
import {
  NativeFiltersForm,
  NativeFiltersFormItem,
  NativeFilterDivider,
  ChartCustomizationsFormItem,
  SaveChangesType,
} from '../types';
import { validateForm, isFilterId } from '../utils';
import {
  transformFilterForSave,
  transformCustomizationForSave,
} from '../transformers';
import type { ItemStateManager } from './useItemStateManager';

const DEFAULT_EMPTY_ARRAY: string[] = [];

type MergedFilterItem =
  | NativeFiltersFormItem
  | NativeFilterDivider
  | ChartCustomizationsFormItem
  | ChartCustomizationDivider
  | Filter
  | Divider
  | ChartCustomization;

type MergedFilterMap = Record<string, MergedFilterItem>;

export interface ModalSaveLogicParams {
  form: FormInstance<NativeFiltersForm>;
  configFormRef: React.RefObject<FiltersConfigFormHandle>;
  filterState: ItemStateManager;
  customizationState: ItemStateManager;
  filterIds: string[];
  chartCustomizationIds: string[];
  filterConfigMap: Record<string, Filter | Divider>;
  chartCustomizationConfigMap: Record<
    string,
    ChartCustomization | ChartCustomizationDivider
  >;
  initialFilterOrder: string[];
  initialCustomizationOrder: string[];
  unsavedFiltersIds: string[];
  currentItemId: string;
  setActiveItem: (id: string) => void;
  onSave: (changes: SaveChangesType) => Promise<void>;
  canBeUsedAsDependency: (filterId: string) => boolean;
  resetForm: (isSaving?: boolean) => void;
}

export interface ModalSaveLogic {
  handleSave: () => Promise<void>;
  handleErroredItems: () => void;
  getItemTitle: (id: string) => string;
  canSave: boolean;
  hasUnsavedChanges: boolean;
}

export function useModalSaveLogic({
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
  canBeUsedAsDependency,
  resetForm,
}: ModalSaveLogicParams): ModalSaveLogic {
  const dispatch = useDispatch();

  const cleanDeletedParents = useCallback(
    (values: NativeFiltersForm | null) => {
      const modifiedParentFilters = new Set<string>();
      const updatedFilterConfigMap = Object.keys(filterConfigMap).reduce(
        (acc, key) => {
          const filter = filterConfigMap[key];
          const cascadeParentIds = filter.cascadeParentIds?.filter(id =>
            canBeUsedAsDependency(id),
          );

          if (
            cascadeParentIds &&
            !isEqual(cascadeParentIds, filter.cascadeParentIds)
          ) {
            dispatch(updateCascadeParentIds(key, cascadeParentIds));
            modifiedParentFilters.add(key);
          }

          return {
            ...acc,
            [key]: {
              ...filter,
              cascadeParentIds,
            },
          };
        },
        {} as Record<string, Filter | Divider>,
      );

      const filters = values?.filters;
      if (filters) {
        Object.keys(filters).forEach(key => {
          const filter = filters[key];

          if (!('dependencies' in filter)) {
            return;
          }

          const originalDependencies = filter.dependencies || [];
          const cleanedDependencies = originalDependencies.filter(id =>
            canBeUsedAsDependency(id),
          );

          if (!isEqual(cleanedDependencies, originalDependencies)) {
            filter.dependencies = cleanedDependencies;
            modifiedParentFilters.add(key);
          }
        });
      }

      return [updatedFilterConfigMap, modifiedParentFilters] as const;
    },
    [canBeUsedAsDependency, dispatch, filterConfigMap],
  );

  const getItemTitle = useCallback(
    (id: string) => {
      const formValue = form.getFieldValue('filters')?.[id];
      const isFilter = isFilterId(id);
      const config = isFilter
        ? filterConfigMap[id]
        : chartCustomizationConfigMap[id];

      return (
        (formValue && 'name' in formValue && formValue.name) ||
        (formValue && 'title' in formValue && formValue.title) ||
        (config && 'name' in config && config.name) ||
        (config && 'title' in config && config.title) ||
        t(isFilter ? '[untitled]' : '[untitled customization]')
      );
    },
    [form, filterConfigMap, chartCustomizationConfigMap],
  );

  const handleErroredItems = useCallback(() => {
    const formValidationFields = form.getFieldsError();
    const erroredFiltersIds: string[] = [];
    const erroredCustomizationIds: string[] = [];

    formValidationFields.forEach(field => {
      const itemId = field.name[1] as string;
      if (field.errors.length > 0) {
        if (chartCustomizationIds.includes(itemId)) {
          if (!erroredCustomizationIds.includes(itemId)) {
            erroredCustomizationIds.push(itemId);
          }
        } else if (filterIds.includes(itemId)) {
          if (!erroredFiltersIds.includes(itemId)) {
            erroredFiltersIds.push(itemId);
          }
        }
      }
    });

    if (!erroredFiltersIds.length && filterState.erroredIds.length > 0) {
      filterState.setErroredIds(DEFAULT_EMPTY_ARRAY);
    } else if (
      erroredFiltersIds.length > 0 &&
      !isEqual(sortBy(filterState.erroredIds), sortBy(erroredFiltersIds))
    ) {
      filterState.setErroredIds(erroredFiltersIds);
    }

    if (
      !erroredCustomizationIds.length &&
      customizationState.erroredIds.length > 0
    ) {
      customizationState.setErroredIds(DEFAULT_EMPTY_ARRAY);
    } else if (
      erroredCustomizationIds.length > 0 &&
      !isEqual(
        sortBy(customizationState.erroredIds),
        sortBy(erroredCustomizationIds),
      )
    ) {
      customizationState.setErroredIds(erroredCustomizationIds);
    }
  }, [form, filterState, customizationState, chartCustomizationIds, filterIds]);

  const handleSave = useCallback(async () => {
    const values: NativeFiltersForm | null = await validateForm(
      form,
      currentItemId,
      setActiveItem,
    );

    handleErroredItems();

    if (values) {
      const mergedFilters: MergedFilterMap = { ...values.filters };

      filterIds.forEach(filterId => {
        if (!mergedFilters[filterId] && filterConfigMap[filterId]) {
          mergedFilters[filterId] = filterConfigMap[filterId];
        }
      });

      chartCustomizationIds.forEach(customizationId => {
        if (
          !mergedFilters[customizationId] &&
          chartCustomizationConfigMap[customizationId]
        ) {
          mergedFilters[customizationId] =
            chartCustomizationConfigMap[customizationId];
        }
      });

      const mergedValues = { ...values, filters: mergedFilters };

      const [updatedFilterConfigMap, modifiedParentFilters] =
        cleanDeletedParents(values);

      const allModified = [
        ...new Set([
          ...(modifiedParentFilters as Set<string>),
          ...filterState.changes.modified,
        ]),
      ];

      const actualChanges = {
        ...filterState.changes,
        modified:
          allModified.length && filterState.changes.deleted.length
            ? allModified.filter(
                id => !filterState.changes.deleted.includes(id),
              )
            : allModified,
        reordered:
          filterState.changes.reordered.length &&
          !isEqual(filterState.changes.reordered, initialFilterOrder)
            ? filterState.changes.reordered
            : [],
      };

      const hasFilterChanges =
        actualChanges.modified.length > 0 ||
        actualChanges.deleted.length > 0 ||
        actualChanges.reordered.length > 0;

      const actualCustomizationChanges = {
        ...customizationState.changes,
        reordered:
          customizationState.changes.reordered.length &&
          !isEqual(
            customizationState.changes.reordered,
            initialCustomizationOrder,
          )
            ? customizationState.changes.reordered
            : [],
      };

      const hasCustomizationChanges =
        actualCustomizationChanges.modified.length > 0 ||
        actualCustomizationChanges.deleted.length > 0 ||
        actualCustomizationChanges.reordered.length > 0;

      const saveChanges: SaveChangesType = {};

      if (hasFilterChanges) {
        const transformedModified = actualChanges.modified
          .map(id =>
            transformFilterForSave(
              id,
              mergedValues.filters?.[id] || updatedFilterConfigMap[id],
            ),
          )
          .filter(Boolean);

        saveChanges.filterChanges = {
          ...actualChanges,
          modified: transformedModified as (Filter | Divider)[],
        };
      }

      if (hasCustomizationChanges) {
        const transformedModified = actualCustomizationChanges.modified
          .map(id =>
            transformCustomizationForSave(
              id,
              mergedValues.filters?.[id] || chartCustomizationConfigMap[id],
            ),
          )
          .filter(Boolean) as (
          | ChartCustomization
          | ChartCustomizationDivider
        )[];

        saveChanges.customizationChanges = {
          modified: transformedModified,
          deleted: actualCustomizationChanges.deleted,
          reordered: actualCustomizationChanges.reordered,
        };
      }

      if (saveChanges.filterChanges || saveChanges.customizationChanges) {
        await onSave(saveChanges);
        resetForm(true);
      }
    } else {
      configFormRef.current?.changeTab?.('configuration');
    }
  }, [
    form,
    currentItemId,
    handleErroredItems,
    cleanDeletedParents,
    filterState.changes,
    initialFilterOrder,
    initialCustomizationOrder,
    onSave,
    customizationState.changes,
    chartCustomizationConfigMap,
    filterConfigMap,
    filterIds,
    chartCustomizationIds,
    setActiveItem,
    configFormRef,
    resetForm,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    const changed = form.getFieldValue('changed');
    const didChangeOrder =
      filterState.orderedIds.length !== initialFilterOrder.length ||
      filterState.orderedIds.some(
        (val, index) => val !== initialFilterOrder[index],
      );

    return (
      unsavedFiltersIds.length > 0 ||
      form.isFieldsTouched() ||
      changed ||
      didChangeOrder ||
      Object.values(filterState.removedItems).some(f => f?.isPending)
    );
  }, [
    form,
    filterState.orderedIds,
    filterState.removedItems,
    initialFilterOrder,
    unsavedFiltersIds,
  ]);

  const canSave = useMemo(() => {
    const hasNoErrors =
      !filterState.erroredIds.length && !customizationState.erroredIds.length;

    const hasFilterChanges =
      filterState.changes.modified.length > 0 ||
      filterState.changes.deleted.length > 0 ||
      (filterState.changes.reordered.length > 0 &&
        !isEqual(filterState.changes.reordered, initialFilterOrder));

    const hasCustomizationChanges =
      customizationState.changes.modified.length > 0 ||
      customizationState.changes.deleted.length > 0 ||
      (customizationState.changes.reordered.length > 0 &&
        !isEqual(
          customizationState.changes.reordered,
          initialCustomizationOrder,
        ));

    const hasChanges = hasFilterChanges || hasCustomizationChanges;

    return hasNoErrors && hasChanges;
  }, [
    filterState.erroredIds,
    filterState.changes,
    customizationState.erroredIds,
    customizationState.changes,
    initialFilterOrder,
    initialCustomizationOrder,
  ]);

  return {
    handleSave,
    handleErroredItems,
    getItemTitle,
    canSave,
    hasUnsavedChanges,
  };
}
