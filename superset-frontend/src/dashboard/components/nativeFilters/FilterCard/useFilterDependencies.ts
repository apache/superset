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
import { ensureIsArray, Filter } from '@superset-ui/core';
import { useMemo } from 'react';
import { useFilterEntries } from 'src/dashboard/stores';
import { FilterElement } from '../FilterBar/FilterControls/types';

const EMPTY_ARRAY: Filter[] = [];

export const useFilterDependencies = (filter: FilterElement) => {
  const filterDependencyIdsKey = ensureIsArray(
    filter.cascadeParentIds ?? [],
  ).join(',');
  const filters = useFilterEntries();

  return useMemo(() => {
    const filterDependencyIds = filterDependencyIdsKey
      ? filterDependencyIdsKey.split(',')
      : [];
    if (filterDependencyIds.length === 0) {
      return EMPTY_ARRAY;
    }
    return filterDependencyIds.map(id => filters[id] as Filter).filter(Boolean);
  }, [filterDependencyIdsKey, filters]);
};
