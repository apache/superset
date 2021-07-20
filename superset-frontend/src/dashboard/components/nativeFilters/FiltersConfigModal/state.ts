import { useEffect } from 'react';
import { findLastIndex } from 'lodash';
import { FilterRemoval } from './types';
import { usePrevious } from '../../../../common/hooks/usePrevious';

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

export const useRemoveCurrentFilter = (
  removedFilters: Record<string, FilterRemoval>,
  currentFilterId: string,
  filterIds: string[],
  setCurrentFilterId: Function,
) => {
  useEffect(() => {
    // if the currently viewed filter is fully removed, change to another tab
    const currentFilterRemoved = removedFilters[currentFilterId];
    if (currentFilterRemoved && !currentFilterRemoved.isPending) {
      const nextFilterIndex = findLastIndex(
        filterIds,
        id => !removedFilters[id] && id !== currentFilterId,
      );
      if (nextFilterIndex !== -1)
        setCurrentFilterId(filterIds[nextFilterIndex]);
    }
  }, [currentFilterId, removedFilters, filterIds]);
};

export const useOpenModal = (
  isOpen: boolean,
  addFilter: Function,
  createNewOnOpen?: boolean,
) => {
  const wasOpen = usePrevious(isOpen);
  // if this is a "create" modal rather than an "edit" modal,
  // add a filter on modal open
  useEffect(() => {
    if (createNewOnOpen && isOpen && !wasOpen) {
      addFilter();
    }
  }, [createNewOnOpen, isOpen, wasOpen, addFilter]);
};
