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
import {
  DataMaskStateWithId,
  PartialFilters,
  JsonObject,
} from '@superset-ui/core';
import { ActiveFilters, ChartConfiguration } from '../types';

export const getRelevantDataMask = (
  dataMask: DataMaskStateWithId,
  prop: string,
): JsonObject | DataMaskStateWithId =>
  Object.values(dataMask)
    .filter(item => item[prop])
    .reduce(
      (prev, next) => ({ ...prev, [next.id]: prop ? next[prop] : next }),
      {},
    );

export const getAllActiveFilters = ({
  chartConfiguration,
  nativeFilters,
  dataMask,
  allSliceIds,
}: {
  chartConfiguration: ChartConfiguration;
  dataMask: DataMaskStateWithId;
  nativeFilters: PartialFilters;
  allSliceIds: number[];
}): ActiveFilters => {
  const activeFilters = {};

  // Combine native filters with cross filters, because they have similar logic
  Object.values(dataMask).forEach(({ id: filterId, extraFormData }) => {
    const scope =
      nativeFilters?.[filterId]?.chartsInScope ??
      chartConfiguration?.[filterId]?.crossFilters?.chartsInScope ??
      allSliceIds ??
      [];
    // Iterate over all roots to find all affected charts
    activeFilters[filterId] = {
      scope,
      values: extraFormData,
    };
  });
  return activeFilters;
};
