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
import { useCallback } from 'react';
import { t } from '@apache-superset/core';
import { Filter, Divider, NativeFilterType } from '@superset-ui/core';
import type { FormInstance } from '@superset-ui/core/components';
import { NativeFiltersForm } from '../types';
import { generateFilterId, hasCircularDependency } from '../utils';
import type { ItemStateManager } from './useItemStateManager';

export const ALLOW_DEPENDENCIES = [
  'filter_range',
  'filter_select',
  'filter_time',
];

interface AvailableFilterOption {
  label: string;
  value: string;
  type: string | undefined;
}

export interface FilterOperationsParams {
  form: FormInstance<NativeFiltersForm>;
  filterState: ItemStateManager;
  filterIds: string[];
  filterConfigMap: Record<string, Filter | Divider>;
  handleModifyItem: (id: string) => void;
  setActiveItem: (id: string) => void;
  setSaveAlertVisible: (visible: boolean) => void;
}

export interface FilterOperations {
  addFilter: (type: NativeFilterType) => void;
  handleRemoveFilter: (id: string) => void;
  restoreFilter: (id: string) => void;
  handleRearrangeFilters: (dragIndex: number, targetIndex: number) => void;
  canBeUsedAsDependency: (filterId: string) => boolean;
  buildDependencyMap: () => Map<string, string[]>;
  getAvailableFilters: (
    filterId: string,
    getItemTitle: (id: string) => string,
  ) => AvailableFilterOption[];
  validateDependencies: () => void;
  getDependencySuggestion: (filterId: string) => string;
}

export function useFilterOperations({
  form,
  filterState,
  filterIds,
  filterConfigMap,
  handleModifyItem,
  setActiveItem,
  setSaveAlertVisible,
}: FilterOperationsParams): FilterOperations {
  const addFilter = useCallback(
    (type: NativeFilterType) => {
      const newFilterId = generateFilterId(type);
      filterState.setNewIds([...filterState.newIds, newFilterId]);
      handleModifyItem(newFilterId);
      setActiveItem(newFilterId);
      setSaveAlertVisible(false);
      filterState.setOrderedIds([...filterState.orderedIds, newFilterId]);
    },
    [filterState, handleModifyItem, setActiveItem, setSaveAlertVisible],
  );

  const handleRemoveFilter = useCallback(
    (id: string) => {
      const timerId = window.setTimeout(() => {
        filterState.setRemovedItems(current => ({
          ...current,
          [id]: { isPending: false },
        }));
      }, 5000);

      filterState.setRemovedItems(current => ({
        ...current,
        [id]: { isPending: true, timerId },
      }));
      filterState.setChanges(prev => ({
        ...prev,
        deleted: [...prev.deleted, id],
      }));
      setSaveAlertVisible(false);
    },
    [filterState, setSaveAlertVisible],
  );

  const restoreFilter = useCallback(
    (id: string) => {
      const removal = filterState.removedItems[id];
      if (removal?.isPending) {
        clearTimeout(removal.timerId);
      }

      filterState.setRemovedItems(current => ({ ...current, [id]: null }));
      filterState.setChanges(prev => ({
        ...prev,
        deleted: prev.deleted.filter(deletedId => deletedId !== id),
      }));
    },
    [filterState],
  );

  const handleRearrangeFilters = useCallback(
    (dragIndex: number, targetIndex: number) => {
      const newOrderedIds = [...filterState.orderedIds];
      const [removed] = newOrderedIds.splice(dragIndex, 1);
      newOrderedIds.splice(targetIndex, 0, removed);
      filterState.setOrderedIds(newOrderedIds);
      filterState.setChanges(prev => ({
        ...prev,
        reordered: newOrderedIds,
      }));
    },
    [filterState],
  );

  const canBeUsedAsDependency = useCallback(
    (filterId: string) => {
      if (filterState.removedItems[filterId]) {
        return false;
      }
      const component =
        form.getFieldValue('filters')?.[filterId] || filterConfigMap[filterId];
      return (
        component &&
        'filterType' in component &&
        ALLOW_DEPENDENCIES.includes(component.filterType)
      );
    },
    [filterConfigMap, form, filterState.removedItems],
  );

  const buildDependencyMap = useCallback(() => {
    const dependencyMap = new Map<string, string[]>();
    const filters = form.getFieldValue('filters');
    if (filters) {
      Object.keys(filters).forEach(key => {
        const formItem = filters[key];
        const configItem = filterConfigMap[key];
        let array: string[] = [];
        if (formItem && 'dependencies' in formItem) {
          array = [...formItem.dependencies];
        } else if (configItem?.cascadeParentIds) {
          array = [...configItem.cascadeParentIds];
        }
        dependencyMap.set(key, array);
      });
    }
    return dependencyMap;
  }, [filterConfigMap, form]);

  const getAvailableFilters = useCallback(
    (filterId: string, getItemTitle: (id: string) => string) => {
      const dependencyMap = buildDependencyMap();

      return filterIds
        .filter(id => id !== filterId)
        .filter(id => canBeUsedAsDependency(id))
        .filter(id => {
          const currentDependencies = dependencyMap.get(filterId) || [];
          const testDependencies = [...currentDependencies, id];
          const testMap = new Map(dependencyMap);
          testMap.set(filterId, testDependencies);
          return !hasCircularDependency(testMap, filterId);
        })
        .map(id => ({
          label: getItemTitle(id),
          value: id,
          type: filterConfigMap[id]?.filterType,
        }));
    },
    [buildDependencyMap, canBeUsedAsDependency, filterConfigMap, filterIds],
  );

  const validateDependencies = useCallback(() => {
    const dependencyMap = buildDependencyMap();
    filterIds
      .filter(id => !filterState.removedItems[id])
      .forEach(filterId => {
        const result = hasCircularDependency(dependencyMap, filterId);
        const field = {
          name: ['filters', filterId, 'dependencies'] as [
            'filters',
            string,
            'dependencies',
          ],
          errors: result ? [t('Cyclic dependency detected')] : [],
        };
        form.setFields([field]);
      });
  }, [buildDependencyMap, filterIds, form, filterState.removedItems]);

  const getDependencySuggestion = useCallback(
    (filterId: string) => {
      const dependencyMap = buildDependencyMap();
      const possibleDependencies = filterState.orderedIds.filter(
        key => key !== filterId && canBeUsedAsDependency(key),
      );
      const found = possibleDependencies.find(filter => {
        const dependencies = dependencyMap.get(filterId) || [];
        dependencies.push(filter);
        if (hasCircularDependency(dependencyMap, filterId)) {
          dependencies.pop();
          return false;
        }
        return true;
      });
      return found || possibleDependencies[0] || '';
    },
    [buildDependencyMap, canBeUsedAsDependency, filterState.orderedIds],
  );

  return {
    addFilter,
    handleRemoveFilter,
    restoreFilter,
    handleRearrangeFilters,
    canBeUsedAsDependency,
    buildDependencyMap,
    getAvailableFilters,
    validateDependencies,
    getDependencySuggestion,
  };
}
