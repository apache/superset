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
import { DataMask, Filters } from '@superset-ui/core';
import { SaveFilterChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import { getInitialDataMask, useDataMaskStore } from './useDataMaskStore';

/**
 * Imperative domain API for the dataMask store, for use outside render (event
 * handlers, effects, thunks). Components read the store through `./hooks`.
 */

export const setDataMaskForFilterChangesComplete = (
  filterChanges: SaveFilterChangesType,
  filters?: Filters,
  isCustomizationChanges?: boolean,
): void =>
  useDataMaskStore
    .getState()
    .setDataMaskForFilterChanges(
      filterChanges,
      filters,
      isCustomizationChanges,
    );

export const updateDataMask = (
  filterId: string | number,
  dataMask: DataMask,
): void => useDataMaskStore.getState().updateDataMask(filterId, dataMask);

export const clearDataMask = (filterId: string | number): void =>
  updateDataMask(filterId, getInitialDataMask(filterId));

export const removeDataMask = (filterId: string | number): void =>
  useDataMaskStore.getState().removeDataMask(filterId);

export const clearDataMaskState = (): void =>
  useDataMaskStore.getState().clearDataMask();
