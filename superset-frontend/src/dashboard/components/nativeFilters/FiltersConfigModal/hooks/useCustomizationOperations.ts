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
import { ChartCustomizationType } from '@superset-ui/core';
import { generateChartCustomizationId } from '../utils';
import type { ItemStateManager } from './useItemStateManager';

export interface CustomizationOperationsParams {
  customizationState: ItemStateManager;
  handleModifyItem: (id: string) => void;
  setActiveItem: (id: string) => void;
  setSaveAlertVisible: (visible: boolean) => void;
}

export interface CustomizationOperations {
  addChartCustomization: (type: ChartCustomizationType) => void;
  handleRemoveCustomization: (id: string) => void;
  restoreCustomization: (id: string) => void;
  handleRearrangeCustomizations: (
    dragIndex: number,
    targetIndex: number,
  ) => void;
}

export function useCustomizationOperations({
  customizationState,
  handleModifyItem,
  setActiveItem,
  setSaveAlertVisible,
}: CustomizationOperationsParams): CustomizationOperations {
  const addChartCustomization = useCallback(
    (type: ChartCustomizationType) => {
      const newCustomizationId = generateChartCustomizationId(type);
      customizationState.setNewIds([
        ...customizationState.newIds,
        newCustomizationId,
      ]);
      handleModifyItem(newCustomizationId);
      setActiveItem(newCustomizationId);
      setSaveAlertVisible(false);
      customizationState.setOrderedIds([
        ...customizationState.orderedIds,
        newCustomizationId,
      ]);
    },
    [customizationState, handleModifyItem, setActiveItem, setSaveAlertVisible],
  );

  const handleRemoveCustomization = useCallback(
    (id: string) => {
      const timerId = window.setTimeout(() => {
        customizationState.setRemovedItems(current => ({
          ...current,
          [id]: { isPending: false },
        }));
      }, 5000);

      customizationState.setRemovedItems(current => ({
        ...current,
        [id]: { isPending: true, timerId },
      }));
      customizationState.setChanges(prev => ({
        ...prev,
        deleted: [...prev.deleted, id],
      }));
      setSaveAlertVisible(false);
    },
    [customizationState, setSaveAlertVisible],
  );

  const restoreCustomization = useCallback(
    (id: string) => {
      const removal = customizationState.removedItems[id];
      if (removal?.isPending) {
        clearTimeout(removal.timerId);
      }

      customizationState.setRemovedItems(current => ({
        ...current,
        [id]: null,
      }));
      customizationState.setChanges(prev => ({
        ...prev,
        deleted: prev.deleted.filter(deletedId => deletedId !== id),
      }));
    },
    [customizationState],
  );

  const handleRearrangeCustomizations = useCallback(
    (dragIndex: number, targetIndex: number) => {
      const newOrderedIds = [...customizationState.orderedIds];
      const [removed] = newOrderedIds.splice(dragIndex, 1);
      newOrderedIds.splice(targetIndex, 0, removed);
      customizationState.setOrderedIds(newOrderedIds);
      customizationState.setChanges(prev => ({
        ...prev,
        reordered: newOrderedIds,
      }));
    },
    [customizationState],
  );

  return {
    addChartCustomization,
    handleRemoveCustomization,
    restoreCustomization,
    handleRearrangeCustomizations,
  };
}
