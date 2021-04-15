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
import { useSelector } from 'react-redux';
import { NativeFiltersState } from 'src/dashboard/reducers/types';
import { mergeExtraFormData } from '../../utils';
import { useDataMask } from '../state';

// eslint-disable-next-line import/prefer-default-export
export function useCascadingFilters(id: string) {
  const { filters } = useSelector<any, NativeFiltersState>(
    state => state.nativeFilters,
  );
  const filter = filters[id];
  const cascadeParentIds: string[] = filter?.cascadeParentIds ?? [];
  let cascadedFilters = {};
  const nativeFiltersDataMask = useDataMask();
  cascadeParentIds.forEach(parentId => {
    const parentState = nativeFiltersDataMask[parentId] || {};
    const { extraFormData: parentExtra = {} } = parentState;
    cascadedFilters = mergeExtraFormData(cascadedFilters, parentExtra);
  });
  return cascadedFilters;
}
