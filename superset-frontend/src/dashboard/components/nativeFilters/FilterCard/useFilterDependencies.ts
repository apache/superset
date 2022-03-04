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
import { useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';

export const useFilterDependencies = (filter: Filter) => {
  const filterDependencyIds = ensureIsArray(filter.cascadeParentIds);
  return useSelector<RootState, Filter[]>(state => {
    if (filterDependencyIds.length === 0) {
      return [];
    }
    return filterDependencyIds.reduce((acc: Filter[], filterDependencyId) => {
      acc.push(state.nativeFilters.filters[filterDependencyId] as Filter);
      return acc;
    }, []);
  });
};
