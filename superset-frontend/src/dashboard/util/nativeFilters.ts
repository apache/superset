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
import { NativeFiltersState } from '../components/nativeFilters/types';

export function getNativeFilterClauses(state: NativeFiltersState) {
  const { filters, filtersState } = state;
  return Object.keys(filters).map(id => {
    const filter = filters[id];
    const filterState = filtersState[id];
    const { targets } = filter;
    const [target] = targets;
    const { column, datasetId } = target;
    const datasource = `table__${datasetId}`;
    const { selectedValues } = filterState;
    const { name: col } = column;
    const filterClause =
      selectedValues && selectedValues.length > 0
        ? { col, op: 'in', val: selectedValues }
        : undefined;
    return {
      column,
      datasetId,
      datasource,
      filterClause,
      id,
      selectedValues: selectedValues || [],
    };
  });
};
