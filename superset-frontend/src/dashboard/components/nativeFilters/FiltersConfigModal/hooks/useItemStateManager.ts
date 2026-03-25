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
import { useState, useCallback, useEffect } from 'react';
import { uniq, isEmpty } from 'lodash';
import { FilterChangesType, FilterRemoval } from '../types';

const DEFAULT_EMPTY_ARRAY: string[] = [];
const DEFAULT_REMOVED_ITEMS: Record<string, FilterRemoval> = {};
const DEFAULT_CHANGES: FilterChangesType = {
  modified: [],
  deleted: [],
  reordered: [],
};

export interface ItemStateManagerConfig {
  initialOrder: string[];
  configMap: Record<string, unknown>;
  newIds: string[];
  removedItems: Record<string, FilterRemoval>;
}

export interface ItemStateManager {
  changes: FilterChangesType;
  newIds: string[];
  removedItems: Record<string, FilterRemoval>;
  erroredIds: string[];
  orderedIds: string[];
  renderedIds: string[];
  setChanges: (
    changes:
      | FilterChangesType
      | ((prev: FilterChangesType) => FilterChangesType),
  ) => void;
  setNewIds: (ids: string[]) => void;
  setRemovedItems: (
    items:
      | Record<string, FilterRemoval>
      | ((
          prev: Record<string, FilterRemoval>,
        ) => Record<string, FilterRemoval>),
  ) => void;
  setErroredIds: (ids: string[]) => void;
  setOrderedIds: (ids: string[]) => void;
  setRenderedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  resetState: () => void;
  addToRendered: (id: string) => void;
}

export function useItemStateManager(
  initialOrder: string[],
  configMap: Record<string, unknown>,
): ItemStateManager {
  const [changes, setChanges] = useState<FilterChangesType>(DEFAULT_CHANGES);
  const [newIds, setNewIds] = useState<string[]>(DEFAULT_EMPTY_ARRAY);
  const [removedItems, setRemovedItems] = useState<
    Record<string, FilterRemoval>
  >(DEFAULT_REMOVED_ITEMS);
  const [erroredIds, setErroredIds] = useState<string[]>(DEFAULT_EMPTY_ARRAY);
  const [orderedIds, setOrderedIds] = useState<string[]>(initialOrder);
  const [renderedIds, setRenderedIds] = useState<string[]>(DEFAULT_EMPTY_ARRAY);

  const resetState = useCallback(() => {
    setChanges(DEFAULT_CHANGES);
    setNewIds(DEFAULT_EMPTY_ARRAY);
    setRemovedItems(DEFAULT_REMOVED_ITEMS);
    setErroredIds(DEFAULT_EMPTY_ARRAY);
    setRenderedIds(DEFAULT_EMPTY_ARRAY);
  }, []);

  const addToRendered = useCallback((id: string) => {
    setRenderedIds(prev => {
      if (!prev.includes(id)) {
        return [...prev, id];
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (!isEmpty(removedItems)) {
      setErroredIds(prevErroredIds =>
        prevErroredIds.filter(id => !removedItems[id]),
      );
    }
  }, [removedItems]);

  useEffect(() => {
    const savedIds = Object.keys(configMap);
    setOrderedIds(prevOrderedIds => {
      const unsavedIds = newIds.filter(
        id => !removedItems[id] || removedItems[id]?.isPending,
      );
      const combinedIds = uniq([...savedIds, ...unsavedIds]);

      const prevSet = new Set(prevOrderedIds);
      const combinedSet = new Set(combinedIds);

      const sameIds =
        prevSet.size === combinedSet.size &&
        [...prevSet].every(id => combinedSet.has(id));

      if (!sameIds) {
        const existingOrder = prevOrderedIds.filter(id => combinedSet.has(id));
        const newIdsToAdd = combinedIds.filter(id => !prevSet.has(id));
        return [...existingOrder, ...newIdsToAdd];
      }
      return prevOrderedIds;
    });
  }, [configMap, newIds, removedItems]);

  useEffect(
    () => () => {
      Object.values(removedItems).forEach(removal => {
        if (removal?.isPending && removal.timerId) {
          clearTimeout(removal.timerId);
        }
      });
    },
    [removedItems],
  );

  return {
    changes,
    newIds,
    removedItems,
    erroredIds,
    orderedIds,
    renderedIds,
    setChanges,
    setNewIds,
    setRemovedItems,
    setErroredIds,
    setOrderedIds,
    setRenderedIds,
    resetState,
    addToRendered,
  };
}
